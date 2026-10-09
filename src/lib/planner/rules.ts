// Automatic scheduling rules, applied identically in the browser (instant UI) and on the server.

import { addDaysISO, datePart } from "./dates"
import type { ContentDTO, ContentPatch } from "./types"

/** Story-only content is edited 3 days before it goes up; anything that is also a post or reel, a week before. */
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
 * - an item waiting in "To Schedule" moves to "To Edit" once it has a post date;
 * - an item in "To Edit" with neither an edit date nor a post date goes back to "To Schedule".
 */
export function withScheduleRules(item: Pick<ContentDTO, "status" | "categories" | "post" | "edit" | "edited">, patch: ContentPatch): ContentPatch {
  const next: ContentPatch = { ...patch }
  const categories = patch.categories ?? item.categories
  const post = patch.post ?? item.post

  if (("post" in patch || "categories" in patch) && post.start && !("edit" in patch)) {
    const edit = autoEditDate(post.start, categories)
    if (edit !== item.edit.start || item.edit.end) next.edit = { start: edit, end: null }
  }

  const edit = next.edit ?? item.edit
  let status = next.status ?? patch.status ?? item.status
  let edited = next.edited ?? patch.edited ?? item.edited

  // If user explicitly checked Edited
  if (patch.edited === true && !("status" in patch)) {
    next.status = "Ready to Post"
    status = "Ready to Post"
  }
  
  // If user explicitly changed status to Ready to Post
  if (patch.status === "Ready to Post" && !("edited" in patch)) {
    next.edited = true
    edited = true
  }

  // "To Schedule" → "To Edit" once it has a date to post; "To Edit" with no edit and no post date → "To Schedule"
  const postNow = next.post ?? post
  if (!("status" in next) && !("status" in patch)) {
    if (status === "To Schedule" && postNow.start) next.status = "To Edit"
    else if (status === "To Edit" && !edit.start && !postNow.start) next.status = "To Schedule"
  }

  return next
}
