"use client"

import { SHEIN_ENABLED } from "@/lib/features"
import { useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { AlertTriangle, Plus, Search, Sparkles, X } from "lucide-react"
import { ConfirmModal, useConfirmModal } from "@/components/ui/ConfirmModal"
import { FEED_SELECT_EVENT, PLANNER_FOCUS_EVENT, PLANNER_OPEN_EVENT, PLANNER_SLOTS_EVENT, PLANNER_FACEBOOK_EVENT, type FacebookPage, type ContentDTO, type QuickLinkDTO } from "@/lib/planner/types"
import { usePlanner } from "./usePlanner"
import { ContentCalendar } from "./ContentCalendar"
import { ContentTable } from "./ContentTable"
import { AvailablePosts } from "./AvailablePosts"
import { OutfitsTable } from "./OutfitsTable"
import { QuickLinks } from "./Sidebar"
import { ItemDrawer } from "./ItemDrawer"
import { CalendarConnect } from "./CalendarConnect"
import type { DateField } from "@/lib/planner/dates"

export function PlannerClient() {
  const { status } = useSession()
  const allPlanner = usePlanner(status === "authenticated")
  const [showPosted, setShowPosted] = useState(false)
  // Posted content stays in the feed but drops out of the planner (unless "Show posted" is on).
  const postedCount = allPlanner.items.filter((i) => i.status === "Posted").length
  // Inspo stays in the feed only; Posted content is hidden unless "Show posted" is on
  const planner = useMemo(() => {
    const visible = (i: { status: string; contentType: string | null }) => !i.contentType?.startsWith("Inspo") && (showPosted || i.status !== "Posted")
    return {
      ...allPlanner,
      items: allPlanner.items.filter(visible),
      alerts: allPlanner.alerts.filter((a) => !a.item || visible(a.item)),
    }
  }, [allPlanner, showPosted])
  const [openId, setOpenId] = useState<string | null>(null)
  const [drawerFromFeed, setDrawerFromFeed] = useState(false)
  const openIdRef = useRef(openId)
  openIdRef.current = openId
  const [query, setQuery] = useState("")
  // The calendar and the database tabs show the same stage: To Shoot ↔ Shoot, To Edit ↔ Edit, To Post ↔ Post
  const [stage, setStage] = useState<DateField>("shoot")
  const { confirm, modalProps } = useConfirmModal()

  const openItem = openId ? planner.byId.get(openId) ?? null : null
  // The row being looked at: highlighted in the planner, and its box highlighted in the feed
  const [focus, setFocus] = useState<{ id: string; reveal: number } | null>(null)
  const focusItem = (item: ContentDTO) => {
    setFocus({ id: item.id, reveal: 0 })
    if (item.slotId) window.dispatchEvent(new CustomEvent(PLANNER_FOCUS_EVENT, { detail: item.slotId }))
  }
  const open = (item: ContentDTO) => {
    setOpenId(item.id)
    setDrawerFromFeed(false)
    focusItem(item)
    if (item.slotId) window.dispatchEvent(new CustomEvent(PLANNER_OPEN_EVENT, { detail: item.slotId }))
  }
  useEffect(() => {
    const onSelect = (e: Event) => {
      // Found even when Posted (hidden from the lists), so its page always opens
      const slotId = (e as CustomEvent<string>).detail
      const item = allPlanner.items.find((i) => i.slotId === slotId || i.id === slotId || Object.values(i.extraSlots ?? {}).includes(slotId))
      if (!item) return
      // The feed echoing a page opened here (e.g. from the calendar): stay where you are
      if (openIdRef.current === item.id) return
      setFocus({ id: item.id, reveal: Date.now() })
      // A box that belongs to a page is edited in that page (next to the feed on wide screens)
      setOpenId(item.id)
      setDrawerFromFeed(true)
    }
    window.addEventListener(FEED_SELECT_EVENT, onSelect)
    return () => window.removeEventListener(FEED_SELECT_EVENT, onSelect)
  }, [allPlanner.items])
  // Tell the feed which boxes belong to pages, so it opens the page for them instead of its own editor
  useEffect(() => {
    const ids = allPlanner.items.flatMap((i) => [i.slotId, ...Object.values(i.extraSlots ?? {})]).filter((s): s is string => !!s)
    ;(window as Window & { __plannerSlots?: string[] }).__plannerSlots = ids // for a feed that mounts later
    window.dispatchEvent(new CustomEvent(PLANNER_SLOTS_EVENT, { detail: ids }))
    // Facebook pages for the phone's Facebook tab (newest post date first, unscheduled last)
    const facebook: FacebookPage[] = allPlanner.items
      .filter((i) => i.categories.includes("Facebook"))
      .map((i) => ({ id: i.id, title: i.title, status: i.status, post: i.post.start, urls: i.media.map((m) => m.url) }))
      .sort((a, b) => (b.post ?? "").localeCompare(a.post ?? ""))
    ;(window as Window & { __plannerFacebook?: FacebookPage[] }).__plannerFacebook = facebook
    window.dispatchEvent(new CustomEvent(PLANNER_FACEBOOK_EVENT, { detail: facebook }))
  }, [allPlanner.items])
  const dangerCount = planner.alerts.filter((a) => a.alert.severity === "danger").length

  const deleteItem = async (item: ContentDTO) => {
    const ok = await confirm({
      title: "Delete item",
      message: `Delete “${item.title}”? This can't be undone.${item.slotId ? " Its box in the feed is removed too." : ""}`,
      confirmLabel: "Delete",
      variant: "danger",
    })
    if (!ok) return
    if (openId === item.id) setOpenId(null)
    planner.remove(item.id)
  }

  const deleteMany = async (ids: string[]) => {
    const inFeed = ids.filter((id) => planner.byId.get(id)?.slotId).length
    const ok = await confirm({
      title: `Delete ${ids.length} item${ids.length === 1 ? "" : "s"}`,
      message: `This can't be undone.${inFeed ? ` ${inFeed} of them ${inFeed === 1 ? "is" : "are"} in your feed and will be removed there too.` : ""}`,
      confirmLabel: `Delete ${ids.length}`,
      variant: "danger",
    })
    if (!ok) return false
    if (openId && ids.includes(openId)) setOpenId(null)
    await planner.removeMany(ids)
    return true
  }

  const deleteLink = async (link: QuickLinkDTO) => {
    const ok = await confirm({ title: "Delete link", message: `Delete “${link.name}”?`, confirmLabel: "Delete", variant: "danger" })
    if (ok) planner.removeLink(link.id)
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 lg:min-h-[calc(100dvh-4rem)] text-center">
        <h1 className="text-xl font-semibold text-zinc-950">Log in to see your content planner</h1>
        <p className="text-sm text-zinc-500 max-w-sm">Calendar, shoot and edit lists, and outfit tracking — synced with your feed.</p>
        <Link href="/login" className="px-5 h-10 inline-flex items-center rounded-full bg-zinc-900 text-white text-sm font-semibold">
          Log in
        </Link>
      </div>
    )
  }

  const loading = planner.loading || status === "loading"
  const isEmpty = !loading && planner.items.length === 0

  return (
    <div className="w-full max-w-[1200px] px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col gap-4">
      <header className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">Content Planner</h1>
          <p className="text-sm text-zinc-500 mt-0.5">New posts in your feed show up here automatically. Posted content is hidden here but stays in your feed.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <CalendarConnect />
          {postedCount > 0 && (
            <button
              type="button"
              role="switch"
              aria-checked={showPosted}
              onClick={() => setShowPosted((v) => !v)}
              className="shrink-0 inline-flex items-center gap-2 h-10 px-3 rounded-full border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:border-zinc-400 cursor-pointer"
            >
              <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${showPosted ? "bg-zinc-950" : "bg-zinc-300"}`}>
                <span className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${showPosted ? "translate-x-3.5" : "translate-x-0.5"}`} />
              </span>
              <span className="whitespace-nowrap">Show posted ({postedCount})</span>
            </button>
          )}
          <div className="flex-1 md:w-64 flex items-center gap-2 h-10 bg-white border border-soft-200 rounded-full px-3 focus-within:border-zinc-900">
            <Search size={15} className="text-zinc-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles"
              aria-label="Search titles"
              className="flex-1 min-w-0 bg-transparent text-base sm:text-sm outline-none placeholder:text-zinc-400"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="text-zinc-400 hover:text-zinc-950 cursor-pointer">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={async () => {
              const created = await planner.create()
              if (created) setOpenId(created.id)
            }}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 h-10 rounded-full bg-zinc-900 text-white text-sm font-semibold hover:bg-black cursor-pointer shadow-sm"
          >
            <Plus size={16} /> <span className="hidden sm:inline">New item</span>
          </button>
        </div>
      </header>

      {planner.error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-zinc-50 border border-zinc-100 text-zinc-950 text-sm px-4 py-2.5">
          <span className="flex-1">{planner.error}</span>
          <button onClick={() => planner.setError(null)} className="p-1 cursor-pointer" aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {SHEIN_ENABLED && planner.alerts.length > 0 && (
        <a
          href="#outfits"
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 border text-sm ${
            dangerCount ? "bg-zinc-950 border-zinc-950 text-white" : "bg-white border-zinc-950 text-zinc-950"
          }`}
        >
          <AlertTriangle size={16} className="shrink-0" />
          <span className="flex-1">
            <span className="font-semibold">
              {planner.alerts.length} outfit{planner.alerts.length === 1 ? " needs" : "s need"} attention
            </span>
            <span className="hidden sm:inline"> — {planner.alerts.slice(0, 2).map((a) => `${a.title}: ${a.alert.message.toLowerCase()}`).join(" · ")}</span>
          </span>
          <span className="font-semibold shrink-0">Review ↓</span>
        </a>
      )}

      {isEmpty && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-dashed border-soft-300 bg-white/60 p-4">
          <p className="flex-1 text-sm text-zinc-600">
            Your content database is empty. Add a post in the feed, create an item, or load clearly labelled sample data to explore.
          </p>
          <button onClick={planner.loadSamples} className="shrink-0 inline-flex items-center gap-1.5 px-4 h-9 rounded-full border border-soft-300 bg-white text-sm font-semibold hover:bg-soft-50 cursor-pointer">
            <Sparkles size={14} /> Load sample data
          </button>
        </div>
      )}

      {loading ? (
        [0, 1, 2].map((i) => <div key={i} className="bg-white border border-zinc-200 rounded-2xl h-64 animate-pulse" />)
      ) : (
        <>
          <ContentCalendar planner={planner} query={query} onOpen={open} stage={stage} onStage={setStage} />
          <AvailablePosts planner={planner} query={query} onOpen={open} />
          <ContentTable planner={planner} query={query} onOpen={open} onDeleteMany={deleteMany} focus={focus} onFocusItem={focusItem} stage={stage} onStage={setStage} />
          {SHEIN_ENABLED && (
            <OutfitsTable planner={planner} query={query} onOpen={open} onDeleteMany={deleteMany} focusId={focus?.id ?? null} onFocusItem={focusItem} />
          )}
          <QuickLinks planner={planner} onDelete={deleteLink} />
        </>
      )}

      {openItem && (
        <ItemDrawer item={openItem} planner={planner} onClose={() => setOpenId(null)} onDelete={deleteItem} onOpen={open} overlay={!drawerFromFeed} />
      )}
      <ConfirmModal {...modalProps} />
    </div>
  )
}
