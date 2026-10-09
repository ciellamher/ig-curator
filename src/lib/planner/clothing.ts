// SHEIN outfit timeline. One order covers two batches: order a week before the earliest shoot, and return within
// 14 days of delivery (reminder from day 11, three days before the window closes).

import { addDaysISO, datePart, diffDays, formatDate, relativeDays, todayISO } from "./dates"
import type { ContentDTO, OrderDTO } from "./types"

export const ORDER_LEAD_DAYS = 7
export const RETURN_WINDOW_DAYS = 14
/** Return reminder from day 11 after delivery, three days before the window closes. */
export const RETURN_REMINDER_DAY = 11
export const DUE_SOON_DAYS = 3

export type ClothingStage = "Buy Clothes" | "Ordered" | "Delivered" | "Refunded"

export type ClothingTimeline = {
  shootDate: string | null
  orderBy: string | null
  orderedOn: string | null
  deliveredOn: string | null
  /** Day 11 after delivery. */
  returnBy: string | null
  /** Day 14 after delivery: last day to return. */
  windowEnd: string | null
  /** Days since delivery (delivery day = day 0), or null before delivery. */
  daysSinceDelivery: number | null
}

export type ClothingAlert = {
  kind: "order-overdue" | "order-soon" | "return-soon" | "window-closed"
  severity: "danger" | "warning"
  date: string
  message: string
}

/** Calendar date of an ISO timestamp in Asia/Manila. */
export function manilaDate(iso: string | null | undefined): string | null {
  return iso ? todayISO(new Date(iso)) : null
}

/** A sub-item without its own Shoot Date uses its parent's. */
export function effectiveShootDate(item: ContentDTO, byId: Map<string, ContentDTO>): string | null {
  if (item.shoot.start) return datePart(item.shoot.start)
  const parent = item.parentId ? byId.get(item.parentId) : undefined
  return parent?.shoot.start ? datePart(parent.shoot.start) : null
}

/** A batch's shoot date: its own, else the earliest among its sub-items. */
export function batchShootDate(batch: ContentDTO, items: ContentDTO[]): string | null {
  const dates = [batch, ...items.filter((i) => i.parentId === batch.id)].flatMap((i) => (i.shoot.start ? [datePart(i.shoot.start)] : []))
  return dates.sort()[0] ?? null
}

export function timeline(input: { shootDate: string | null; orderedAt: string | null; deliveredAt: string | null }, today = todayISO()): ClothingTimeline {
  const deliveredOn = manilaDate(input.deliveredAt)
  return {
    shootDate: input.shootDate,
    orderBy: input.shootDate ? addDaysISO(input.shootDate, -ORDER_LEAD_DAYS) : null,
    orderedOn: manilaDate(input.orderedAt),
    deliveredOn,
    returnBy: deliveredOn ? addDaysISO(deliveredOn, RETURN_REMINDER_DAY) : null,
    windowEnd: deliveredOn ? addDaysISO(deliveredOn, RETURN_WINDOW_DAYS) : null,
    daysSinceDelivery: deliveredOn ? diffDays(deliveredOn, today) : null,
  }
}

export function orderStage(order: OrderDTO): ClothingStage {
  if (order.returnedAt) return "Refunded"
  if (order.deliveredAt) return "Delivered"
  if (order.orderedAt) return "Ordered"
  return "Buy Clothes"
}

/** The posts an order covers (picked on the order card). */
export function orderBatches(order: OrderDTO, items: ContentDTO[]): ContentDTO[] {
  return items.filter((i) => i.orderId === order.id)
}

export function orderTimeline(order: OrderDTO, items: ContentDTO[], today = todayISO()): ClothingTimeline {
  const byId = new Map(items.map((i) => [i.id, i]))
  const shootDate =
    orderBatches(order, items)
      .map((p) => effectiveShootDate(p, byId) ?? batchShootDate(p, items))
      .filter(Boolean)
      .sort()[0] ?? null
  return timeline({ shootDate, orderedAt: order.orderedAt, deliveredAt: order.deliveredAt }, today)
}

