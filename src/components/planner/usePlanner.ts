"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createContent, deleteContent, listContent, loadSampleData, updateContent } from "@/app/actions/content"
import { createQuickLink, deleteQuickLink, listQuickLinks, updateQuickLink } from "@/app/actions/quickLinks"
import { clothingAlerts } from "@/lib/planner/clothing"
import type { ContentDTO, ContentPatch, QuickLinkDTO, QuickLinkInput } from "@/lib/planner/types"

const byName = (a: QuickLinkDTO, b: QuickLinkDTO) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })

export function usePlanner(enabled: boolean) {
  const [items, setItems] = useState<ContentDTO[]>([])
  const [links, setLinks] = useState<QuickLinkDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const reload = useCallback(async () => {
    const [content, quick] = await Promise.all([listContent(), listQuickLinks()])
    if (content.success) setItems(content.data)
    if (quick.success) setLinks([...quick.data].sort(byName))
    setError(!content.success ? content.error : !quick.success ? quick.error : null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (enabled) reload()
  }, [enabled, reload])

  /** Optimistic update: every view re-renders from the same list immediately, then reconciles with the server. */
  const update = useCallback(async (id: string, patch: ContentPatch) => {
    const previous = itemsRef.current.find((i) => i.id === id)
    setItems((curr) => curr.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    const res = await updateContent(id, patch)
    if (res.success) {
      setItems((curr) => curr.map((i) => (i.id === id ? res.data : i)))
    } else {
      if (previous) setItems((curr) => curr.map((i) => (i.id === id ? previous : i)))
      setError(res.error)
    }
  }, [])

  const create = useCallback(async (input: ContentPatch = {}) => {
    const res = await createContent(input)
    if (res.success) {
      setItems((curr) => [res.data, ...curr])
      return res.data
    }
    setError(res.error)
    return null
  }, [])

  /** Deleting a parent keeps its sub-items; they become top-level records. */
  const remove = useCallback(async (id: string) => {
    const snapshot = itemsRef.current
    setItems((curr) => curr.filter((i) => i.id !== id).map((i) => (i.parentId === id ? { ...i, parentId: null } : i)))
    const res = await deleteContent(id)
    if (!res.success) {
      setItems(snapshot)
      setError(res.error)
    }
  }, [])

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
  const alerts = useMemo(() => clothingAlerts(items), [items])

  return { items, byId, links, alerts, loading, error, setError, update, create, remove, loadSamples, saveLink, removeLink }
}

export type Planner = ReturnType<typeof usePlanner>
