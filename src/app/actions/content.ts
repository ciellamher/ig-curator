"use server"

import { prisma } from "@/lib/prisma"
import { requireUserId, run, type Result } from "@/lib/planner/server"
import { scheduleCalendarSync } from "@/lib/googleCalendar"
import { Prisma, type Content, type ContentMedia } from "@prisma/client"
import { CATEGORY_OPTIONS, CLOTHING_NAMES, DEFAULT_STATUS, STATUS_NAMES } from "@/lib/planner/options"
import { isValidScheduleValue, type Schedule } from "@/lib/planner/dates"
import { AUTO_STATUSES, categoryForFeedSlot, defaultFeedTitle, statusForFeedSlot } from "@/lib/planner/feed"
import { SAMPLE_ORDERS, SAMPLE_QUICK_LINKS, sampleContent } from "@/lib/planner/sample"
import { withScheduleRules } from "@/lib/planner/rules"
import { SHEIN_ENABLED } from "@/lib/features"
import type { ContentDTO, ContentPatch, FeedBox, FeedSlotSync, FeedSyncRequest, Location } from "@/lib/planner/types"

const MAX_SYNC_SLOTS = 10000
const MAX_URL_LENGTH = 2048
const DEFAULT_TITLE = /^(Untitled( (Post|Reel|Carousel|Story|Inspo|InspoPost|InspoStory|InspoHighlight|Inspo Board|Story Folder))?|New Folder)$/

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
    deliveredAt: c.deliveredAt?.toISOString() ?? null,
    orderId: c.orderId,
    shoot: { start: c.shootStart, end: c.shootEnd },
    edit: { start: c.editStart, end: c.editEnd },
    post: { start: c.postStart, end: c.postEnd },
    pinterestUrl: c.pinterestUrl,
    location: (c.location as Location | null) ?? null,
    body: c.body,
    slotId: c.slotId,
    contentType: (c.contentType?.startsWith('{"primary"') ? JSON.parse(c.contentType).primary : c.contentType),
    extraSlots: c.contentType?.startsWith('{"primary"') ? JSON.parse(c.contentType).extra : null,
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
    // Record when clothes were ordered and delivered; the 14-day return window starts on delivery.
    if ((clothing === "Ordered" || clothing === "Delivered") && !existing?.orderedAt) data.orderedAt = new Date()
    if (clothing === "Delivered" && !existing?.deliveredAt) data.deliveredAt = new Date()
    if (clothing === "Ordered") data.deliveredAt = null
    if (!clothing || clothing === "Buy Clothes") {
      data.orderedAt = null
      data.deliveredAt = null
    }
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
  if ("slotId" in patch) data.slotId = patch.slotId
  
  if ("contentType" in patch || "extraSlots" in patch) {
    const ct = "contentType" in patch ? patch.contentType : undefined
    const es = "extraSlots" in patch ? patch.extraSlots : undefined
    if (es && Object.keys(es).length > 0) {
      data.contentType = JSON.stringify({ primary: ct !== undefined ? ct : undefined, extra: es })
    } else if (ct !== undefined) {
      data.contentType = ct
    }
  }

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
    scheduleCalendarSync(userId) // runs after this change is saved
    const parentId = input.parentId || null
    await validateParent(userId, parentId)
    const blank = { status: DEFAULT_STATUS as string, categories: [], post: { start: null, end: null }, edit: { start: null, end: null } }
    const data = patchToData(withScheduleRules(blank, input)) as Prisma.ContentUncheckedCreateInput
    // Planner items get a box in the Posts grid (same slot id), so both sides always match
    const slotId = typeof input.slotId === "string" && /^slot-[\w-]{3,100}$/.test(input.slotId) ? input.slotId : null
    const contentType = input.contentType === "Reel" || input.contentType === "StoryFolder" ? input.contentType : slotId ? "Post" : null
    const row = await prisma.content.create({
      data: { ...data, userId, parentId, slotId, contentType, title: (data.title as string) ?? "Untitled", status: (data.status as string) ?? DEFAULT_STATUS },
      include: { media: true },
    })
    return toDTO(row)
  })
}

export async function updateContent(id: string, patch: ContentPatch): Promise<Result<ContentDTO>> {
  return run(async () => {
    const userId = await requireUserId()
    scheduleCalendarSync(userId) // runs after this change is saved
    const existing = await prisma.content.findFirst({ where: { id, userId } })
    if (!existing) throw new Error("This item no longer exists")
    const current = {
      status: existing.status,
      categories: existing.categories,
      post: { start: existing.postStart, end: existing.postEnd },
      edit: { start: existing.editStart, end: existing.editEnd },
    }
    const data = patchToData(withScheduleRules(current, patch), existing)
    if ("parentId" in patch) {
      const parentId = patch.parentId || null
      await validateParent(userId, parentId, id)
      data.parentId = parentId
    }
    const row = await prisma.content.update({ where: { id }, data, include: { media: true } })
    return toDTO(row)
  })
}