/** The order an item belongs to, directly (a batch) or through its parent batch. */
export function orderFor(item: ContentDTO, byId: Map<string, ContentDTO>, orders: Map<string, OrderDTO>): OrderDTO | undefined {
  const orderId = item.orderId ?? (item.parentId ? byId.get(item.parentId)?.orderId : null)
  return orderId ? orders.get(orderId) : undefined
}

/** Timeline for any item: its order's when it's in one, otherwise its own clothing dates. */
export function itemTimeline(
  item: ContentDTO,
  byId: Map<string, ContentDTO>,
  orders: Map<string, OrderDTO> = new Map(),
  items: ContentDTO[] = [...byId.values()],
  today = todayISO(),
): ClothingTimeline {
  const order = orderFor(item, byId, orders)
  if (order) return orderTimeline(order, items, today)
  return timeline({ shootDate: effectiveShootDate(item, byId), orderedAt: item.orderedAt, deliveredAt: item.deliveredAt }, today)
}

/** Unordered clothes near/past the order-by date; delivered clothes from day 11 and once past 14 days. */
export function stageAlert(stage: string | null, t: ClothingTimeline, today = todayISO()): ClothingAlert | null {
  if (stage === "Buy Clothes" && t.orderBy) {
    const diff = diffDays(today, t.orderBy)
    if (diff < 0) return { kind: "order-overdue", severity: "danger", date: t.orderBy, message: `Order was due ${relativeDays(t.orderBy, today)}` }
    if (diff <= DUE_SOON_DAYS) return { kind: "order-soon", severity: "warning", date: t.orderBy, message: `Order ${relativeDays(t.orderBy, today)}` }
    return null
  }
  if (stage === "Delivered" && t.daysSinceDelivery !== null && t.windowEnd && t.returnBy) {
    const day = t.daysSinceDelivery
    if (day > RETURN_WINDOW_DAYS) {
      return { kind: "window-closed", severity: "danger", date: t.windowEnd, message: `Day ${day} since delivery — the ${RETURN_WINDOW_DAYS}-day return window has closed` }
    }
    if (day >= RETURN_REMINDER_DAY) {
      return { kind: "return-soon", severity: "warning", date: t.windowEnd, message: `Day ${day} of ${RETURN_WINDOW_DAYS} — return by ${formatDate(t.windowEnd, { today })}` }
    }
  }
  return null
}

export function orderAlert(order: OrderDTO, items: ContentDTO[], today = todayISO()): ClothingAlert | null {
  return stageAlert(orderStage(order), orderTimeline(order, items, today), today)
}

/** Alert for an item tracked on its own (not part of an order). */
export function clothingAlert(item: ContentDTO, byId: Map<string, ContentDTO>, today = todayISO()): ClothingAlert | null {
  const t = timeline({ shootDate: effectiveShootDate(item, byId), orderedAt: item.orderedAt, deliveredAt: item.deliveredAt }, today)
  return stageAlert(item.clothingStatus, t, today)
}

export type PlannerAlert = { key: string; title: string; alert: ClothingAlert; item?: ContentDTO; order?: OrderDTO }

/** Order-level alerts for active orders, plus item alerts for clothes not covered by an order. */
export function clothingAlerts(items: ContentDTO[], orders: OrderDTO[] = [], today = todayISO()): PlannerAlert[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  const ordersById = new Map(orders.map((o) => [o.id, o]))
  const out: PlannerAlert[] = []
  for (const order of orders) {
    const alert = orderAlert(order, items, today)
    if (!alert) continue
    const posts = orderBatches(order, items).map((b) => b.title)
    const names = posts.length > 2 ? `${posts.slice(0, 2).join(" + ")} +${posts.length - 2}` : posts.join(" + ")
    out.push({ key: `order-${order.id}`, title: names ? `${order.name} (${names})` : order.name, alert, order })
  }
  for (const item of items) {
    if (!item.clothingStatus || orderFor(item, byId, ordersById)) continue
    const alert = clothingAlert(item, byId, today)
    if (alert) out.push({ key: item.id, title: item.title, alert, item })
  }
  return out.sort((a, b) => (a.alert.date < b.alert.date ? -1 : 1))
}
