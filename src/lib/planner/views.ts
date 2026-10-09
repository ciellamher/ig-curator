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

// ---- Ready to Post gallery ("Available Posts") ----

/** Unscheduled pool: (In progress OR Ready to Post) AND not a batch AND Post Now empty. */
export function isAvailablePost(item: ContentDTO): boolean {
  const inPool = statusGroup(item.status) === "In progress" || item.status === "Ready to Post"
  return inPool && !isBatchTitle(item) && !item.post.start
}

export type ParentGroup = { item: ContentDTO; matches: boolean; children: ContentDTO[] }

/**
 * Parent-focused grouping: matching records grouped under their top-level parent. A parent that doesn't match
 * itself is still returned for context (matches = false) when at least one of its children does.
 */
export function groupByParent(items: ContentDTO[], predicate: (i: ContentDTO) => boolean, sort: Comparator[]): ParentGroup[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  const groups = new Map<string, ParentGroup>()

  for (const item of items) {
    if (!predicate(item)) continue
    const parent = item.parentId ? byId.get(item.parentId) : undefined
    if (!parent) {
      const existing = groups.get(item.id)
      if (existing) existing.matches = true
      else groups.set(item.id, { item, matches: true, children: [] })
      continue
    }
    const group = groups.get(parent.id) ?? { item: parent, matches: predicate(parent), children: [] }
    group.children.push(item)
    groups.set(parent.id, group)
  }

  const ordered = sortBy([...groups.values()].map((g) => g.item), ...sort)
  return ordered.map((p) => {
    const g = groups.get(p.id)!
    return { ...g, children: sortBy(g.children, ...sort) }
  })
}

export function availablePostsView(items: ContentDTO[]): ParentGroup[] {
  return groupByParent(items, isAvailablePost, [byTitle, byShoot, byStatus])
}

// ---- Outfits to Prep ----

/** Clothing status set and not in the Complete group (Buy Clothes, Ordered, Delivered). */
export function needsOutfitPrep(item: ContentDTO): boolean {
  return !!item.clothingStatus && clothingGroup(item.clothingStatus) !== "Complete"
}

export function outfitsView(items: ContentDTO[]): ParentGroup[] {
  return groupByParent(items, needsOutfitPrep, [byShoot])
}

// ---- Calendars ----

/** Parent-focused calendar (Edit): top-level records, plus children whose parent isn't itself on the calendar. */
export function parentFocused(items: ContentDTO[], hasDate: (i: ContentDTO) => boolean): ContentDTO[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  return items.filter((i) => {
    if (!hasDate(i)) return false
    const parent = i.parentId ? byId.get(i.parentId) : undefined
    return !parent || !hasDate(parent)
  })
}

// ---- Parent assignment ----

/** Valid parents for an item: not itself, not one of its descendants (prevents cycles), and one level deep. */
export function parentCandidates(items: ContentDTO[], itemId: string): ContentDTO[] {
  const hasChildren = items.some((i) => i.parentId === itemId)
  if (hasChildren) return []
  return items.filter((i) => i.id !== itemId && !i.parentId)
}
