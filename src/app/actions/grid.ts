"use server"

import { prisma } from "@/lib/prisma"
import { requireUserId, run, type Result } from "@/lib/planner/server"
import type { SlotItem } from "@/types"

export type CloudGrid = { items: SlotItem[]; profile: unknown | null; updatedAt: string }

const MAX_GRID_BYTES = 20 * 1024 * 1024

/** Saves the feed (boxes, folders, photo links) and profile so it's backed up and available on every device. */
export async function syncGridToCloud(items: SlotItem[], profile?: unknown): Promise<Result<{ updatedAt: string }>> {
  return run(async () => {
    const userId = await requireUserId()
    if (!Array.isArray(items)) throw new Error("Invalid feed")
    const itemsData = JSON.stringify(items)
    if (itemsData.length > MAX_GRID_BYTES) throw new Error("Feed is too large to back up")
    const profileData = profile ? JSON.stringify(profile) : undefined
    const row = await prisma.userGrid.upsert({
      where: { userId },
      update: { itemsData, ...(profileData ? { profileData } : {}) },
      create: { userId, itemsData, profileData: profileData ?? null },
    })
    return { updatedAt: row.updatedAt.toISOString() }
  })
}

export async function fetchGridFromCloud(): Promise<Result<CloudGrid | null>> {
  return run(async () => {
    const userId = await requireUserId()
    const grid = await prisma.userGrid.findUnique({ where: { userId } })
    if (!grid) return null
    return {
      items: JSON.parse(grid.itemsData),
      profile: grid.profileData ? JSON.parse(grid.profileData) : null,
      updatedAt: grid.updatedAt.toISOString(),
    }
  })
}
