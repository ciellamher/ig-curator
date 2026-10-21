"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { addContentMedia, createContent, setContentMedia, deleteContents, listContent, loadSampleData, updateContent } from "@/app/actions/content"
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
  PLANNER_HIDDEN_EVENT,
  PLANNER_LINKS_EVENT,
  type ContentDTO,
  type ContentPatch,
  type FeedAttach,
  type FeedRemovePhotos,
  FEED_REMOVE_PHOTOS_EVENT,
  type FeedReorderStories,
  FEED_REORDER_STORIES_EVENT,
  type OrderDTO,
  type OrderStage,
  type QuickLinkDTO,
  type QuickLinkInput,
} from "@/lib/planner/types"

const byName = (a: QuickLinkDTO, b: QuickLinkDTO) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })

/** Seconds a delete can be undone */
export const UNDO_SECONDS = 10

/** The list with deleted pages put back where they were (and their sub-items back under them) */
function restoreFrom(curr: ContentDTO[], snapshot: ContentDTO[], ids: Set<string>): ContentDTO[] {
  const now = new Map(curr.map((i) => [i.id, i]))
  const before = new Set(snapshot.map((i) => i.id))
  const restored = snapshot.flatMap((old) => {
    if (ids.has(old.id)) return now.has(old.id) ? [now.get(old.id)!] : [old]
    const item = now.get(old.id)
    if (!item) return []
    return [old.parentId && ids.has(old.parentId) && !item.parentId ? { ...item, parentId: old.parentId } : item]
  })
  return [...curr.filter((i) => !before.has(i.id)), ...restored]
}

