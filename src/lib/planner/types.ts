import type { DateField, Schedule } from "./dates"

export type Location = {
  name: string
  address?: string
  latitude?: number | null
  longitude?: number | null
  placeId?: string
}

export type ContentMediaDTO = { id: string; url: string; position: number }

export type ContentDTO = {
  id: string
  parentId: string | null
  title: string
  status: string
  categories: string[]
  edited: boolean
  clothingStatus: string | null
  /** ISO timestamps of when clothing was marked Ordered / Delivered (delivery starts the return window). */
  orderedAt: string | null
  deliveredAt: string | null
  /** SHEIN order this batch belongs to. */
  orderId: string | null
  shoot: Schedule
  edit: Schedule
  post: Schedule
  pinterestUrl: string | null
  location: Location | null
  body: string
  slotId: string | null
  contentType: string | null
  media: ContentMediaDTO[]
  createdAt: string
  updatedAt: string
}

export type ContentPatch = Partial<
  Pick<
    ContentDTO,
    | "title"
    | "status"
    | "categories"
    | "edited"
    | "clothingStatus"
    | "shoot"
    | "edit"
    | "post"
    | "pinterestUrl"
    | "location"
    | "body"
    | "parentId"
  >
>

export type OrderDTO = {
  id: string
  name: string
  orderedAt: string | null
  deliveredAt: string | null
  returnedAt: string | null
  createdAt: string
}

export type OrderStage = "ordered" | "delivered" | "returned" | "reset"

export type QuickLinkDTO = { id: string; name: string; url: string; text: string; createdAt: string }
export type QuickLinkInput = Pick<QuickLinkDTO, "name" | "url" | "text">

/** Minimal projection of a feed slot sent to the server for syncing. */
export type FeedSlotSync = {
  slotId: string
  contentType: string
  location: "grid" | "drafts" | "story" | "inspo"
  title: string
  mediaUrls: string[]
  /** Feed folder (story folder / inspo board) this item lives in; becomes its parent record. */
  parentSlotId: string | null
  /** Story folders and inspo boards become parent records. */
  isFolder: boolean
  /** The box's text changed in the feed since the last sync, so the planner title should follow. */
  titleChanged?: boolean
}

export type FeedSyncRequest = {
  slots: FeedSlotSync[]
  /** Boxes deleted in the feed since the last sync. */
  deletedSlotIds: string[]
  /** Boxes that came back (e.g. undo) and may have been recorded as deleted. */
  restoredSlotIds: string[]
}

/** Fired by the planner when records linked to feed boxes are deleted; detail: slot ids. */
export const PLANNER_DELETED_EVENT = "planner:deleted"
/** Fired by the planner when a feed-linked record is renamed; detail: { slotId, title }. */
export const PLANNER_TITLE_EVENT = "planner:title"

/** Window event fired when syncing the feed to the database fails. */
export const PLANNER_SYNC_ERROR_EVENT = "planner:sync-error"

export const DATE_FIELDS: { field: DateField; label: string }[] = [
  { field: "shoot", label: "Shoot Date" },
  { field: "edit", label: "Edit Date" },
  { field: "post", label: "Post Now" },
]

/** Window event fired when the feed has written to the content database. */
export const PLANNER_REFRESH_EVENT = "planner:refresh"

/** Fired by the planner when an item is opened, to highlight its box in the feed; detail: slot id. */
export const PLANNER_FOCUS_EVENT = "planner:focus"
