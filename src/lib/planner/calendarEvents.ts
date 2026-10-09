// What goes into the "IG Curator" Google Calendar: one event per shoot/edit/post date (and SHEIN deadlines),
// with reminders. Pure, so it can be tested without Google.

import { orderStage, orderTimeline } from "./clothing"
import { addDaysISO, datePart, timePart, type Schedule } from "./dates"
import type { ContentDTO, OrderDTO } from "./types"

export const CALENDAR_TIMEZONE = "Asia/Manila"
/** Date-only items are put at 9:00–10:00 so a "morning of" reminder can fire. */
const DEFAULT_START = "09:00"
/** "The night before" reminder time. */
const EVENING_BEFORE = "20:00"

export type CalendarEventBody = {
  summary: string
  description: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  reminders: { useDefault: false; overrides: { method: "popup"; minutes: number }[] }
}

export type DesiredEvent = { key: string; body: CalendarEventBody }

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

function addHour(date: string, time: string): { date: string; time: string } {
  const total = toMinutes(time) + 60
  if (total < 24 * 60) return { date, time: `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}` }
  return { date: addDaysISO(date, 1), time: `${String(Math.floor((total - 1440) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}` }
}

/** Minutes before a start time that land on 8pm the evening before. */
export function eveningBeforeMinutes(startTime: string): number {
  return 24 * 60 - toMinutes(EVENING_BEFORE) + toMinutes(startTime)
}

function body(summary: string, schedule: Schedule, eveningBefore: boolean, appUrl: string): CalendarEventBody {
  const startDate = datePart(schedule.start!)
  const startTime = timePart(schedule.start!) ?? DEFAULT_START
  let end: { date: string; time: string }
  if (schedule.end) {
    end = { date: datePart(schedule.end), time: timePart(schedule.end) ?? addHour(datePart(schedule.end), startTime).time }
    if (`${end.date}T${end.time}` <= `${startDate}T${startTime}`) end = addHour(startDate, startTime)
  } else end = addHour(startDate, startTime)
  const overrides = [{ method: "popup" as const, minutes: 0 }]
  if (eveningBefore) overrides.unshift({ method: "popup", minutes: eveningBeforeMinutes(startTime) })
  return {
    summary,
    description: `Open IG Curator: ${appUrl}`,
    start: { dateTime: `${startDate}T${startTime}:00`, timeZone: CALENDAR_TIMEZONE },
    end: { dateTime: `${end.date}T${end.time}:00`, timeZone: CALENDAR_TIMEZONE },
    reminders: { useDefault: false, overrides },
  }
}

const DONE = new Set(["Posted", "Worn"])

export function desiredCalendarEvents(items: ContentDTO[], orders: OrderDTO[], opts: { shein: boolean; appUrl: string }): DesiredEvent[] {
  const out: DesiredEvent[] = []
  for (const item of items) {
    if (DONE.has(item.status)) continue // finished content needs no more reminders
    const title = item.title || "Untitled"
    if (item.shoot.start) out.push({ key: `${item.id}:shoot`, body: body(`Shoot — ${title}`, item.shoot, true, opts.appUrl) })
    if (item.edit.start && !item.edited) out.push({ key: `${item.id}:edit`, body: body(`Edit — ${title}`, item.edit, true, opts.appUrl) })
    if (item.post.start) out.push({ key: `${item.id}:post`, body: body(`Post — ${title}`, item.post, false, opts.appUrl) })
  }
  if (opts.shein) {
    for (const order of orders) {
      const stage = orderStage(order)
      const t = orderTimeline(order, items)
      if (stage === "Buy Clothes" && t.orderBy) {
        out.push({ key: `${order.id}:order`, body: body(`Order clothes — ${order.name}`, { start: t.orderBy, end: null }, true, opts.appUrl) })
      }
      if (stage === "Delivered" && t.returnBy && t.windowEnd) {
        out.push({
          key: `${order.id}:return`,
          body: body(`Return SHEIN — ${order.name} (last day ${t.windowEnd})`, { start: t.returnBy, end: null }, true, opts.appUrl),
        })
      }
    }
  }
  return out
}

// ---- Google → planner ----

/** Start/end as sent, in Manila wall-clock time ("YYYY-MM-DDTHH:mm"). */
export function sentWindow(b: CalendarEventBody): { start: string; end: string } {
  return { start: b.start.dateTime.slice(0, 16), end: b.end.dateTime.slice(0, 16) }
}

export type GoogleEventTime = { date?: string; dateTime?: string }

/** An event's start/end as Manila wall-clock time. Google is asked for times in Asia/Manila, so the clock part is local. */
export function googleWindow(ev: { start?: GoogleEventTime; end?: GoogleEventTime }): { start: string; end: string } | null {
  if (ev.start?.dateTime && ev.end?.dateTime) return { start: ev.start.dateTime.slice(0, 16), end: ev.end.dateTime.slice(0, 16) }
  // All-day event (Google's end date is the day after)
  if (ev.start?.date && ev.end?.date) return { start: ev.start.date, end: ev.end.date }
  return null
}

const isDateOnly = (v: string) => v.length === 10

/**
 * The planner dates for an event moved in Google Calendar. Keeps the planner's style: a date-only item dragged to
 * another day (still 9–10am, or all-day) stays date-only; a one-hour slot keeps no end, as when it was added.
 */
export function scheduleFromGoogle(win: { start: string; end: string }, previous: Schedule): Schedule {
  if (isDateOnly(win.start)) {
    const lastDay = addDaysISO(win.end, -1)
    return { start: win.start, end: lastDay > win.start ? lastDay : null }
  }
  const date = datePart(win.start)
  const time = timePart(win.start)!
  const oneHour = addHour(date, time)
  const isDefaultLength = `${oneHour.date}T${oneHour.time}` === win.end
  const wasDateOnly = !!previous.start && isDateOnly(previous.start)
  if (isDefaultLength && wasDateOnly && time === DEFAULT_START) return { start: date, end: null }
  return { start: win.start, end: isDefaultLength ? null : win.end }
}
