"use server"

import { prisma } from "@/lib/prisma"
import type { ClothingOrder } from "@prisma/client"
import { requireUserId, run, type Result } from "@/lib/planner/server"
import { isValidScheduleValue } from "@/lib/planner/dates"
import type { OrderDTO, OrderStage } from "@/lib/planner/types"

function toDTO(o: ClothingOrder): OrderDTO {
  return {
    id: o.id,
    name: o.name,
    orderedAt: o.orderedAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    returnedAt: o.returnedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
  }
}

/** "YYYY-MM-DD" in Asia/Manila → midday that day, so the calendar date never shifts. */
function manilaDay(date: string | null | undefined): Date | null {
  if (!date) return null
  if (!isValidScheduleValue(date) || date.length !== 10) throw new Error("Invalid date")
  return new Date(`${date}T12:00:00+08:00`)
}

async function ownedOrder(userId: string, id: string) {
  const order = await prisma.clothingOrder.findFirst({ where: { id, userId } })
  if (!order) throw new Error("This order no longer exists")
  return order
}

/** Keeps the Clothing property on an order's posts (and any posts under them) in step with the order. */
async function syncClothingStatus(userId: string, orderId: string, clothingStatus: string) {
  const batches = await prisma.content.findMany({ where: { userId, orderId }, select: { id: true } })
  const batchIds = batches.map((b) => b.id)
  if (!batchIds.length) return
  await prisma.$transaction([
    prisma.content.updateMany({ where: { userId, id: { in: batchIds } }, data: { clothingStatus } }),
    prisma.content.updateMany({ where: { userId, parentId: { in: batchIds }, clothingStatus: { not: null } }, data: { clothingStatus } }),
  ])
}

export async function listOrders(): Promise<Result<OrderDTO[]>> {
  return run(async () => {
    const userId = await requireUserId()
    const rows = await prisma.clothingOrder.findMany({ where: { userId }, orderBy: { createdAt: "asc" } })
    return rows.map(toDTO)
  })
}

export async function createOrder(batchIds: string[] = []): Promise<Result<OrderDTO>> {
  return run(async () => {
    const userId = await requireUserId()
    const count = await prisma.clothingOrder.count({ where: { userId } })
    const order = await prisma.clothingOrder.create({ data: { userId, name: `Order ${count + 1}` } })
    if (batchIds.length) await assignBatches(userId, order.id, batchIds)
    return toDTO(order)
  })
}

export async function renameOrder(id: string, name: string): Promise<Result<OrderDTO>> {
  return run(async () => {
    const userId = await requireUserId()
    await ownedOrder(userId, id)
    const clean = String(name ?? "").trim().slice(0, 120) || "Order"
    return toDTO(await prisma.clothingOrder.update({ where: { id }, data: { name: clean } }))
  })
}

/** Sets which posts an order covers. */
async function assignBatches(userId: string, orderId: string, postIds: string[]) {
  const unique = Array.from(new Set(postIds)).slice(0, 500)
  const posts = await prisma.content.findMany({ where: { userId, id: { in: unique } }, select: { id: true } })
  if (posts.length !== unique.length) throw new Error("Post not found")
  await prisma.$transaction([
    prisma.content.updateMany({ where: { userId, orderId, id: { notIn: unique } }, data: { orderId: null } }),
    prisma.content.updateMany({ where: { userId, id: { in: unique } }, data: { orderId } }),
  ])
}

/** Sets which posts an order covers. */
export async function setOrderBatches(id: string, batchIds: string[]): Promise<Result<{ id: string }>> {
  return run(async () => {
    const userId = await requireUserId()
    await ownedOrder(userId, id)
    await assignBatches(userId, id, Array.isArray(batchIds) ? batchIds.filter((b) => typeof b === "string") : [])
    return { id }
  })
}

const STAGE_CLOTHING: Record<OrderStage, string> = {
  reset: "Buy Clothes",
  ordered: "Ordered",
  delivered: "Delivered",
  returned: "Refunded",
}

/** Moves an order through Buy Clothes → Ordered → Delivered → Refunded. `date` (YYYY-MM-DD) defaults to today. */
export async function setOrderStage(id: string, stage: OrderStage, date?: string): Promise<Result<OrderDTO>> {
  return run(async () => {
    const userId = await requireUserId()
    const order = await ownedOrder(userId, id)
    if (!(stage in STAGE_CLOTHING)) throw new Error("Invalid stage")
    const when = manilaDay(date) ?? new Date()
    const data =
      stage === "reset"
        ? { orderedAt: null, deliveredAt: null, returnedAt: null }
        : stage === "ordered"
          ? { orderedAt: when, deliveredAt: null, returnedAt: null }
          : stage === "delivered"
            ? { orderedAt: order.orderedAt ?? when, deliveredAt: when, returnedAt: null }
            : { returnedAt: when }
    const updated = await prisma.clothingOrder.update({ where: { id }, data })
    await syncClothingStatus(userId, id, STAGE_CLOTHING[stage])
    return toDTO(updated)
  })
}

/** Corrects the ordered or delivered date (YYYY-MM-DD). */
export async function setOrderDate(id: string, field: "orderedAt" | "deliveredAt", date: string | null): Promise<Result<OrderDTO>> {
  return run(async () => {
    const userId = await requireUserId()
    await ownedOrder(userId, id)
    if (field !== "orderedAt" && field !== "deliveredAt") throw new Error("Invalid field")
    return toDTO(await prisma.clothingOrder.update({ where: { id }, data: { [field]: manilaDay(date) } }))
  })
}

/** Deletes an order; its batches and outfits are kept. */
export async function deleteOrder(id: string): Promise<Result<{ id: string }>> {
  return run(async () => {
    const userId = await requireUserId()
    await ownedOrder(userId, id)
    await prisma.clothingOrder.delete({ where: { id } })
    return { id }
  })
}
