// SHEIN outfit timeline: order a week before the shoot, return before the 14-day window closes.

import { addDaysISO, datePart, diffDays, relativeDays, todayISO } from "./dates"
import type { ContentDTO } from "./types"

export const ORDER_LEAD_DAYS = 7
export const RETURN_WINDOW_DAYS = 14
/** Return reminder on day 11, three days before the window closes. */
export const RETURN_REMINDER_DAY = 11
export const DUE_SOON_DAYS = 3

export type ClothingTimeline = {
  shootDate: string | null
  orderBy: string | null
  /** Start of the return window: the day it was marked Ordered, else the planned order-by date. */
  windowStart: string | null
  returnBy: string | null
  windowEnd: string | null
}

/** A sub-item without its own Shoot Date uses its parent's. */
export function effectiveShootDate(item: ContentDTO, byId: Map<string, ContentDTO>): string | null {
  if (item.shoot.start) return datePart(item.shoot.start)
  const parent = item.parentId ? byId.get(item.parentId) : undefined
  return parent?.shoot.start ? datePart(parent.shoot.start) : null
}

/** Calendar date of an ISO timestamp in Asia/Manila. */
function manilaDate(iso: string): string {
  return todayISO(new Date(iso))
}

export function clothingTimeline(item: ContentDTO, byId: Map<string, ContentDTO>): ClothingTimeline {
  const shootDate = effectiveShootDate(item, byId)
  const orderBy = shootDate ? addDaysISO(shootDate, -ORDER_LEAD_DAYS) : null
  const windowStart = item.orderedAt ? manilaDate(item.orderedAt) : orderBy
  return {
    shootDate,
    orderBy,
    windowStart,
    returnBy: windowStart ? addDaysISO(windowStart, RETURN_REMINDER_DAY) : null,
    windowEnd: windowStart ? addDaysISO(windowStart, RETURN_WINDOW_DAYS) : null,
  }
}

export type ClothingAlert = {
  kind: "order-overdue" | "order-soon" | "return-overdue" | "return-soon" | "window-closed"
  severity: "danger" | "warning"
  date: string
  message: string
}

/** Flags clothes not yet ordered close to/after the order-by date, and ordered/delivered clothes near the return date. */
export function clothingAlert(item: ContentDTO, byId: Map<string, ContentDTO>, today = todayISO()): ClothingAlert | null {
  const t = clothingTimeline(item, byId)

  if (item.clothingStatus === "Buy Clothes" && t.orderBy) {
    const diff = diffDays(today, t.orderBy)
    if (diff < 0) return { kind: "order-overdue", severity: "danger", date: t.orderBy, message: `Order was due ${relativeDays(t.orderBy, today)}` }
    if (diff <= DUE_SOON_DAYS) return { kind: "order-soon", severity: "warning", date: t.orderBy, message: `Order ${relativeDays(t.orderBy, today)}` }
    return null
  }

  if ((item.clothingStatus === "Ordered" || item.clothingStatus === "Delivered") && t.returnBy && t.windowEnd) {
    if (diffDays(today, t.windowEnd) < 0) {
      return { kind: "window-closed", severity: "danger", date: t.windowEnd, message: `Return window closed ${relativeDays(t.windowEnd, today)}` }
    }
    const diff = diffDays(today, t.returnBy)
    if (diff < 0) return { kind: "return-overdue", severity: "danger", date: t.returnBy, message: `Return was due ${relativeDays(t.returnBy, today)}` }
    if (diff <= DUE_SOON_DAYS) return { kind: "return-soon", severity: "warning", date: t.returnBy, message: `Return ${relativeDays(t.returnBy, today)}` }
  }

  return null
}

export function clothingAlerts(items: ContentDTO[], today = todayISO()) {
  const byId = new Map(items.map((i) => [i.id, i]))
  return items
    .flatMap((item) => {
      const alert = clothingAlert(item, byId, today)
      return alert ? [{ item, alert }] : []
    })
    .sort((a, b) => (a.alert.date < b.alert.date ? -1 : 1))
}
