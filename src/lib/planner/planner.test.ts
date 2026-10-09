import { describe, expect, it } from "vitest"
import { clothingAlert, clothingTimeline } from "./clothing"
import { addDaysISO, formatDate, moveSchedule, scheduleCovers, todayISO } from "./dates"
import { categoryForFeedSlot, statusForFeedSlot } from "./feed"
import { STATUS_NAMES } from "./options"
import type { ContentDTO } from "./types"
import {
  availablePostsView,
  isAvailablePost,
  outfitsView,
  parentCandidates,
  parentFocused,
  toEditView,
  toPostView,
  toShootView,
} from "./views"

let seq = 0
function item(overrides: Partial<ContentDTO> = {}): ContentDTO {
  seq++
  return {
    id: overrides.id ?? `id-${seq}`,
    parentId: null,
    title: `Item ${seq}`,
    status: "To Board",
    categories: [],
    edited: false,
    clothingStatus: null,
    orderedAt: null,
    shoot: { start: null, end: null },
    edit: { start: null, end: null },
    post: { start: null, end: null },
    pinterestUrl: null,
    location: null,
    body: "",
    slotId: null,
    contentType: null,
    media: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

const ids = (list: { id: string }[]) => list.map((i) => i.id)

describe("To Shoot", () => {
  it("includes every To-do status, not only 'To Shoot'", () => {
    const todo = ["To Board", "To Buy/Plan Clothes", "To Planner", "To Shoot"].map((status) => item({ status }))
    const others = [item({ status: "To Edit" }), item({ status: "Posted" })]
    expect(ids(toShootView([...others, ...todo]))).toEqual(ids(todo))
  })

  it("excludes batch titles case-insensitively", () => {
    const rows = toShootView([item({ title: "BATCH A" }), item({ title: "my Batch" }), item({ id: "keep", title: "Notion Box" })])
    expect(ids(rows)).toEqual(["keep"])
  })

  it("sorts by configured status order, then Shoot Date (nulls last), then title", () => {
    const a = item({ id: "a", status: "To Shoot", shoot: { start: "2026-03-01", end: null } })
    const b = item({ id: "b", status: "To Board", shoot: { start: null, end: null }, title: "Zed" })
    const c = item({ id: "c", status: "To Board", shoot: { start: "2026-03-05", end: null } })
    const d = item({ id: "d", status: "To Board", shoot: { start: null, end: null }, title: "Alpha" })
    expect(ids(toShootView([a, b, c, d]))).toEqual(["c", "d", "b", "a"])
  })
})

describe("To Edit", () => {
  it("includes both In progress statuses only while Edited is false", () => {
    const schedule = item({ id: "s", status: "To Schedule" })
    const edit = item({ id: "e", status: "To Edit" })
    const done = item({ status: "To Edit", edited: true })
    const batch = item({ status: "To Edit", title: "batch b" })
    expect(ids(toEditView([edit, done, batch, schedule]))).toEqual(["s", "e"])
  })
})

describe("To Post", () => {
  it("uses Ready to Post with Edited = Any by default", () => {
    const yes = item({ id: "y", status: "Ready to Post", edited: true, title: "A" })
    const no = item({ id: "n", status: "Ready to Post", edited: false, title: "B" })
    const other = item({ status: "Posted" })
    expect(ids(toPostView([yes, no, other]))).toEqual(["y", "n"])
    expect(ids(toPostView([yes, no], "yes"))).toEqual(["y"])
    expect(ids(toPostView([yes, no], "no"))).toEqual(["n"])
  })
})

describe("Available Posts", () => {
  it("includes In progress OR Ready to Post only when Post Now is empty", () => {
    expect(isAvailablePost(item({ status: "To Schedule" }))).toBe(true)
    expect(isAvailablePost(item({ status: "To Edit" }))).toBe(true)
    expect(isAvailablePost(item({ status: "Ready to Post" }))).toBe(true)
    expect(isAvailablePost(item({ status: "Ready to Post", post: { start: "2026-05-01", end: null } }))).toBe(false)
  })

  it("drops an item once Post Now is assigned", () => {
    const x = item({ status: "Ready to Post" })
    expect(availablePostsView([x])).toHaveLength(1)
    expect(availablePostsView([{ ...x, post: { start: "2026-05-01", end: null } }])).toHaveLength(0)
  })

  it("excludes Posted, Worn and batch titles", () => {
    expect(isAvailablePost(item({ status: "Posted" }))).toBe(false)
    expect(isAvailablePost(item({ status: "Worn" }))).toBe(false)
    expect(isAvailablePost(item({ status: "To Edit", title: "Batch C" }))).toBe(false)
  })

  it("groups matching children under a non-matching parent for context", () => {
    const parent = item({ id: "p", title: "BATCH A", status: "To Edit" })
    const child = item({ id: "c", parentId: "p", status: "To Edit" })
    const [group] = availablePostsView([parent, child])
    expect(group.item.id).toBe("p")
    expect(group.matches).toBe(false)
    expect(ids(group.children)).toEqual(["c"])
  })
})

describe("Outfits to Prep", () => {
  it("includes Buy Clothes, Ordered and Delivered; excludes Refunded and empty", () => {
    const rows = ["Buy Clothes", "Ordered", "Delivered", "Refunded", null].map((clothingStatus, i) =>
      item({ id: `o${i}`, clothingStatus, shoot: { start: `2026-02-0${i + 1}`, end: null } }),
    )
    expect(ids(outfitsView(rows).map((g) => g.item))).toEqual(["o0", "o1", "o2"])
  })

  it("keeps a non-matching parent as context without marking it as matching", () => {
    const parent = item({ id: "p", clothingStatus: "Refunded" })
    const child = item({ id: "c", parentId: "p", clothingStatus: "Delivered" })
    const [group] = outfitsView([parent, child])
    expect(group.matches).toBe(false)
    expect(ids(group.children)).toEqual(["c"])
  })
})

describe("dates", () => {
  it("keeps date-only values on their calendar day", () => {
    expect(formatDate("2026-03-01", { today: "2026-01-01" })).toBe("Mar 1")
    expect(scheduleCovers({ start: "2026-03-01", end: null }, "2026-03-01")).toBe(true)
    expect(scheduleCovers({ start: "2026-03-01", end: null }, "2026-02-28")).toBe(false)
  })

  it("moving a schedule keeps its time and range length", () => {
    expect(moveSchedule({ start: "2026-03-01T09:00", end: "2026-03-03T17:00" }, "2026-03-10")).toEqual({
      start: "2026-03-10T09:00",
      end: "2026-03-12T17:00",
    })
    expect(moveSchedule({ start: null, end: null }, "2026-03-10")).toEqual({ start: "2026-03-10", end: null })
  })

  it("rescheduling one calendar field leaves the other schedules untouched", () => {
    const x = item({ shoot: { start: "2026-03-01", end: null }, edit: { start: "2026-03-04", end: null }, post: { start: "2026-03-08T19:00", end: null } })
    const patched = { ...x, edit: moveSchedule(x.edit, "2026-03-06") }
    expect(patched.shoot).toEqual(x.shoot)
    expect(patched.post).toEqual(x.post)
    expect(patched.edit.start).toBe("2026-03-06")
  })

  it("computes today in Asia/Manila", () => {
    // 2026-03-01 17:30 UTC is already 2026-03-02 in Manila (UTC+8)
    expect(todayISO(new Date("2026-03-01T17:30:00Z"))).toBe("2026-03-02")
  })
})

describe("status ordering and parents", () => {
  it("has the configured option order", () => {
    expect(STATUS_NAMES).toEqual(["To Board", "To Buy/Plan Clothes", "To Planner", "To Shoot", "To Schedule", "To Edit", "Ready to Post", "Posted", "Worn"])
  })

  it("never offers self, sub-items or descendants as parents", () => {
    const p = item({ id: "p" })
    const c = item({ id: "c", parentId: "p" })
    const other = item({ id: "o" })
    expect(ids(parentCandidates([p, c, other], "c"))).toEqual(["p", "o"])
    expect(parentCandidates([p, c, other], "p")).toEqual([]) // has children → can't be nested (no cycles)
  })

  it("Edit calendar is parent-focused", () => {
    const p = item({ id: "p", edit: { start: "2026-03-01", end: null } })
    const c = item({ id: "c", parentId: "p", edit: { start: "2026-03-02", end: null } })
    const orphanChild = item({ id: "oc", parentId: "q", edit: { start: "2026-03-02", end: null } })
    const q = item({ id: "q" })
    expect(ids(parentFocused([p, c, q, orphanChild], (i) => !!i.edit.start))).toEqual(["p", "oc"])
  })
})

describe("SHEIN clothing timeline", () => {
  const shoot = "2026-04-20"

  it("orders 7 days before the shoot and returns on day 11 of the 14-day window", () => {
    const x = item({ clothingStatus: "Buy Clothes", shoot: { start: shoot, end: null } })
    const t = clothingTimeline(x, new Map([[x.id, x]]))
    expect(t.orderBy).toBe("2026-04-13")
    expect(t.returnBy).toBe("2026-04-24")
    expect(t.windowEnd).toBe("2026-04-27")
  })

  it("starts the window on the actual order date once ordered", () => {
    const x = item({ clothingStatus: "Ordered", orderedAt: "2026-04-10T02:00:00.000Z", shoot: { start: shoot, end: null } })
    expect(clothingTimeline(x, new Map([[x.id, x]])).returnBy).toBe(addDaysISO("2026-04-10", 11))
  })

  it("sub-items inherit the parent's shoot date", () => {
    const p = item({ id: "p", shoot: { start: shoot, end: null } })
    const c = item({ parentId: "p", clothingStatus: "Buy Clothes" })
    expect(clothingTimeline(c, new Map([[p.id, p], [c.id, c]])).orderBy).toBe("2026-04-13")
  })

  it("flags unordered clothes near the order date and ordered clothes near the return date", () => {
    const buy = item({ clothingStatus: "Buy Clothes", shoot: { start: shoot, end: null } })
    const map = new Map([[buy.id, buy]])
    expect(clothingAlert(buy, map, "2026-04-01")).toBeNull()
    expect(clothingAlert(buy, map, "2026-04-11")?.kind).toBe("order-soon")
    expect(clothingAlert(buy, map, "2026-04-14")?.kind).toBe("order-overdue")

    const delivered = item({ clothingStatus: "Delivered", shoot: { start: shoot, end: null } })
    const map2 = new Map([[delivered.id, delivered]])
    expect(clothingAlert(delivered, map2, "2026-04-22")?.kind).toBe("return-soon")
    expect(clothingAlert(delivered, map2, "2026-04-25")?.kind).toBe("return-overdue")
    expect(clothingAlert(delivered, map2, "2026-04-28")?.kind).toBe("window-closed")

    const refunded = item({ clothingStatus: "Refunded", shoot: { start: shoot, end: null } })
    expect(clothingAlert(refunded, new Map([[refunded.id, refunded]]), "2026-04-25")).toBeNull()
  })
})

describe("feed sync mapping", () => {
  it("sets the starting status from where the slot was added", () => {
    expect(statusForFeedSlot({ location: "drafts", mediaUrls: [] })).toBe("To Board")
    expect(statusForFeedSlot({ location: "grid", mediaUrls: [] })).toBe("To Shoot")
    expect(statusForFeedSlot({ location: "grid", mediaUrls: ["local-media://x"] })).toBe("To Edit")
    expect(categoryForFeedSlot({ location: "story", contentType: "Story" })).toBe("Story")
    expect(categoryForFeedSlot({ location: "grid", contentType: "Reel" })).toBe("Reels")
  })
})

describe("one dataset, many views", () => {
  it("an edit to one record shows up in every view it qualifies for", () => {
    const x = item({ id: "x", status: "To Edit", clothingStatus: "Ordered", shoot: { start: "2026-04-20", end: null } })
    const items = [x]
    expect(ids(toEditView(items))).toEqual(["x"])
    expect(availablePostsView(items)).toHaveLength(1)
    expect(outfitsView(items)).toHaveLength(1)

    const edited = [{ ...x, title: "Renamed", edited: true }]
    expect(toEditView(edited)).toHaveLength(0)
    expect(availablePostsView(edited)[0].item.title).toBe("Renamed")
    expect(outfitsView(edited)[0].item.title).toBe("Renamed")
  })
})