export function usePlanner(enabled: boolean) {
  const [items, setItems] = useState<ContentDTO[]>([])
  const [links, setLinks] = useState<QuickLinkDTO[]>([])
  const [orders, setOrders] = useState<OrderDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const newSlotId = () => `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  /**
   * Gives a page one feed box per placement it's ticked for (Post → grid, Reels → reel, Story → story folder).
   * `addOnly` (used when loading) only adds missing boxes and never removes one; boxes are removed only when
   * a placement is unticked. A carousel counts as the page's Post box.
   */
  const reconcileFeed = useCallback(async (page: ContentDTO, addOnly = false) => {
    // Loads can overlap (and arrive with data from before boxes were given): a page gets its missing boxes once,
    // or it would get two boxes — the second one then turning into a copy of the page.
    if (addOnly) {
      const last = boxesGivenRef.current.get(page.id)
      if (last && Date.now() - last < 60_000) return
    }
    if (reconcilingRef.current.has(page.id)) return
    reconcilingRef.current.add(page.id)
    try {
      await reconcileFeedNow(page, addOnly)
    } finally {
      reconcilingRef.current.delete(page.id)
    }
  }, [])
  const reconcilingRef = useRef(new Set<string>())
  const boxesGivenRef = useRef(new Map<string, number>())

  const reconcileFeedNow = async (page: ContentDTO, addOnly: boolean) => {
    const kind = (type: string) => (type === "Carousel" ? "Post" : type)
    const current = new Map<string, { slotId: string; type: string }>()
    for (const [type, slotId] of Object.entries(page.extraSlots ?? {})) current.set(kind(type), { slotId, type })
    if (page.slotId && page.contentType) current.set(kind(page.contentType), { slotId: page.slotId, type: page.contentType })

    const wanted = feedKindsFor(page.categories)
    // A story folder stays even when the page's categories change (it leaves the Stories tab once Posted)
    // A reel is its own grid box: a post box next to it (from before) was the same page shown twice. They hold the
    // same photos (linked boxes are kept in step), so it can go.
    const keep = addOnly
      ? [...new Set([...current.keys(), ...wanted])].filter((k) => !(k === "Post" && wanted.includes("Reel")))
      : [...new Set([...wanted, ...(current.has("StoryFolder") ? ["StoryFolder"] : [])])]
    const removed = [...current].filter(([k]) => !keep.includes(k)).map(([, box]) => box.slotId)
    const slots = new Map<string, { slotId: string; type: string }>()
    const added: { slotId: string; contentType: string }[] = []
    for (const k of keep) {
      const existing = current.get(k)
      if (existing) slots.set(k, existing)
      else {
        const box = { slotId: newSlotId(), type: k }
        slots.set(k, box)
        added.push({ slotId: box.slotId, contentType: k })
      }
    }
    if (!added.length && !removed.length) return

    // The page's main box stays its main box
    const mainKind = page.slotId && page.contentType && slots.has(kind(page.contentType)) ? kind(page.contentType) : keep[0]
    const main = mainKind ? slots.get(mainKind) : undefined
    const extra = [...slots].filter(([k]) => k !== mainKind).map(([, box]) => box)
    const res = await updateContent(page.id, {
      slotId: main?.slotId ?? null,
      contentType: main?.type ?? null,
      extraSlots: extra.length ? Object.fromEntries(extra.map((box) => [box.type, box.slotId])) : null,
    })
    if (!res.success) return setError(res.error)
    setItems((curr) => curr.map((i) => (i.id === page.id ? res.data : i)))

    if (removed.length) window.dispatchEvent(new CustomEvent(PLANNER_DELETED_EVENT, { detail: removed }))
    for (const box of added) {
      const detail: FeedAttach = { ...box, urls: res.data.media.map((m) => m.url), title: res.data.title, hidden: res.data.hiddenFromFeed && box.contentType !== "StoryFolder" }
      window.dispatchEvent(new CustomEvent(FEED_ATTACH_EVENT, { detail }))
    }
    if (added.length) boxesGivenRef.current.set(page.id, Date.now())
  }

  /** A page's post/reel boxes: in the grid (out of Drafts), shown or hidden like the page. */
  const ensureGridBoxes = useCallback((page: ContentDTO) => {
    const wanted = feedKindsFor(page.categories)
    const boxes = [
      ...(page.slotId && page.contentType && page.contentType !== "StoryFolder" ? [{ slotId: page.slotId, contentType: page.contentType }] : []),
      ...Object.entries(page.extraSlots ?? {}).filter(([type]) => type !== "StoryFolder").map(([contentType, slotId]) => ({ slotId, contentType })),
    ].filter((box) => wanted.includes(box.contentType === "Carousel" ? "Post" : box.contentType))
    for (const box of boxes) {
      const detail: FeedAttach = { ...box, urls: page.media.map((m) => m.url), title: page.title, ensure: true, hidden: page.hiddenFromFeed }
      window.dispatchEvent(new CustomEvent(FEED_ATTACH_EVENT, { detail }))
    }
  }, [])

  const reload = useCallback(async () => {
    const [content, quick, orderList] = await Promise.all([listContent(), listQuickLinks(), listOrders()])
    if (content.success) {
      // Pages waiting to be deleted (they can still be undone) stay out of view
      setItems(content.data.filter((i) => !pendingIdsRef.current.has(i.id)))
      
      // Pages ticked Post / Reels / Story get their feed boxes, also in a browser whose feed doesn't have them yet.
      // Only missing boxes are created: photos are never sent again to a box that's there (that looped before).
      setTimeout(() => {
        for (const item of content.data) {
          const has = [...(item.slotId && item.contentType ? [item.contentType] : []), ...Object.keys(item.extraSlots ?? {})].map((t) => (t === "Carousel" ? "Post" : t))
          const wanted = feedKindsFor(item.categories)
          // A box missing, or a post box doubling the page's reel
          if (wanted.some((k) => !has.includes(k)) || (wanted.includes("Reel") && has.includes("Post"))) {
            reconcileFeed(item, true)
            continue
          }
          ensureGridBoxes(item)
          // Its story folder, if this browser's feed doesn't have it yet
          const folder = item.contentType === "StoryFolder" ? item.slotId : item.extraSlots?.StoryFolder
          if (folder) {
            const detail: FeedAttach = { slotId: folder, contentType: "StoryFolder", urls: item.media.map((m) => m.url), title: item.title, ensure: true }
            window.dispatchEvent(new CustomEvent(FEED_ATTACH_EVENT, { detail }))
          }
        }
      }, 500)
    }
    if (quick.success) setLinks([...quick.data].sort(byName))
    if (orderList.success) setOrders(orderList.data)
    const failed = [content, quick, orderList].find((r) => !r.success)
    setError(failed && !failed.success ? failed.error : null)
    setLoading(false)
  }, [reconcileFeed, ensureGridBoxes])

  // Each page's boxes (its story folder and post or reel), which the feed keeps holding the same photos
  const linksSentRef = useRef("")
  useEffect(() => {
    const groups = items.map((page) => [page.slotId, ...Object.values(page.extraSlots ?? {})].filter(Boolean) as string[]).filter((g) => g.length > 1)
    const key = JSON.stringify(groups)
    if (key === linksSentRef.current) return
    linksSentRef.current = key
    ;(window as Window & { __plannerLinks?: string[][] }).__plannerLinks = groups
    window.dispatchEvent(new CustomEvent(PLANNER_LINKS_EVENT, { detail: groups }))
  }, [items])

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
    // Ticking Post or Reels means "show it": it comes off Hide from feed
    const addsGrid = (patch.categories ?? []).some((c) => (c === "Post" || c === "Reels") && !previous?.categories.includes(c))
    if (addsGrid && previous?.hiddenFromFeed && !("hiddenFromFeed" in patch)) patch = { ...patch, hiddenFromFeed: false }
    // Show the automatic edit-date / status changes immediately; the server applies the same rules.
    const optimistic = previous ? withScheduleRules(previous, patch) : patch
    setItems((curr) => curr.map((i) => (i.id === id ? { ...i, ...optimistic } : i)))
    const res = await updateContent(id, patch)
    if (res.success) {
      setItems((curr) => curr.map((i) => (i.id === id ? res.data : i)))
      if ("categories" in patch) {
        reconcileFeed(res.data).then(() => ensureGridBoxes(itemsRef.current.find((i) => i.id === id) ?? res.data))
      } else if ("hiddenFromFeed" in patch) ensureGridBoxes(res.data)
      // Renaming a feed-linked record renames its box in the feed.
      if ("title" in patch && previous?.title !== res.data.title) {
        for (const slotId of [res.data.slotId, ...Object.values(res.data.extraSlots ?? {})]) {
          if (slotId) window.dispatchEvent(new CustomEvent(PLANNER_TITLE_EVENT, { detail: { slotId, title: res.data.title } }))
        }
      }
      if ("hiddenFromFeed" in patch && previous?.hiddenFromFeed !== res.data.hiddenFromFeed) {
        // Only posts and reels can be hidden; a page's story folder always shows
        const gridBoxes = [
          ...(res.data.contentType !== "StoryFolder" ? [res.data.slotId] : []),
          ...Object.entries(res.data.extraSlots ?? {}).filter(([type]) => type !== "StoryFolder").map(([, slotId]) => slotId),
        ]
        for (const slotId of gridBoxes) {
          if (slotId) window.dispatchEvent(new CustomEvent(PLANNER_HIDDEN_EVENT, { detail: { slotId, hidden: res.data.hiddenFromFeed } }))
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
  /**
   * Deleting waits a few seconds before it's real, so it can be undone: the pages leave every view straight away,
   * their feed boxes stay until then, and Undo puts everything back as it was.
   */
  const pendingDeletesRef = useRef(new Map<string, { ids: string[]; snapshot: ContentDTO[]; timer: ReturnType<typeof setTimeout> }>())
  const pendingIdsRef = useRef(new Set<string>())
  const [undoable, setUndoable] = useState<{ key: string; count: number; title: string } | null>(null)

  const commitDelete = useCallback(async (key: string) => {
    const pending = pendingDeletesRef.current.get(key)
    if (!pending) return
    pendingDeletesRef.current.delete(key)
    clearTimeout(pending.timer)
    setUndoable((u) => (u?.key === key ? null : u))
    const res = await deleteContents(pending.ids)
    pending.ids.forEach((id) => pendingIdsRef.current.delete(id))
    if (!res.success) {
      // Not deleted after all: back into view
      setItems((curr) => restoreFrom(curr, pending.snapshot, new Set(pending.ids)))
      setError(res.error)
      return
    }
    const gone = new Set(res.data.deletedIds)
    setItems((curr) => curr.filter((i) => !gone.has(i.id)))
    if (res.data.deletedSlotIds.length) {
      window.dispatchEvent(new CustomEvent(PLANNER_DELETED_EVENT, { detail: res.data.deletedSlotIds }))
    }
  }, [])

  const removeMany = useCallback(async (ids: string[]) => {
    if (!ids.length) return
    const snapshot = itemsRef.current
    const doomed = new Set(ids)
    setItems((curr) => curr.filter((i) => !doomed.has(i.id)).map((i) => (i.parentId && doomed.has(i.parentId) ? { ...i, parentId: null } : i)))
    // A delete still waiting is made real now, so only the latest one can be undone
    for (const key of [...pendingDeletesRef.current.keys()]) commitDelete(key)
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    ids.forEach((id) => pendingIdsRef.current.add(id))
    const timer = setTimeout(() => commitDelete(key), UNDO_SECONDS * 1000)
    pendingDeletesRef.current.set(key, { ids, snapshot, timer })
    const first = snapshot.find((i) => i.id === ids[0])
    setUndoable({ key, count: ids.length, title: ids.length === 1 ? first?.title ?? "Page" : "" })
  }, [commitDelete])

  const undoDelete = useCallback(() => {
    const key = [...pendingDeletesRef.current.keys()].pop()
    const pending = key ? pendingDeletesRef.current.get(key) : undefined
    if (!key || !pending) return
    clearTimeout(pending.timer)
    pendingDeletesRef.current.delete(key)
    pending.ids.forEach((id) => pendingIdsRef.current.delete(id))
    setItems((curr) => restoreFrom(curr, pending.snapshot, new Set(pending.ids)))
    setUndoable(null)
  }, [])

  // Leaving the page while a delete is waiting: it goes through
  useEffect(() => {
    const flush = () => {
      for (const key of [...pendingDeletesRef.current.keys()]) commitDelete(key)
    }
    window.addEventListener("pagehide", flush)
    return () => window.removeEventListener("pagehide", flush)
  }, [commitDelete])

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

  /**
   * Photos added from a page without a post/reel box: into its story folder (as stories), or kept on the page
   * itself until it gets a feed placement.
   */
  const addPhotos = useCallback(async (page: ContentDTO, urls: string[]) => {
    if (!urls.length) return
    const folder = page.contentType === "StoryFolder" ? page.slotId : page.extraSlots?.StoryFolder
    if (folder) {
      const detail: FeedAttach = { slotId: folder, contentType: "StoryFolder", urls, title: page.title }
      window.dispatchEvent(new CustomEvent(FEED_ATTACH_EVENT, { detail }))
      return
    }
    const res = await addContentMedia(page.id, urls)
    if (res.success) setItems((curr) => curr.map((i) => (i.id === page.id ? res.data : i)))
    else setError(res.error)
  }, [])

  /** The photos of a page without a post/reel box, as edited in its page (added and removed). */
  const setPagePhotos = useCallback(async (page: ContentDTO, urls: string[]) => {
    const before = page.media.map((m) => m.url)
    const added = urls.filter((u) => !before.includes(u))
    const removed = before.filter((u) => !urls.includes(u))
    const folder = page.contentType === "StoryFolder" ? page.slotId : page.extraSlots?.StoryFolder
    if (folder) {
      if (added.length) addPhotos(page, added)
      if (removed.length) {
        const detail: FeedRemovePhotos = { folderId: folder, urls: removed }
        window.dispatchEvent(new CustomEvent(FEED_REMOVE_PHOTOS_EVENT, { detail }))
      }
      // Rearranged: the folder's stories play in this order
      if (!added.length && !removed.length && urls.join("\n") !== before.join("\n")) {
        const detail: FeedReorderStories = { folderId: folder, urls }
        window.dispatchEvent(new CustomEvent(FEED_REORDER_STORIES_EVENT, { detail }))
      }
      // Shown right away; the feed sync then confirms it
      setItems((curr) => curr.map((i) => (i.id === page.id ? { ...i, media: urls.map((url, position) => ({ id: `${page.id}-${position}`, url, position })) } : i)))
      return
    }
    const res = await setContentMedia(page.id, urls)
    if (res.success) setItems((curr) => curr.map((i) => (i.id === page.id ? res.data : i)))
    else setError(res.error)
  }, [addPhotos])

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const ordersById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders])
  const alerts = useMemo(() => clothingAlerts(items, orders), [items, orders])

  return { items, byId, orders, ordersById, orderActions, links, alerts, loading, error, setError, update, create, remove, removeMany, undoable, undoDelete, loadSamples, saveLink, removeLink, addPhotos, setPagePhotos }
}

export type Planner = ReturnType<typeof usePlanner>
