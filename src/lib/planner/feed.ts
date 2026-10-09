// How feed slots (the mock Instagram grid) map onto content records.

import type { Category, Status } from "./options"
import type { FeedSlotSync } from "./types"

/** Status a slot gets when it first lands in the database, based on where it was added in the feed. */
export function statusForFeedSlot(slot: Pick<FeedSlotSync, "location" | "mediaUrls">): Status {
  if (slot.location === "drafts") return "To Board"
  return slot.mediaUrls.length > 0 ? "To Edit" : "To Shoot"
}

/** Statuses the feed may still move automatically; anything later was set by hand and is left alone. */
export const AUTO_STATUSES: readonly string[] = ["To Board", "To Shoot"]

export function categoryForFeedSlot(slot: Pick<FeedSlotSync, "location" | "contentType">): Category {
  if (slot.location === "story" || slot.contentType === "Story") return "Story"
  if (slot.contentType === "Reel") return "Reels"
  return "Post"
}
