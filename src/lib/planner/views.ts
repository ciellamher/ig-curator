// Filter and sort rules for every dashboard view. All views derive from the same ContentDTO list,
// so an edit to a record shows up everywhere it qualifies.

import { compareNullsLast } from "./dates"
import { clothingGroup, statusGroup, statusRank } from "./options"
import type { ContentDTO } from "./types"

type Comparator = (a: ContentDTO, b: ContentDTO) => number

/** Case-insensitive "title does not contain batch". */
export function isBatchTitle(item: ContentDTO): boolean {
  return item.title.toLowerCase().includes("batch")
}

export const byStatus: Comparator = (a, b) => statusRank(a.status) - statusRank(b.status)
export const byTitle: Comparator = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
export const byShoot: Comparator = (a, b) => compareNullsLast(a.shoot.start, b.shoot.start)
export const byEdit: Comparator = (a, b) => compareNullsLast(a.edit.start, b.edit.start)
export const byPost: Comparator = (a, b) => compareNullsLast(a.post.start, b.post.start)

export function sortBy(items: ContentDTO[], ...comparators: Comparator[]): ContentDTO[] {
  return [...items].sort((a, b) => {
    for (const c of comparators) {
      const r = c(a, b)
      if (r !== 0) return r
    }
    return 0
  })
}

export function matchesSearch(item: ContentDTO, query: string): boolean {
  const q = query.trim().toLowerCase()
  return !q || item.title.toLowerCase().includes(q)
}

export type EditedFilter = "any" | "yes" | "no"

export function matchesEdited(item: ContentDTO, filter: EditedFilter): boolean {
  return filter === "any" || item.edited === (filter === "yes")
}

// ---- Content table tabs (parents and sub-items are independent rows) ----

/** To Shoot: every To-do status, excluding batch titles. Sorted by status order, Shoot Date, Title. */
export function toShootView(items: ContentDTO[]): ContentDTO[] {
  return sortBy(
    items.filter((i) => statusGroup(i.status) === "To-do" && !isBatchTitle(i)),
    byStatus,
    byShoot,
    byTitle,
  )
}

/** To Edit: both In progress statuses, only unedited, excluding batch titles. Sorted by status order, Edit Date, Post Now. */
export function toEditView(items: ContentDTO[]): ContentDTO[] {
  return sortBy(
    items.filter((i) => statusGroup(i.status) === "In progress" && !i.edited && !isBatchTitle(i)),
    byStatus,
    byEdit,
    byPost,
  )
}

/**
 * To Post: Status = Ready to Post. The original also filters on Edited with no recorded value,
 * so the Edited filter defaults to "any" and is user-controlled.
 */
export function toPostView(items: ContentDTO[], edited: EditedFilter = "any"): ContentDTO[] {
  return sortBy(
    items.filter((i) => i.status === "Ready to Post" && matchesEdited(i, edited)),
    byPost,
    byTitle,
  )
}

// ---- Ready to Post gallery ----

/** Ready to Post: content waiting to be scheduled ("To Schedule"). Drag a card onto the calendar to schedule it. */
export function isAvailablePost(item: ContentDTO): boolean {
  return item.status === "To Schedule" && !isBatchTitle(item)
}

export function availablePostsView(items: ContentDTO[]): ContentDTO[] {
  return sortBy(items.filter(isAvailablePost), byShoot, byTitle)
}

// ---- Outfits to Prep ----

/** Clothing still in progress (Buy Clothes, Ordered, Delivered), or content whose status is "To Buy/Plan Clothes". */
export function needsOutfitPrep(item: ContentDTO): boolean {
  const clothingOpen = !!item.clothingStatus && clothingGroup(item.clothingStatus) !== "Complete"
  return clothingOpen || item.status === "To Buy/Plan Clothes"
}

/** Shoot date, falling back to the batch's (an item's parent) when the item has none of its own. */
export function shootDateOf(item: ContentDTO, byId: Map<string, ContentDTO>): string | null {
  if (item.shoot.start) return item.shoot.start
  const parent = item.parentId ? byId.get(item.parentId) : undefined
  return parent?.shoot.start ?? null
}

export function outfitsView(items: ContentDTO[], all: ContentDTO[] = items): ContentDTO[] {
  const byId = new Map(all.map((i) => [i.id, i]))
  return sortBy(
    items.filter(needsOutfitPrep),
    (a, b) => compareNullsLast(shootDateOf(a, byId), shootDateOf(b, byId)),
    byTitle,
  )
}

// ---- Batches ----

/** Batches: top-level items titled "batch…" or that already hold posts. (Posts in a SHEIN order aren't batches.) */
export function batchCandidates(items: ContentDTO[]): ContentDTO[] {
  return items.filter((i) => !i.parentId && (isBatchTitle(i) || items.some((c) => c.parentId === i.id)))
}

/** Batches an item can be put in: never itself, and an item that holds posts can't go inside another (no cycles). */
export function batchOptionsFor(items: ContentDTO[], itemId: string): ContentDTO[] {
  if (items.some((i) => i.parentId === itemId)) return []
  return batchCandidates(items).filter((b) => b.id !== itemId)
}
