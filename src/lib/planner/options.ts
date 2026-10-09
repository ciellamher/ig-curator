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

// Monochrome badges: progress reads from outline → grey fill → solid black.
const OUTLINE = "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-300"
const LIGHT = "bg-zinc-100 text-zinc-800"
const MID = "bg-zinc-300 text-zinc-900"
const STRONG_OUTLINE = "bg-white text-zinc-950 ring-1 ring-inset ring-zinc-950"
const SOLID = "bg-zinc-950 text-white"
const MUTED_SOLID = "bg-zinc-500 text-white"

export const STATUS_STYLES: Record<string, string> = {
  "To Board": OUTLINE,
  "To Buy/Plan Clothes": OUTLINE,
  "To Planner": OUTLINE,
  "To Shoot": OUTLINE,
  "To Schedule": LIGHT,
  "To Edit": MID,
  "Ready to Post": STRONG_OUTLINE,
  Posted: SOLID,
  Worn: MUTED_SOLID,
}

export const CLOTHING_STYLES: Record<string, string> = {
  "Buy Clothes": OUTLINE,
  Ordered: LIGHT,
  Delivered: MID,
  Refunded: SOLID,
}

export const CATEGORY_STYLES: Record<string, string> = Object.fromEntries(
  ["Facebook", "Story", "Post", "Reels", "Highlights", "Locket"].map((c) => [c, LIGHT]),
)

export const GROUP_DOT: Record<StatusGroup, string> = {
  "To-do": "bg-zinc-300",
  "In progress": "bg-zinc-500",
  Complete: "bg-zinc-950",
}
