"use client"

import { useEffect, useRef, useState } from "react"
import { upload } from "@vercel/blob/client"
import { deleteMediaBlob, getMediaBlob } from "@/lib/idb"
import { compressImage, extensionFor, isDeviceOnlyMedia } from "@/lib/media/compress"
import type { SlotItem } from "@/types"

const CONCURRENCY = 2
const RETRY_AFTER_MS = 60_000

export type CloudMediaStatus = { enabled: boolean | null; pending: number; failed: number }

function replaceUrl(items: SlotItem[], from: string, to: string): SlotItem[] {
  let changed = false
  const next = items.map((i) => {
    if (!i.urls?.includes(from)) return i
    changed = true
    return { ...i, urls: i.urls.map((u) => (u === from ? to : u)) }
  })
  return changed ? next : items
}

/**
 * Moves photos and videos that only exist in this browser up to cloud storage (photos compressed first), then
 * swaps each feed box over to the cloud link so it shows on every device. The browser copy is freed afterwards.
 */
export function useCloudMedia(
  items: SlotItem[],
  setItems: (update: (curr: SlotItem[]) => SlotItem[]) => void,
  userId: string | null,
  ready: boolean,
): CloudMediaStatus {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [pending, setPending] = useState(0)
  const [failed, setFailed] = useState(0)
  const [retryTick, setRetryTick] = useState(0)
  const inFlight = useRef(new Set<string>())
  const retryAt = useRef(new Map<string, number>())
  const queueRef = useRef<string[]>([])
  const running = useRef(0)

  useEffect(() => {
    if (!userId) return
    fetch("/api/blob")
      .then((r) => r.json())
      .then((d) => setEnabled(Boolean(d.enabled)))
      .catch(() => setEnabled(false))
  }, [userId])

  useEffect(() => {
    if (!ready || !userId || !enabled) return
    const now = Date.now()
    const waiting = new Set<string>()
    for (const item of items) for (const url of item.urls ?? []) if (isDeviceOnlyMedia(url)) waiting.add(url)
    setPending(waiting.size)
    setFailed([...retryAt.current.values()].filter((t) => t > now).length)
    queueRef.current = [...waiting].filter((u) => !inFlight.current.has(u) && (retryAt.current.get(u) ?? 0) <= now)

    const uploadOne = async (url: string) => {
      inFlight.current.add(url)
      try {
        const original = url.startsWith("local-media://") ? await getMediaBlob(url.slice("local-media://".length)) : await (await fetch(url)).blob()
        if (!original) throw new Error("Photo missing from this browser")
        const body = original.type.startsWith("image/") ? await compressImage(original) : original
        const kind = body.type.startsWith("video/") ? "videos" : "photos"
        const pathname = `u/${userId}/${kind}/${Date.now()}.${extensionFor(body.type)}`
        const result = await upload(pathname, body, {
          access: "public",
          handleUploadUrl: "/api/blob",
          contentType: body.type || undefined,
          multipart: body.size > 8 * 1024 * 1024,
        })
        setItems((curr) => replaceUrl(curr, url, result.url))
        retryAt.current.delete(url)
        // Free the browser copy once the feed (saved a moment later) points at the cloud copy.
        if (url.startsWith("local-media://")) setTimeout(() => deleteMediaBlob(url.slice("local-media://".length)).catch(() => {}), 15_000)
      } catch (e) {
        console.warn("Photo upload failed, will retry:", e)
        retryAt.current.set(url, Date.now() + RETRY_AFTER_MS)
        setFailed((f) => f + 1)
      } finally {
        inFlight.current.delete(url)
      }
    }

    const pump = () => {
      while (running.current < CONCURRENCY && queueRef.current.length) {
        const url = queueRef.current.shift()!
        if (inFlight.current.has(url)) continue
        running.current++
        uploadOne(url).finally(() => {
          running.current--
          pump()
        })
      }
    }
    pump()
  }, [items, ready, userId, enabled, setItems, retryTick])

  // Retry failed uploads periodically.
  useEffect(() => {
    if (!failed || !enabled) return
    const t = setTimeout(() => setRetryTick((n) => n + 1), RETRY_AFTER_MS + 1000)
    return () => clearTimeout(t)
  }, [failed, enabled, retryTick])

  return { enabled, pending, failed }
}
