"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createContent, deleteContents, listContent, loadSampleData, updateContent } from "@/app/actions/content"
import { feedKindsFor } from "@/lib/planner/feed"
import { withScheduleRules } from "@/lib/planner/rules"
import { createQuickLink, deleteQuickLink, listQuickLinks, updateQuickLink } from "@/app/actions/quickLinks"
import { createOrder, deleteOrder, listOrders, renameOrder, setOrderBatches, setOrderDate, setOrderStage } from "@/app/actions/orders"
import { clothingAlerts } from "@/lib/planner/clothing"
import {
  FEED_ATTACH_EVENT,
  PLANNER_DELETED_EVENT,
  PLANNER_REFRESH_EVENT,
  PLANNER_SYNC_ERROR_EVENT,
  PLANNER_TITLE_EVENT,
  type ContentDTO,
  type ContentPatch,
  type FeedAttach,
  type OrderDTO,
  type OrderStage,
  type QuickLinkDTO,
  type QuickLinkInput,
} from "@/lib/planner/types"

const byName = (a: QuickLinkDTO, b: QuickLinkDTO) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })

export function usePlanner(enabled: boolean) {
  const [items, setItems] = useState<ContentDTO[]>([])
  const [links, setLinks] = useState<QuickLinkDTO[]>([])
  const [orders, setOrders] = useState<OrderDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const newSlotId = () => `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  /** Gives a page one feed box per placement it's ticked for (Post → grid, Reels → reel, Story → story folder). */
  const reconcileFeed = useCallback(async (page: ContentDTO) => {
    const wants = feedKindsFor(page.categories)
    const current = new Map<string, string>(Object.entries(page.extraSlots ?? {}))
    if (page.slotId && page.contentType) current.set(page.contentType, page.slotId)

    const removed = [...current].filter(([type]) => !wants.includes(type)).map(([, slotId]) => slotId)
    const slots = new Map<string, string>()
    const added: { slotId: string; contentType: string }[] = []
    for (const type of wants) {
      const existing = current.get(type)
      if (existing) slots.set(type, existing)
      else {
        const slotId = newSlotId()
        slots.set(type, slotId)
        added.push({ slotId, contentType: type })
      }
    }
    if (!added.length && !removed.length && (wants[0] ?? null) === (page.slotId ? page.contentType : null)) return

    const [primary, ...extra] = wants
    const res = await updateContent(page.id, {
      slotId: primary ? slots.get(primary)! : null,
      contentType: primary ?? null,
      extraSlots: extra.length ? Object.fromEntries(extra.map((type) => [type, slots.get(type)!])) : null,
    })
    if (!res.success) return setError(res.error)
    setItems((curr) => curr.map((i) => (i.id === page.id ? res.data : i)))

    if (removed.length) window.dispatchEvent(new CustomEvent(PLANNER_DELETED_EVENT, { detail: removed }))
    for (const box of added) {
      const detail: FeedAttach = { ...box, urls: res.data.media.map((m) => m.url), title: res.data.title }
      window.dispatchEvent(new CustomEvent(FEED_ATTACH_EVENT, { detail }))
    }
  }, [])

  const reload = useCallback(async () => {
    const [content, quick, orderList] = await Promise.all([listContent(), listQuickLinks(), listOrders()])
    if (content.success) {
      setItems(content.data)
      
      // Auto-fix any items that have feed categories (e.g. from Notion import or sample data) 
      // but didn't get added to the grid yet, or items that the grid lost.
      // We do this by simulating a grid attach for items that already have slotIds,
      // and running reconcileFeed for items missing slotIds.
      setTimeout(() => {
        for (const item of content.data) {
          const wants = feedKindsFor(item.categories)
          const has = [item.contentType, ...Object.keys(item.extraSlots ?? {})].filter(Boolean)
          
          if (wants.join(",") !== has.join(",")) {
            // Missing slots entirely -> generate and save them
            reconcileFeed(item)
          } else if (has.length > 0) {
            // Has slots -> ensure the grid knows about them
            const placements = [
              ...(item.slotId && item.contentType ? [{ slotId: item.slotId, contentType: item.contentType }] : []),
              ...Object.entries(item.extraSlots ?? {}).map(([type, id]) => ({ slotId: String(id), contentType: type }))
            ]
            for (const box of placements) {
              const detail: FeedAttach = { ...box, urls: item.media.map(m => m.url), title: item.title }
              window.dispatchEvent(new CustomEvent(FEED_ATTACH_EVENT, { detail }))
            }
          }
        }
      }, 500)
    }
    if (quick.success) setLinks([...quick.data].sort(byName))
    if (orderList.success) setOrders(orderList.data)
    const failed = [content, quick, orderList].find((r) => !r.success)
    setError(failed && !failed.success ? failed.error : null)
    setLoading(false)
  }, [reconcileFeed])

  useEffect(() => {
    if (!enabled) return
    reload()
    // Feed changes (new posts, uploaded photos) land in the database; pull them in.
    const onSyncError = (e: Event) => setError(`Couldn't save your feed to the planner: ${(e as CustomEvent<string>).detail}`)
    window.addEventListener(PLANNER_REFRESH_EVENT, reload)
    window.addEventListener(PLANNER_SYNC_ERROR_EVENT, onSyncError)
    return () => {
      window.removeEventListener(PLANNER_REFRESH_EVENT, reload)
      window.removeEventListener(PLANNER_SYNC_ERROR_EVENT, onSyncError)
    }
  }, [enabled, reload])

  /** Optimistic update: every view re-renders from the same list immediately, then reconciles with the server. */
  const update = useCallback(async (id: string, patch: ContentPatch) => {
    const previous = itemsRef.current.find((i) => i.id === id)
    // Show the automatic edit-date / status changes immediately; the server applies the same rules.
    const optimistic = previous ? withScheduleRules(previous, patch) : patch
    setItems((curr) => curr.map((i) => (i.id === id ? { ...i, ...optimistic } : i)))
    const res = await updateContent(id, patch)
    if (res.success) {
      setItems((curr) => curr.map((i) => (i.id === id ? res.data : i)))
      if ("categories" in patch) reconcileFeed(res.data)
      // Renaming a feed-linked record renames its box in the feed.
      if ("title" in patch && previous?.title !== res.data.title) {
        for (const slotId of [res.data.slotId, ...Object.values(res.data.extraSlots ?? {})]) {
          if (slotId) window.dispatchEvent(new CustomEvent(PLANNER_TITLE_EVENT, { detail: { slotId, title: res.data.title } }))
        }
      }
    } else {
      if (previous) setItems((curr) => curr.map((i) => (i.id === id ? previous : i)))
      setError(res.error)
    }
  }, [])

  const create = useCallback(async (input: ContentPatch = {}) => {
    const res = await createContent(input)
    if (res.success) {
      setItems((curr) => [res.data, ...curr])
      // Ticked Post / Reels / Story? Then it shows in the feed straight away (empty until it gets photos).
      if (feedKindsFor(res.data.categories).length) reconcileFeed(res.data)
      return res.data
    }
    setError(res.error)
    return null
  }, [])

  /** Deletes one or many records; deleted feed boxes leave the feed too. */
  const removeMany = useCallback(async (ids: string[]) => {
    if (!ids.length) return
    const snapshot = itemsRef.current
    const doomed = new Set(ids)
    setItems((curr) => curr.filter((i) => !doomed.has(i.id)).map((i) => (i.parentId && doomed.has(i.parentId) ? { ...i, parentId: null } : i)))
    const res = await deleteContents(ids)
    if (!res.success) {
      setItems(snapshot)
      setError(res.error)
      return
    }
    const gone = new Set(res.data.deletedIds)
    setItems((curr) => curr.filter((i) => !gone.has(i.id)))
    if (res.data.deletedSlotIds.length) {
      window.dispatchEvent(new CustomEvent(PLANNER_DELETED_EVENT, { detail: res.data.deletedSlotIds }))
    }
  }, [])
  const remove = useCallback((id: string) => removeMany([id]), [removeMany])

  /** Runs an order change, then refreshes (order changes also update batches' Clothing status). */
  const orderAction = useCallback(
    async (action: () => Promise<{ success: boolean; error?: string }>) => {
      const res = await action()
      if (!res.success) setError(res.error ?? "Something went wrong")
      await reload()
    },
    [reload],
  )
  const orderActions = useMemo(
    () => ({
      create: (batchIds: string[] = []) => orderAction(() => createOrder(batchIds)),
      rename: (id: string, name: string) => orderAction(() => renameOrder(id, name)),
      setBatches: (id: string, batchIds: string[]) => orderAction(() => setOrderBatches(id, batchIds)),
      setStage: (id: string, stage: OrderStage, date?: string) => orderAction(() => setOrderStage(id, stage, date)),
      setDate: (id: string, field: "orderedAt" | "deliveredAt", date: string | null) => orderAction(() => setOrderDate(id, field, date)),
      remove: (id: string) => orderAction(() => deleteOrder(id)),
    }),
    [orderAction],
  )

  const loadSamples = useCallback(async () => {
    setLoading(true)
    const res = await loadSampleData()
    if (!res.success) setError(res.error)
    await reload()
  }, [reload])

  const saveLink = useCallback(async (input: QuickLinkInput, id?: string) => {
    const res = id ? await updateQuickLink(id, input) : await createQuickLink(input)
    if (!res.success) return res.error
    setLinks((curr) => [...curr.filter((l) => l.id !== res.data.id), res.data].sort(byName))
    return null
  }, [])

  const removeLink = useCallback(async (id: string) => {
    const res = await deleteQuickLink(id)
    if (res.success) setLinks((curr) => curr.filter((l) => l.id !== id))
    else setError(res.error)
  }, [])

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const ordersById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders])
  const alerts = useMemo(() => clothingAlerts(items, orders), [items, orders])

  return { items, byId, orders, ordersById, orderActions, links, alerts, loading, error, setError, update, create, remove, removeMany, loadSamples, saveLink, removeLink }
}

export type Planner = ReturnType<typeof usePlanner>