const FEED_FOLDER_TYPES = ["StoryFolder", "InspoFolder"]

/**
 * Deletes records. Sub-items are kept as top-level records, except inside a feed story folder or inspo board, where
 * (like deleting the folder in the feed) the feed boxes inside go too. Deleted feed boxes are recorded so every feed
 * removes them.
 */
export async function deleteContents(ids: string[]): Promise<Result<{ deletedIds: string[]; deletedSlotIds: string[] }>> {
  return run(async () => {
    const userId = await requireUserId()
    scheduleCalendarSync(userId) // runs after this change is saved
    const wanted = Array.isArray(ids) ? ids.filter((i) => typeof i === "string").slice(0, 1000) : []
    const records = await prisma.content.findMany({ where: { userId, id: { in: wanted } }, select: { id: true, slotId: true, contentType: true } })
    if (records.length === 0) throw new Error("These items no longer exist")

    const feedFolderIds = records.filter((r) => r.slotId && FEED_FOLDER_TYPES.includes(r.contentType ?? "")).map((r) => r.id)
    const feedChildren = feedFolderIds.length
      ? await prisma.content.findMany({ where: { userId, parentId: { in: feedFolderIds }, slotId: { not: null } }, select: { id: true, slotId: true } })
      : []
    const doomed = new Map([...records, ...feedChildren].map((d) => [d.id, d.slotId]))
    const deletedSlotIds = [...doomed.values()].filter((s): s is string => !!s)

    await prisma.$transaction([
      prisma.content.deleteMany({ where: { userId, id: { in: [...doomed.keys()] } } }),
      prisma.deletedFeedSlot.createMany({ data: deletedSlotIds.map((slotId) => ({ userId, slotId })), skipDuplicates: true }),
    ])
    return { deletedIds: [...doomed.keys()], deletedSlotIds }
  })
}

export async function deleteContent(id: string) {
  return deleteContents([id])
}

function validLink(link: { slotId: string; contentType: string }) {
  if (!/^slot-[\w-]{3,100}$/.test(link.slotId)) throw new Error("Invalid feed box")
  const contentType = ["Post", "Reel", "StoryFolder"].includes(link.contentType) ? link.contentType : "Post"
  return { slotId: link.slotId, contentType }
}

/** Connects a page to a feed box, or disconnects it (link = null) without deleting the page. */
export async function setContentFeedLink(id: string, link: { slotId: string; contentType: string } | null): Promise<Result<ContentDTO>> {
  return run(async () => {
    const userId = await requireUserId()
    const row = await prisma.content.findFirst({ where: { id, userId } })
    if (!row) throw new Error("This item no longer exists")
    const data = link ? validLink(link) : { slotId: null, contentType: null }
    const updated = await prisma.content.update({ where: { id }, data, include: { media: true } })
    if (link) await prisma.deletedFeedSlot.deleteMany({ where: { userId, slotId: link.slotId } })
    return toDTO(updated)
  })
}

/** Feed boxes deleted from the database (or another browser's feed), so this feed can remove them too. */
export async function listDeletedFeedSlots(): Promise<Result<string[]>> {
  return run(async () => {
    const userId = await requireUserId()
    const rows = await prisma.deletedFeedSlot.findMany({ where: { userId }, select: { slotId: true } })
    return rows.map((r) => r.slotId)
  })
}

