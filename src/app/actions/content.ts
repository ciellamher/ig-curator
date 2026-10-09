"use server"

import { prisma } from "@/lib/prisma"
import { requireUserId, run, type Result } from "@/lib/planner/server"
import { Prisma, type Content, type ContentMedia } from "@prisma/client"
import { CATEGORY_OPTIONS, CLOTHING_NAMES, DEFAULT_STATUS, STATUS_NAMES } from "@/lib/planner/options"
import { isValidScheduleValue, type Schedule } from "@/lib/planner/dates"
import { AUTO_STATUSES, categoryForFeedSlot, statusForFeedSlot } from "@/lib/planner/feed"
import { SAMPLE_QUICK_LINKS, sampleContent } from "@/lib/planner/sample"
import type { ContentDTO, ContentPatch, FeedSlotSync, Location } from "@/lib/planner/types"

const MAX_SYNC_SLOTS = 1000
const MAX_URL_LENGTH = 2048
const DEFAULT_TITLE = /^Untitled( (Post|Reel|Carousel|Story))?$/

function toDTO(c: Content & { media: ContentMedia[] }): ContentDTO {
  return {
    id: c.id,
    parentId: c.parentId,
    title: c.title,
    status: c.status,
    categories: c.categories,
    edited: c.edited,
    clothingStatus: c.clothingStatus,
    orderedAt: c.orderedAt?.toISOString() ?? null,
    shoot: { start: c.shootStart, end: c.shootEnd },
    edit: { start: c.editStart, end: c.editEnd },
    post: { start: c.postStart, end: c.postEnd },
    pinterestUrl: c.pinterestUrl,
    location: (c.location as Location | null) ?? null,
    body: c.body,
    slotId: c.slotId,
    contentType: c.contentType,
    media: [...c.media].sort((a, b) => a.position - b.position).map((m) => ({ id: m.id, url: m.url, position: m.position })),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

// ---- Validation ----

function cleanText(value: unknown, max = 300): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim().slice(0, max)
  return s === "" ? null : s
}

function cleanSchedule(value: Schedule | undefined, label: string): { start: string | null; end: string | null } {
  const start = cleanText(value?.start, 16)
  const end = start ? cleanText(value?.end, 16) : null
  if (start && !isValidScheduleValue(start)) throw new Error(`Invalid ${label}`)
  if (end && !isValidScheduleValue(end)) throw new Error(`Invalid ${label} end`)
  if (start && end && end < start) throw new Error(`${label} ends before it starts`)
  return { start, end }
}

function cleanUrl(value: unknown): string | null {
  const s = cleanText(value, MAX_URL_LENGTH)
  if (!s) return null
  let url: URL
  try {
    url = new URL(s)
  } catch {
    throw new Error("Enter a full link starting with https://")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http(s) links are allowed")
  return url.toString()
}

function cleanLocation(value: unknown): Location | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  const name = cleanText(v.name, 200)
  if (!name) return null
  const coord = (n: unknown, limit: number) => {
    if (n === null || n === undefined || n === "") return null
    const num = Number(n)
    if (!Number.isFinite(num) || Math.abs(num) > limit) throw new Error("Invalid coordinates")
    return num
  }
  return {
    name,
    address: cleanText(v.address, 300) ?? undefined,
    latitude: coord(v.latitude, 90),
    longitude: coord(v.longitude, 180),
    placeId: cleanText(v.placeId, 200) ?? undefined,
  }
}

/** Ensures a parent belongs to the user and that the assignment can't create a cycle (one level of nesting). */
async function validateParent(userId: string, parentId: string | null, selfId?: string) {
  if (!parentId) return
  if (parentId === selfId) throw new Error("An item can't be its own parent")
  const parent = await prisma.content.findFirst({ where: { id: parentId, userId } })
  if (!parent) throw new Error("Parent not found")
  if (parent.parentId) throw new Error("Sub-items can't have their own sub-items")
  if (selfId && (await prisma.content.count({ where: { parentId: selfId } })) > 0) {
    throw new Error("An item with sub-items can't be moved under another item")
  }
}

function patchToData(patch: ContentPatch, existing?: Content): Prisma.ContentUncheckedUpdateInput {
  const data: Prisma.ContentUncheckedUpdateInput = {}
  if ("title" in patch) data.title = cleanText(patch.title) ?? "Untitled"
  if ("status" in patch) {
    if (!STATUS_NAMES.includes(patch.status as any)) throw new Error("Invalid status")
    data.status = patch.status
  }
  if ("categories" in patch) {
    const cats = Array.from(new Set(patch.categories ?? []))
    if (cats.some((c) => !CATEGORY_OPTIONS.includes(c as any))) throw new Error("Invalid category")
    data.categories = cats
  }
  if ("edited" in patch) data.edited = Boolean(patch.edited)
  if ("clothingStatus" in patch) {
    const clothing = patch.clothingStatus || null
    if (clothing && !CLOTHING_NAMES.includes(clothing as any)) throw new Error("Invalid clothing status")
    data.clothingStatus = clothing
    // The 14-day return window starts on the day the order is placed.
    if (clothing === "Ordered" && !existing?.orderedAt) data.orderedAt = new Date()
    if (!clothing || clothing === "Buy Clothes") data.orderedAt = null
  }
  for (const [field, label] of [["shoot", "Shoot Date"], ["edit", "Edit Date"], ["post", "Post Now"]] as const) {
    if (field in patch) {
      const s = cleanSchedule(patch[field], label)
      data[`${field}Start`] = s.start
      data[`${field}End`] = s.end
    }
  }
  if ("pinterestUrl" in patch) data.pinterestUrl = cleanUrl(patch.pinterestUrl)
  if ("location" in patch) data.location = cleanLocation(patch.location) ?? Prisma.DbNull
  if ("body" in patch) data.body = String(patch.body ?? "").slice(0, 50_000)
  return data
}

// ---- CRUD ----

export async function listContent(): Promise<Result<ContentDTO[]>> {
  return run(async () => {
    const userId = await requireUserId()
    const rows = await prisma.content.findMany({ where: { userId }, include: { media: true }, orderBy: { createdAt: "desc" } })
    return rows.map(toDTO)
  })
}

export async function createContent(input: ContentPatch = {}): Promise<Result<ContentDTO>> {
  return run(async () => {
    const userId = await requireUserId()
    const parentId = input.parentId || null
    await validateParent(userId, parentId)
    const data = patchToData(input) as Prisma.ContentUncheckedCreateInput
    const row = await prisma.content.create({
      data: { ...data, userId, parentId, title: (data.title as string) ?? "Untitled", status: (data.status as string) ?? DEFAULT_STATUS },
      include: { media: true },
    })
    return toDTO(row)
  })
}

export async function updateContent(id: string, patch: ContentPatch): Promise<Result<ContentDTO>> {
  return run(async () => {
    const userId = await requireUserId()
    const existing = await prisma.content.findFirst({ where: { id, userId } })
    if (!existing) throw new Error("This item no longer exists")
    const data = patchToData(patch, existing)
    if ("parentId" in patch) {
      const parentId = patch.parentId || null
      await validateParent(userId, parentId, id)
      data.parentId = parentId
    }
    const row = await prisma.content.update({ where: { id }, data, include: { media: true } })
    return toDTO(row)
  })
}

/** Deletes one record. Its sub-items are kept and become top-level records. */
export async function deleteContent(id: string): Promise<Result<{ id: string }>> {
  return run(async () => {
    const userId = await requireUserId()
    const { count } = await prisma.content.deleteMany({ where: { id, userId } })
    if (count === 0) throw new Error("This item no longer exists")
    return { id }
  })
}

export async function loadSampleData(): Promise<Result<{ created: number }>> {
  return run(async () => {
    const userId = await requireUserId()
    const samples = sampleContent()
    const ids = new Map<string, string>()
    await prisma.$transaction(async (tx) => {
      for (const { key, parentKey, markOrderedDaysAgo, ...patch } of samples) {
        const data = patchToData(patch) as Prisma.ContentUncheckedCreateInput
        const row = await tx.content.create({
          data: {
            ...data,
            userId,
            title: data.title as string,
            parentId: parentKey ? ids.get(parentKey) : null,
            orderedAt: markOrderedDaysAgo !== undefined ? new Date(Date.now() - markOrderedDaysAgo * 86_400_000) : (data.orderedAt as Date | null | undefined),
          },
        })
        ids.set(key, row.id)
      }
      await tx.quickLink.createMany({ data: SAMPLE_QUICK_LINKS.map((l) => ({ ...l, userId })) })
    })
    return { created: samples.length }
  })
}

// ---- Feed sync ----

function cleanMediaUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return []
  return urls
    .filter((u): u is string => typeof u === "string" && !u.startsWith("data:") && u.length <= MAX_URL_LENGTH)
    .slice(0, 20)
}

