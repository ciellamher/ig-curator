// Select options, groups and badge colours, mirroring the Notion content database.

export type StatusGroup = "To-do" | "In progress" | "Complete"

export const STATUS_OPTIONS = [
  { name: "To Board", group: "To-do" },
  { name: "To Buy/Plan Clothes", group: "To-do" },
  { name: "To Planner", group: "To-do" },
  { name: "To Shoot", group: "To-do" },
  { name: "To Schedule", group: "In progress" },
  { name: "To Edit", group: "In progress" },
  { name: "Ready to Post", group: "Complete" },
  { name: "Posted", group: "Complete" },
  { name: "Worn", group: "Complete" },
] as const satisfies readonly { name: string; group: StatusGroup }[]

export type Status = (typeof STATUS_OPTIONS)[number]["name"]
export const STATUS_NAMES = STATUS_OPTIONS.map((s) => s.name) as Status[]
export const DEFAULT_STATUS: Status = "To Board"

export const CLOTHING_OPTIONS = [
  { name: "Buy Clothes", group: "To-do" },
  { name: "Ordered", group: "In progress" },
  { name: "Delivered", group: "In progress" },
  { name: "Refunded", group: "Complete" },
] as const satisfies readonly { name: string; group: StatusGroup }[]

export type ClothingStatus = (typeof CLOTHING_OPTIONS)[number]["name"]
export const CLOTHING_NAMES = CLOTHING_OPTIONS.map((c) => c.name) as ClothingStatus[]

export const CATEGORY_OPTIONS = ["Facebook", "Story", "Post", "Reels", "Highlights", "Locket"] as const
export type Category = (typeof CATEGORY_OPTIONS)[number]

export function statusGroup(status: string): StatusGroup | null {
  return STATUS_OPTIONS.find((s) => s.name === status)?.group ?? null
}

export function clothingGroup(status: string | null): StatusGroup | null {
  return CLOTHING_OPTIONS.find((c) => c.name === status)?.group ?? null
}

/** Position in the configured option order (unknown values sort last). */
export function statusRank(status: string): number {
  const i = STATUS_NAMES.indexOf(status as Status)
  return i === -1 ? STATUS_NAMES.length : i
}

// Badge colours. Unlisted Notion colours fall back to neutral grey.
const BLUE = "bg-sky-100 text-sky-800"
const PURPLE = "bg-violet-100 text-violet-800"
const YELLOW = "bg-amber-100 text-amber-800"
const GREEN = "bg-emerald-100 text-emerald-800"
const PINK = "bg-pink-100 text-pink-800"
const GRAY = "bg-zinc-200/70 text-zinc-700"
const NEUTRAL = "bg-zinc-100 text-zinc-600"

export const STATUS_STYLES: Record<string, string> = {
  "To Board": NEUTRAL,
  "To Buy/Plan Clothes": NEUTRAL,
  "To Planner": NEUTRAL,
  "To Shoot": NEUTRAL,
  "To Schedule": BLUE,
  "To Edit": BLUE,
  "Ready to Post": YELLOW,
  Posted: GREEN,
  Worn: PINK,
}

export const CLOTHING_STYLES: Record<string, string> = {
  "Buy Clothes": NEUTRAL,
  Ordered: BLUE,
  Delivered: BLUE,
  Refunded: GREEN,
}

export const CATEGORY_STYLES: Record<string, string> = {
  Facebook: BLUE,
  Highlights: BLUE,
  Story: PURPLE,
  Post: YELLOW,
  Reels: GRAY,
  Locket: NEUTRAL,
}

export const GROUP_DOT: Record<StatusGroup, string> = {
  "To-do": "bg-zinc-400",
  "In progress": "bg-sky-500",
  Complete: "bg-emerald-500",
}
