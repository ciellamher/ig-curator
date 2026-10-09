"use server"

import { prisma } from "@/lib/prisma"
import type { QuickLink } from "@prisma/client"
import type { QuickLinkDTO, QuickLinkInput } from "@/lib/planner/types"
import { requireUserId, run, type Result } from "@/lib/planner/server"

function toDTO(l: QuickLink): QuickLinkDTO {
  return { id: l.id, name: l.name, url: l.url, text: l.text, createdAt: l.createdAt.toISOString() }
}

function clean(input: QuickLinkInput) {
  const name = String(input.name ?? "").trim().slice(0, 120)
  if (!name) throw new Error("Name is required")
  let url: URL
  try {
    url = new URL(String(input.url ?? "").trim())
  } catch {
    throw new Error("Enter a full link starting with https://")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http(s) links are allowed")
  return { name, url: url.toString(), text: String(input.text ?? "").trim().slice(0, 500) }
}

export async function listQuickLinks(): Promise<Result<QuickLinkDTO[]>> {
  return run(async () => {
    const userId = await requireUserId()
    const rows = await prisma.quickLink.findMany({ where: { userId }, orderBy: { name: "asc" } })
    return rows.map(toDTO)
  })
}

export async function createQuickLink(input: QuickLinkInput): Promise<Result<QuickLinkDTO>> {
  return run(async () => {
    const userId = await requireUserId()
    return toDTO(await prisma.quickLink.create({ data: { ...clean(input), userId } }))
  })
}

export async function updateQuickLink(id: string, input: QuickLinkInput): Promise<Result<QuickLinkDTO>> {
  return run(async () => {
    const userId = await requireUserId()
    const existing = await prisma.quickLink.findFirst({ where: { id, userId } })
    if (!existing) throw new Error("This link no longer exists")
    return toDTO(await prisma.quickLink.update({ where: { id }, data: clean(input) }))
  })
}

export async function deleteQuickLink(id: string): Promise<Result<{ id: string }>> {
  return run(async () => {
    const userId = await requireUserId()
    const { count } = await prisma.quickLink.deleteMany({ where: { id, userId } })
    if (count === 0) throw new Error("This link no longer exists")
    return { id }
  })
}
