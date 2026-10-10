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
  hiddenFromFeed: boolean
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
  extraSlots: Record<string, string> | null
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
    | "hiddenFromFeed"
    | "clothingStatus"
    | "shoot"
    | "edit"
    | "post"
    | "pinterestUrl"
    | "location"
    | "body"
    | "parentId"
  >
> & { slotId?: string | null; contentType?: string | null; extraSlots?: Record<string, string> | null }

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
  /** Whether the box should be hidden from the grid view. */
  isHiddenFromGrid?: boolean
  /** The box's text changed in the feed since the last sync, so the planner title should follow. */
  titleChanged?: boolean
}

export type FeedSyncRequest = {
  slots: FeedSlotSync[]
  /** Boxes deleted in the feed since the last sync. */
  deletedSlotIds: string[]
  /** Boxes that came back (e.g. undo) and may have been recorded as deleted. */
  restoredSlotIds: string[]
  /** Boxes in this feed that aren't planner content (drafts, stories): their planner rows are removed. */
  excludedSlotIds?: string[]
  /** Every box in this feed, so untouched rows for boxes that no longer exist can be cleaned up. */
  presentSlotIds?: string[]
}

/** Fired by the planner when records linked to feed boxes are deleted; detail: slot ids. */
export const PLANNER_DELETED_EVENT = "planner:deleted"
/** Fired by the planner when a feed-linked record is renamed; detail: { slotId, title }. */
export const PLANNER_TITLE_EVENT = "planner:title"

/** Fired by the planner when a feed-linked record's hiddenFromFeed status changes; detail: { slotId, hidden }. */
export const PLANNER_HIDDEN_EVENT = "planner:hidden"

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

export type FeedBox = { slotId: string; title: string; contentType: string }

/** Fired by the planner when it creates content that needs a box in the Posts grid; detail: FeedBox[]. */
export const FEED_ADD_EVENT = "feed:add"

/** Fired by the feed when a box is selected, so the planner can show its row; detail: slot id. */
export const FEED_SELECT_EVENT = "feed:select"

/** Fired by the planner when photos are added to a page, so the feed shows them; detail: FeedAttach. */
export const FEED_ATTACH_EVENT = "feed:attach"
export type FeedAttach = {
  slotId: string
  urls: string[]
  title: string
  contentType: string
  /** Only create the box if it's missing (nothing is added to a box that exists). */
  ensure?: boolean
  /** Created hidden from the grid. */
  hidden?: boolean
}

/** Fired by a story page when photos are removed: its stories with those photos leave the folder. */
export const FEED_REMOVE_PHOTOS_EVENT = "feed:remove-photos"
export type FeedRemovePhotos = { folderId: string; urls: string[] }

/** Fired by the planner with the pages that have the Facebook category, for the phone's Facebook tab. */
export const PLANNER_FACEBOOK_EVENT = "planner:facebook"
export type FacebookPage = { id: string; title: string; status: string; post: string | null; urls: string[] }

/** Fired by the planner with the story folders of Posted pages: they leave the Stories tab (kept, not deleted). */
export const PLANNER_POSTED_FOLDERS_EVENT = "planner:posted-folders"

/** Fired by the planner with every feed box that belongs to a page (those are edited in their page). */
export const PLANNER_SLOTS_EVENT = "planner:slots"

/** Fired by an open planner page with the spot where its feed box's editor goes (null when the page closes). */
export const PAGE_EDITOR_EVENT = "planner:page-editor"
export type PageEditorHost = { slotId: string; el: HTMLElement } | null

/** Fired by the planner when a page is opened, so the feed opens that box's editor; detail: slot id. */
export const PLANNER_OPEN_EVENT = "planner:open"
