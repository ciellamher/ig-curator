// How feed slots (the mock Instagram grid) map onto content records.

import type { Category, Status } from "./options"
import type { FeedSlotSync } from "./types"

/** Status a slot gets when it first lands in the database, based on where it was added in the feed. */
export function statusForFeedSlot(slot: Pick<FeedSlotSync, "location" | "mediaUrls" | "isFolder">): Status {
  if (slot.location === "drafts" || slot.location === "inspo") return "To Board"
  if (slot.isFolder) return "To Shoot"
  return slot.mediaUrls.length > 0 ? "To Edit" : "To Shoot"
}

/** Statuses the feed may still move automatically; anything later was set by hand and is left alone. */
export const AUTO_STATUSES: readonly string[] = ["To Board", "To Shoot"]

export function categoryForFeedSlot(slot: Pick<FeedSlotSync, "location" | "contentType">): Category | null {
  if (slot.location === "inspo") return null
  if (slot.location === "story" || slot.contentType === "Story") return "Story"
  if (slot.contentType === "Reel") return "Reels"
  return "Post"
}

/** Placeholder title for a slot with no text yet. */
export function defaultFeedTitle(slot: Pick<FeedSlotSync, "location" | "contentType" | "isFolder">): string {
  if (slot.isFolder) return slot.location === "inspo" ? "Untitled Inspo Board" : "Untitled Story Folder"
  if (slot.location === "inspo") return "Untitled Inspo"
  return `Untitled ${slot.contentType}`
}

/** Where a planner page shows in the feed, from its categories: Post → grid, Reels → reel, Story → story folder. */
export function feedKindFor(categories: string[]): "Post" | "Reel" | "StoryFolder" | null {
  if (categories.includes("Story")) return "StoryFolder"
  if (categories.includes("Reels")) return "Reel"
  if (categories.includes("Post")) return "Post"
  return null
}

/** Post, Reels and Story decide where a page goes in the feed, so picking one replaces the others. */
export const FEED_PLACEMENTS = ["Post", "Reels", "Story"]

export function toggleCategory(current: string[], category: string): string[] {
  if (current.includes(category)) return current.filter((c) => c !== category)
  const kept = FEED_PLACEMENTS.includes(category) ? current.filter((c) => !FEED_PLACEMENTS.includes(c)) : current
  return [...kept, category]
}