/**
 * Mirrors feed slots into the content database: creates a record for every new post/reel/story, attaches its photos,
 * and moves it from "To Board"/"To Shoot" to "To Edit" once a photo is added. Anything set in the planner is otherwise left alone.
 */
export async function syncFeedToContent(slots: FeedSlotSync[]): Promise<Result<{ created: number; updated: number }>> {
  return run(async () => {
    const userId = await requireUserId()
    if (!Array.isArray(slots)) throw new Error("Invalid payload")

    const clean: FeedSlotSync[] = slots.slice(0, MAX_SYNC_SLOTS).flatMap((s) => {
      const slotId = cleanText(s?.slotId, 120)
      if (!slotId) return []
      return [{
        slotId,
        contentType: cleanText(s.contentType, 20) ?? "Post",
        location: s.location === "drafts" || s.location === "story" ? s.location : "grid",
        title: cleanText(s.title) ?? "",
        mediaUrls: cleanMediaUrls(s.mediaUrls),
      }]
    })
    if (clean.length === 0) return { created: 0, updated: 0 }

    const existing = await prisma.content.findMany({
      where: { userId, slotId: { in: clean.map((s) => s.slotId) } },
      include: { media: true },
    })
    const bySlot = new Map(existing.map((c) => [c.slotId!, c]))
    let created = 0
    let updated = 0

    await prisma.$transaction(async (tx) => {
      for (const slot of clean) {
        const current = bySlot.get(slot.slotId)
        const media = slot.mediaUrls.map((url, position) => ({ url, position }))

        if (!current) {
          await tx.content.create({
            data: {
              userId,
              slotId: slot.slotId,
              contentType: slot.contentType,
              title: slot.title || `Untitled ${slot.contentType}`,
              status: statusForFeedSlot(slot),
              categories: [categoryForFeedSlot(slot)],
              media: { create: media },
            },
          })
          created++
          continue
        }

        const data: Prisma.ContentUncheckedUpdateInput = {}
        if (current.contentType !== slot.contentType) data.contentType = slot.contentType
        if (slot.title && DEFAULT_TITLE.test(current.title) && current.title !== slot.title) data.title = slot.title
        const autoStatus = statusForFeedSlot(slot)
        if (AUTO_STATUSES.includes(current.status) && autoStatus !== current.status && autoStatus !== "To Board") data.status = autoStatus

        const currentUrls = [...current.media].sort((a, b) => a.position - b.position).map((m) => m.url)
        const mediaChanged = currentUrls.join("\n") !== slot.mediaUrls.join("\n")
        if (mediaChanged) {
          await tx.contentMedia.deleteMany({ where: { contentId: current.id } })
          if (media.length) await tx.contentMedia.createMany({ data: media.map((m) => ({ ...m, contentId: current.id })) })
        }
        if (Object.keys(data).length) await tx.content.update({ where: { id: current.id }, data })
        if (mediaChanged || Object.keys(data).length) updated++
      }
    })

    return { created, updated }
  })
}
