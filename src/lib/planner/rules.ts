// Automatic scheduling rules, applied identically in the browser (instant UI) and on the server.

import { addDaysISO, datePart } from "./dates"
import type { ContentDTO, ContentPatch } from "./types"

/** Stories are edited 3 days before they go up; posts and reels a week before. */
export const STORY_EDIT_LEAD_DAYS = 3
export const POST_EDIT_LEAD_DAYS = 7

export function editLeadDays(categories: string[]): number {
  const storyOnly = categories.includes("Story") && !categories.includes("Post") && !categories.includes("Reels")
  return storyOnly ? STORY_EDIT_LEAD_DAYS : POST_EDIT_LEAD_DAYS
}

/** Edit date implied by a Post Now date. */
export function autoEditDate(postStart: string | null, categories: string[]): string | null {
  return postStart ? addDaysISO(datePart(postStart), -editLeadDays(categories)) : null
}

/**
 * Adds the automatic changes a patch implies:
 * - setting Post Now (or changing categories) moves Edit Date to 3 days (Story) / 1 week (Post, Reels) before it;
 * - an item waiting in "To Schedule" moves to "To Edit" once it has an edit date.
 */
export function withScheduleRules(item: Pick<ContentDTO, "status" | "categories" | "post" | "edit">, patch: ContentPatch): ContentPatch {
  const next: ContentPatch = { ...patch }
  const categories = patch.categories ?? item.categories
  const post = patch.post ?? item.post

  if (("post" in patch || "categories" in patch) && post.start && !("edit" in patch)) {
    const edit = autoEditDate(post.start, categories)
    if (edit !== item.edit.start || item.edit.end) next.edit = { start: edit, end: null }
  }

  const edit = next.edit ?? item.edit
  const status = patch.status ?? item.status
  if (!("status" in patch) && status === "To Schedule" && edit.start) next.status = "To Edit"

  return next
}
