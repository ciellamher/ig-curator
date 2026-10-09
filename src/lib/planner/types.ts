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
  /** ISO timestamp of when clothing was marked Ordered (starts the return window). */
  orderedAt: string | null
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

export type QuickLinkDTO = { id: string; name: string; url: string; text: string; createdAt: string }
export type QuickLinkInput = Pick<QuickLinkDTO, "name" | "url" | "text">

/** Minimal projection of a feed slot sent to the server for syncing. */
export type FeedSlotSync = {
  slotId: string
  contentType: string
  location: "grid" | "drafts" | "story"
  title: string
  mediaUrls: string[]
}

export const DATE_FIELDS: { field: DateField; label: string }[] = [
  { field: "shoot", label: "Shoot Date" },
  { field: "edit", label: "Edit Date" },
  { field: "post", label: "Post Now" },
]