export async function loadSampleData(): Promise<Result<{ created: number }>> {
  return run(async () => {
    const userId = await requireUserId()
    scheduleCalendarSync(userId) // runs after this change is saved
    const samples = sampleContent()
    const ids = new Map<string, string>()
    await prisma.$transaction(async (tx) => {
      const daysAgo = (n: number | undefined) => (n === undefined ? null : new Date(Date.now() - n * 86_400_000))
      const orderIds = new Map<string, string>()
      for (const o of SHEIN_ENABLED ? SAMPLE_ORDERS : []) {
        const order = await tx.clothingOrder.create({
          data: { userId, name: o.name, orderedAt: daysAgo(o.orderedDaysAgo), deliveredAt: daysAgo(o.deliveredDaysAgo) },
        })
        orderIds.set(o.key, order.id)
      }
      const blank = { status: DEFAULT_STATUS as string, categories: [], post: { start: null, end: null }, edit: { start: null, end: null } }
      for (const { key, parentKey, orderKey, orderedDaysAgo, deliveredDaysAgo, ...sample } of samples) {
        const patch = SHEIN_ENABLED ? sample : { ...sample, clothingStatus: null }
        const data = patchToData(withScheduleRules(blank, patch)) as Prisma.ContentUncheckedCreateInput
        const row = await tx.content.create({
          data: {
            ...data,
            userId,
            title: data.title as string,
            parentId: parentKey ? ids.get(parentKey) : null,
            orderId: orderKey ? orderIds.get(orderKey) : null,
            orderedAt: orderedDaysAgo !== undefined ? daysAgo(orderedDaysAgo) : (data.orderedAt as Date | null | undefined),
            deliveredAt: deliveredDaysAgo !== undefined ? daysAgo(deliveredDaysAgo) : (data.deliveredAt as Date | null | undefined),
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
 * Keeps the database in step with the feed. Everything added in the feed (posts, reels, drafts, story folders with
 * their stories, inspo boards with their photos) gets a record; photos are attached; items move from
 * "To Board"/"To Shoot" to "To Edit" once a photo is added; renaming a box renames its record; deleting a box deletes
 * its record. Boxes deleted elsewhere are never re-created.
 */
export async function syncFeedToContent(request: FeedSyncRequest): Promise<Result<{ created: number; updated: number; deleted: number; addToFeed: FeedBox[]; textForFeed: { slotId: string; title: string }[] }>> {
  return run(async () => {
    const userId = await requireUserId()
    scheduleCalendarSync(userId) // runs after this change is saved
    const slots = Array.isArray(request?.slots) ? request.slots : []
    const ids = (v: unknown) => (Array.isArray(v) ? v.flatMap((x) => (typeof x === "string" && x.length <= 120 ? [x] : [])).slice(0, MAX_SYNC_SLOTS) : [])
    const deletedSlotIds = ids(request?.deletedSlotIds)
    const restoredSlotIds = ids(request?.restoredSlotIds)

    // Boxes brought back in the feed (e.g. undo) are no longer deleted; boxes deleted in the feed lose their record.
    if (restoredSlotIds.length) await prisma.deletedFeedSlot.deleteMany({ where: { userId, slotId: { in: restoredSlotIds } } })
    let deleted = 0
    if (deletedSlotIds.length) {
      const [res] = await prisma.$transaction([
        prisma.content.deleteMany({ where: { userId, slotId: { in: deletedSlotIds } } }),
        prisma.deletedFeedSlot.createMany({ data: deletedSlotIds.map((slotId) => ({ userId, slotId })), skipDuplicates: true }),
      ])
      deleted = res.count
    }

    await prisma.content.deleteMany({ where: { userId, contentType: { startsWith: "Inspo" } } })

    // Only Posts-tab boxes belong in the planner: drop rows for drafts/stories that are in the feed
    const excluded = ids(request?.excludedSlotIds)
    if (excluded.length) await prisma.content.deleteMany({ where: { userId, slotId: { in: excluded } } })
    // Planner pages without a box in the feed are fine (e.g. planned but no photo yet): they're left alone.

    const LOCATIONS = ["grid", "drafts", "story"] as const
    const tombstoned = new Set(
      (await prisma.deletedFeedSlot.findMany({ where: { userId, slotId: { in: slots.map((s) => String(s?.slotId)) } }, select: { slotId: true } })).map((t) => t.slotId),
    )
    const clean: FeedSlotSync[] = slots.slice(0, MAX_SYNC_SLOTS).flatMap((s) => {
      const slotId = cleanText(s?.slotId, 120)
      if (!slotId || tombstoned.has(slotId) || s.location === "inspo" || String(s.contentType ?? "").startsWith("Inspo")) return []
      return [{
        slotId,
        contentType: cleanText(s.contentType, 20) ?? "Post",
        location: LOCATIONS.includes(s.location as any) ? s.location : "grid",
        title: cleanText(s.title) ?? "",
        mediaUrls: cleanMediaUrls(s.mediaUrls),
        parentSlotId: cleanText(s.parentSlotId, 120),
        isFolder: Boolean(s.isFolder),
        titleChanged: Boolean(s.titleChanged),
      }]
    })
    if (clean.length === 0) return { created: 0, updated: 0, deleted, addToFeed: [], textForFeed: [] }

    // Parents before children so sub-items can be linked in the same pass.
    clean.sort((a, b) => Number(Boolean(a.parentSlotId)) - Number(Boolean(b.parentSlotId)))

    const existing = await prisma.content.findMany({
      where: { userId, slotId: { in: clean.map((s) => s.slotId) } },
      include: { media: true },
    })
    const bySlot = new Map(existing.map((c) => [c.slotId!, c]))
    // Every record linked to the feed, to tell feed-made parent links from ones set by hand in the planner.
    const feedRecords = await prisma.content.findMany({
      where: { userId, slotId: { not: null } },
      select: { id: true, slotId: true, parentId: true },
    })
    const idBySlot = new Map(feedRecords.map((r) => [r.slotId!, r.id]))
    const feedRecordIds = new Set(feedRecords.map((r) => r.id))
    const topLevel = new Set(feedRecords.filter((r) => !r.parentId).map((r) => r.id))
    let created = 0
    let updated = 0
    const textForFeed: { slotId: string; title: string }[] = []
    const parentsWithChildren = new Set(
      (await prisma.content.findMany({ where: { userId, parentId: { not: null } }, select: { parentId: true } })).map((r) => r.parentId!),
    )

    // New boxes are created in bulk — parents first, so sub-items can point at them — instead of one
    // query per box, which timed out on large feeds.
    const fresh = clean.filter((s) => !bySlot.has(s.slotId))
    for (const pass of [fresh.filter((s) => !s.parentSlotId), fresh.filter((s) => s.parentSlotId)]) {
      for (let i = 0; i < pass.length; i += 200) {
        const chunk = pass.slice(i, i + 200)
        const rows = await prisma.content.createManyAndReturn({
          data: chunk.map((slot) => {
            const parentCandidate = slot.parentSlotId ? idBySlot.get(slot.parentSlotId) : undefined
            const category = categoryForFeedSlot(slot)
            return {
              userId,
              slotId: slot.slotId,
              contentType: slot.contentType,
              parentId: parentCandidate && topLevel.has(parentCandidate) ? parentCandidate : null,
              title: slot.title || defaultFeedTitle(slot),
              status: statusForFeedSlot(slot),
              categories: category ? [category] : [],
            }
          }),
          skipDuplicates: true,
          select: { id: true, slotId: true, parentId: true },
        })
        const bySlotId = new Map(chunk.map((s) => [s.slotId, s]))
        const media = rows.flatMap((r) => (bySlotId.get(r.slotId!)?.mediaUrls ?? []).map((url, position) => ({ contentId: r.id, url, position })))
        if (media.length) await prisma.contentMedia.createMany({ data: media })
        for (const r of rows) {
          idBySlot.set(r.slotId!, r.id)
          feedRecordIds.add(r.id)
          if (!r.parentId) topLevel.add(r.id)
        }
        created += rows.length
      }
    }

    // Existing boxes: only touch the ones that actually changed
    for (const slot of clean) {
      const current = bySlot.get(slot.slotId)
      if (!current) continue
      const parentCandidate = slot.parentSlotId ? idBySlot.get(slot.parentSlotId) : undefined
      const parentId = parentCandidate && topLevel.has(parentCandidate) ? parentCandidate : null

      const data: Prisma.ContentUncheckedUpdateInput = {}
      if (current.contentType !== slot.contentType) data.contentType = slot.contentType
      // The box's text and the planner title are always the same
      if (slot.title && current.title !== slot.title) data.title = slot.title
      else if (!slot.title && !DEFAULT_TITLE.test(current.title)) textForFeed.push({ slotId: slot.slotId, title: current.title })
      const autoStatus = statusForFeedSlot(slot)
      if (AUTO_STATUSES.includes(current.status) && autoStatus !== current.status && autoStatus !== "To Board") data.status = autoStatus
      // Follow folder moves in the feed, but keep parents assigned by hand to planner-only records.
      const parentIsFromFeed = !current.parentId || feedRecordIds.has(current.parentId)
      if (parentIsFromFeed && current.parentId !== parentId && current.id !== parentId && !(parentId && parentsWithChildren.has(current.id))) {
        data.parentId = parentId
      }

      const currentUrls = [...current.media].sort((a, b) => a.position - b.position).map((m) => m.url)
      const mediaChanged = currentUrls.join("\n") !== slot.mediaUrls.join("\n")
      if (!mediaChanged && !Object.keys(data).length) continue
      await prisma.$transaction([
        ...(mediaChanged
          ? [
              prisma.contentMedia.deleteMany({ where: { contentId: current.id } }),
              prisma.contentMedia.createMany({ data: slot.mediaUrls.map((url, position) => ({ contentId: current.id, url, position })) }),
            ]
          : []),
        ...(Object.keys(data).length ? [prisma.content.update({ where: { id: current.id }, data })] : []),
      ])
      updated++
    }

    const addToFeed: FeedBox[] = []

    return { created, updated, deleted, addToFeed, textForFeed }
  })
}
