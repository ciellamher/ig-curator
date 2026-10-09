import { describe, expect, it } from "vitest"
import { batchShootDate, clothingAlert, clothingAlerts, itemTimeline, orderAlert, orderStage, orderTimeline } from "./clothing"
import { addDaysISO, formatDate, moveSchedule, scheduleCovers, todayISO } from "./dates"
import { categoryForFeedSlot, feedKindsFor, statusForFeedSlot, toggleCategory } from "./feed"
import { STATUS_NAMES } from "./options"
import type { ContentDTO, OrderDTO } from "./types"
import { editLeadDays, withScheduleRules } from "./rules"
import { desiredCalendarEvents, googleWindow, scheduleFromGoogle, sentWindow } from "./calendarEvents"
import {
  availablePostsView,
  isAvailablePost,
  outfitsView,
  batchOptionsFor,
  shootDateOf,
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
    hiddenFromFeed: false,
    extraSlots: null,
    orderedAt: null,
    deliveredAt: null,
    orderId: null,
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

describe("Ready to Post", () => {
  it("lists content waiting in To Schedule (not batches)", () => {
    expect(isAvailablePost(item({ status: "To Schedule" }))).toBe(true)
    expect(isAvailablePost(item({ status: "To Edit" }))).toBe(false)
    expect(isAvailablePost(item({ status: "Ready to Post" }))).toBe(true)
    expect(isAvailablePost(item({ status: "Ready to Post", post: { start: "2026-10-10", end: null } }))).toBe(false)
    expect(isAvailablePost(item({ status: "To Schedule", title: "Batch C" }))).toBe(false)
  })

  it("drops an item once it's scheduled (it moves on to To Edit)", () => {
    const x = item({ status: "To Schedule" })
    expect(availablePostsView([x])).toHaveLength(1)
    const scheduled = { ...x, ...withScheduleRules(x, { post: { start: "2026-05-10", end: null } }) }
    expect(scheduled.status).toBe("To Edit")
    expect(availablePostsView([scheduled])).toHaveLength(0)
  })
})

describe("Outfits to Prep", () => {
  it("includes Buy Clothes and To Buy/Plan Clothes; excludes Ordered, Delivered, Refunded and empty", () => {
    const rows = ["Buy Clothes", "Ordered", "Delivered", "Refunded", null].map((clothingStatus, i) =>
      item({ id: `o${i}`, clothingStatus, shoot: { start: `2026-02-0${i + 1}`, end: null } }),
    )
    const planning = item({ id: "plan", status: "To Buy/Plan Clothes", shoot: { start: "2026-02-09", end: null } })
    expect(ids(outfitsView([...rows, planning]))).toEqual(["o0", "plan"])
  })

  it("sorts by shoot date, using the batch's when a post has none", () => {
    const batch = item({ id: "b", shoot: { start: "2026-02-01", end: null } })
    const post = item({ id: "p", parentId: "b", clothingStatus: "Buy Clothes" })
    const later = item({ id: "l", clothingStatus: "Buy Clothes", shoot: { start: "2026-02-05", end: null } })
    expect(ids(outfitsView([later, post], [batch, post, later]))).toEqual(["p", "l"])
    expect(shootDateOf(post, new Map([[batch.id, batch]]))).toBe("2026-02-01")
  })
})

describe("automatic edit dates", () => {
  const base = item({ status: "To Board", categories: ["Post"] })

  it("sets Edit Date a week before Post Now for posts and reels", () => {
    expect(withScheduleRules(base, { post: { start: "2026-05-10T19:00", end: null } }).edit).toEqual({ start: "2026-05-03", end: null })
    expect(withScheduleRules({ ...base, categories: ["Reels"] }, { post: { start: "2026-05-10", end: null } }).edit?.start).toBe("2026-05-03")
  })

  it("sets Edit Date 3 days before Post Now for stories", () => {
    expect(withScheduleRules({ ...base, categories: ["Story"] }, { post: { start: "2026-05-10", end: null } }).edit?.start).toBe("2026-05-07")
    expect(editLeadDays(["Story", "Post"])).toBe(7)
  })

  it("follows when Post Now or the category changes", () => {
    const scheduled = { ...base, post: { start: "2026-05-10", end: null }, edit: { start: "2026-05-03", end: null } }
    expect(withScheduleRules(scheduled, { post: { start: "2026-05-20", end: null } }).edit?.start).toBe("2026-05-13")
    expect(withScheduleRules(scheduled, { categories: ["Story"] }).edit?.start).toBe("2026-05-07")
  })

  it("leaves a hand-picked edit date alone when only the edit date changes", () => {
    const scheduled = { ...base, post: { start: "2026-05-10", end: null }, edit: { start: "2026-05-03", end: null } }
    expect(withScheduleRules(scheduled, { edit: { start: "2026-05-01", end: null } }).edit?.start).toBe("2026-05-01")
  })

  it("moves To Schedule to To Edit once there's an edit date, but never overrides a chosen status", () => {
    const waiting = { ...base, status: "To Schedule" }
    expect(withScheduleRules(waiting, { edit: { start: "2026-05-01", end: null } }).status).toBe("To Edit")
    expect(withScheduleRules(waiting, { post: { start: "2026-05-10", end: null } }).status).toBe("To Edit")
    expect(withScheduleRules(waiting, { post: { start: "2026-05-10", end: null }, status: "Posted" }).status).toBe("Posted")
    expect(withScheduleRules({ ...base, status: "To Shoot" }, { post: { start: "2026-05-10", end: null } }).status).toBeUndefined()
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

  it("offers batches but never the item itself, and an item holding posts can't go in a batch", () => {
    const batch = item({ id: "b", title: "BATCH A" })
    const post = item({ id: "p", parentId: "b" })
    const other = item({ id: "o", title: "Morning routine" })
    expect(ids(batchOptionsFor([batch, post, other], "o"))).toEqual(["b"])
    expect(batchOptionsFor([batch, post, other], "b")).toEqual([])
    // a post that's in a SHEIN order is not a batch
    expect(ids(batchOptionsFor([batch, post, item({ id: "ordered", orderId: "ord" })], "o"))).toEqual(["b"])
  })
})

function order(overrides: Partial<OrderDTO> = {}): OrderDTO {
  return { id: "ord", name: "Order 1", orderedAt: null, deliveredAt: null, returnedAt: null, createdAt: "2026-04-01T00:00:00.000Z", ...overrides }
}
// Midday in Manila on a calendar day
const at = (day: string) => `${day}T04:00:00.000Z`

describe("SHEIN orders (one order covers two batches)", () => {
  const batchA = item({ id: "A", title: "BATCH A", orderId: "ord", shoot: { start: "2026-04-20", end: null } })
  const a1 = item({ parentId: "A", clothingStatus: "Delivered" })
  const batchB = item({ id: "B", title: "BATCH B", orderId: "ord", shoot: { start: "2026-04-25", end: null } })
  const items = [batchA, a1, batchB]

  it("orders 7 days before the earliest shoot across both batches", () => {
    expect(orderTimeline(order(), items).orderBy).toBe("2026-04-13")
    expect(orderStage(order())).toBe("Buy Clothes")
  })

  it("counts the 14-day return window from delivery", () => {
    const o = order({ orderedAt: at("2026-04-08"), deliveredAt: at("2026-04-12") })
    const t = orderTimeline(o, items, "2026-04-21")
    expect(orderStage(o)).toBe("Delivered")
    expect(t.deliveredOn).toBe("2026-04-12")
    expect(t.daysSinceDelivery).toBe(9)
    expect(t.windowEnd).toBe("2026-04-26")
  })

  it("warns from day 11 and flags the order once it's over 14 days since delivery", () => {
    const o = order({ deliveredAt: at("2026-04-12") })
    expect(orderAlert(o, items, "2026-04-22")).toBeNull() // day 10
    expect(orderAlert(o, items, "2026-04-23")?.kind).toBe("return-soon") // day 11
    expect(orderAlert(o, items, "2026-04-26")?.kind).toBe("return-soon") // day 14, last day
    const late = orderAlert(o, items, "2026-04-27") // day 15
    expect(late?.kind).toBe("window-closed")
    expect(late?.severity).toBe("danger")
    expect(orderAlert({ ...o, returnedAt: at("2026-04-20") }, items, "2026-05-30")).toBeNull()
  })

  it("posts under a batch follow their order's timeline", () => {
    const o = order({ deliveredAt: at("2026-04-12") })
    const byId = new Map(items.map((i) => [i.id, i]))
    expect(itemTimeline(a1, byId, new Map([[o.id, o]]), items, "2026-04-27").daysSinceDelivery).toBe(15)
  })

  it("reports one alert per order instead of one per post", () => {
    const o = order({ deliveredAt: at("2026-04-12") })
    const alerts = clothingAlerts(items, [o], "2026-04-27")
    expect(alerts).toHaveLength(1)
    expect(alerts[0].title).toBe("Order 1 (BATCH A + BATCH B)")
  })

  it("a batch's shoot date falls back to its earliest post", () => {
    const b = item({ id: "Z" })
    const posts = [item({ parentId: "Z", shoot: { start: "2026-05-03", end: null } }), item({ parentId: "Z", shoot: { start: "2026-05-01", end: null } })]
    expect(batchShootDate(b, [b, ...posts])).toBe("2026-05-01")
  })
})

describe("standalone outfits", () => {
  const shoot = "2026-04-20"
  it("flags unordered clothes near the order date and delivered clothes from day 11", () => {
    const buy = item({ clothingStatus: "Buy Clothes", shoot: { start: shoot, end: null } })
    const map = new Map([[buy.id, buy]])
    expect(clothingAlert(buy, map, "2026-04-01")).toBeNull()
    expect(clothingAlert(buy, map, "2026-04-11")?.kind).toBe("order-soon")
    expect(clothingAlert(buy, map, "2026-04-14")?.kind).toBe("order-overdue")

    const delivered = item({ clothingStatus: "Delivered", deliveredAt: at("2026-04-01") })
    const map2 = new Map([[delivered.id, delivered]])
    expect(clothingAlert(delivered, map2, "2026-04-11")).toBeNull()
    expect(clothingAlert(delivered, map2, "2026-04-12")?.kind).toBe("return-soon")
    expect(clothingAlert(delivered, map2, "2026-04-16")?.kind).toBe("window-closed")
  })

  it("sub-items inherit the parent's shoot date", () => {
    const p = item({ id: "p", shoot: { start: shoot, end: null } })
    const c = item({ parentId: "p", clothingStatus: "Buy Clothes" })
    expect(itemTimeline(c, new Map([[p.id, p], [c.id, c]])).orderBy).toBe("2026-04-13")
  })
})

describe("feed sync mapping", () => {
  it("sets the starting status from where the slot was added", () => {
    expect(statusForFeedSlot({ location: "drafts", mediaUrls: [], isFolder: false })).toBe("To Board")
    expect(statusForFeedSlot({ location: "grid", mediaUrls: [], isFolder: false })).toBe("To Shoot")
    expect(statusForFeedSlot({ location: "grid", mediaUrls: ["local-media://x"], isFolder: false })).toBe("To Schedule")
    expect(statusForFeedSlot({ location: "story", mediaUrls: ["local-media://x"], isFolder: false })).toBe("To Schedule")
    expect(statusForFeedSlot({ location: "story", mediaUrls: [], isFolder: true })).toBe("To Shoot")
    expect(statusForFeedSlot({ location: "inspo", mediaUrls: ["local-media://x"], isFolder: false })).toBe("To Board")
    expect(categoryForFeedSlot({ location: "inspo", contentType: "InspoPost" })).toBeNull()
    expect(categoryForFeedSlot({ location: "story", contentType: "Story" })).toBe("Story")
    expect(categoryForFeedSlot({ location: "grid", contentType: "Reel" })).toBe("Reels")
  })
})

describe("one dataset, many views", () => {
  it("an edit to one record shows up in every view it qualifies for", () => {
    const x = item({ id: "x", status: "To Edit", clothingStatus: "Buy Clothes", shoot: { start: "2026-04-20", end: null } })
    const items = [x]
    expect(ids(toEditView(items))).toEqual(["x"])
    expect(outfitsView(items)).toHaveLength(1)

    const edited = [{ ...x, title: "Renamed", edited: true }]
    expect(toEditView(edited)).toHaveLength(0)
    expect(outfitsView(edited)[0].title).toBe("Renamed")
  })
})

describe("Google Calendar events", () => {
  const opts = { shein: true, appUrl: "https://example.test" }
  it("puts date-only shoots at 9am with reminders at 8pm the night before and at 9am", () => {
    const [e] = desiredCalendarEvents([item({ id: "s", title: "Beach", shoot: { start: "2026-05-10", end: null } })], [], opts)
    expect(e.key).toBe("s:shoot")
    expect(e.body.summary).toBe("Shoot — Beach")
    expect(e.body.start).toEqual({ dateTime: "2026-05-10T09:00:00", timeZone: "Asia/Manila" })
    expect(e.body.end.dateTime).toBe("2026-05-10T10:00:00")
    expect(e.body.reminders.overrides.map((o) => o.minutes)).toEqual([780, 0]) // 13h before = 8pm, and at 9am
  })
  it("uses the scheduled time, reminds posts only at the time, and skips edited/posted items", () => {
    const events = desiredCalendarEvents(
      [
        item({ id: "p", post: { start: "2026-05-10T19:30", end: null } }),
        item({ id: "e", edited: true, edit: { start: "2026-05-09", end: null } }),
        item({ id: "done", status: "Posted", shoot: { start: "2026-05-01", end: null } }),
      ],
      [],
      opts,
    )
    expect(events.map((e) => e.key)).toEqual(["p:post"])
    expect(events[0].body.start.dateTime).toBe("2026-05-10T19:30:00")
    expect(events[0].body.reminders.overrides).toEqual([{ method: "popup", minutes: 0 }])
  })
  it("adds SHEIN order and return reminders only when SHEIN is on", () => {
    const post = item({ id: "x", orderId: "ord", shoot: { start: "2026-05-20", end: null } })
    const o = order({ id: "ord", name: "Order 1" })
    expect(desiredCalendarEvents([post], [o], opts).map((e) => e.key)).toEqual(["x:shoot", "ord:order"])
    expect(desiredCalendarEvents([post], [o], { ...opts, shein: false }).map((e) => e.key)).toEqual(["x:shoot"])
  })
})

describe("feed placement", () => {
  it("all categories combine", () => {
    expect(toggleCategory(["Post", "Facebook"], "Story")).toEqual(["Post", "Facebook", "Story"])
    expect(toggleCategory(["Story"], "Locket")).toEqual(["Story", "Locket"])
    expect(toggleCategory(["Story", "Locket"], "Story")).toEqual(["Locket"])
    expect(feedKindsFor(["Post", "Story"])).toEqual(["StoryFolder", "Post"])
    expect(feedKindsFor(["Facebook"])).toEqual([])
  })
})

describe("scheduleFromGoogle", () => {
  it("keeps a date-only item date-only when dragged to another day", () => {
    expect(scheduleFromGoogle({ start: "2026-10-12T09:00", end: "2026-10-12T10:00" }, { start: "2026-10-10", end: null })).toEqual({ start: "2026-10-12", end: null })
  })
  it("takes the new time when moved to another hour", () => {
    expect(scheduleFromGoogle({ start: "2026-10-12T14:30", end: "2026-10-12T15:30" }, { start: "2026-10-10", end: null })).toEqual({ start: "2026-10-12T14:30", end: null })
  })
  it("keeps a longer event's end", () => {
    expect(scheduleFromGoogle({ start: "2026-10-12T14:00", end: "2026-10-12T17:00" }, { start: "2026-10-10T14:00", end: null })).toEqual({ start: "2026-10-12T14:00", end: "2026-10-12T17:00" })
  })
  it("reads all-day events (Google's end is the next day)", () => {
    expect(googleWindow({ start: { date: "2026-10-12" }, end: { date: "2026-10-13" } })).toEqual({ start: "2026-10-12", end: "2026-10-13" })
    expect(scheduleFromGoogle({ start: "2026-10-12", end: "2026-10-13" }, { start: "2026-10-10", end: null })).toEqual({ start: "2026-10-12", end: null })
    expect(scheduleFromGoogle({ start: "2026-10-12", end: "2026-10-15" }, { start: "2026-10-10", end: null })).toEqual({ start: "2026-10-12", end: "2026-10-14" })
  })
  it("matches what was sent, so unmoved events are left alone", () => {
    const [ev] = desiredCalendarEvents([item({ shoot: { start: "2026-10-10", end: null } })], [], { shein: false, appUrl: "x" })
    expect(sentWindow(ev.body)).toEqual({ start: "2026-10-10T09:00", end: "2026-10-10T10:00" })
  })
})
