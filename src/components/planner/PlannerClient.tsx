"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { AlertTriangle, Plus, Search, Sparkles, X } from "lucide-react"
import { ConfirmModal, useConfirmModal } from "@/components/ui/ConfirmModal"
import type { ContentDTO, QuickLinkDTO } from "@/lib/planner/types"
import { usePlanner } from "./usePlanner"
import { ContentCalendar } from "./ContentCalendar"
import { ContentTable } from "./ContentTable"
import { AvailablePosts } from "./AvailablePosts"
import { OutfitsTable } from "./OutfitsTable"
import { DashboardNav, QuickLinks } from "./Sidebar"
import { ItemDrawer } from "./ItemDrawer"

export function PlannerClient() {
  const { status } = useSession()
  const planner = usePlanner(status === "authenticated")
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const { confirm, modalProps } = useConfirmModal()

  const openItem = openId ? planner.byId.get(openId) ?? null : null
  const open = (item: ContentDTO) => setOpenId(item.id)
  const dangerCount = planner.alerts.filter((a) => a.alert.severity === "danger").length

  const deleteItem = async (item: ContentDTO) => {
    const childCount = planner.items.filter((i) => i.parentId === item.id).length
    const ok = await confirm({
      title: "Delete item",
      message:
        childCount > 0
          ? `Delete “${item.title}”? Its ${childCount} sub-item${childCount === 1 ? "" : "s"} will be kept as standalone items.`
          : `Delete “${item.title}”? This can't be undone.${item.slotId ? " The post in your feed is not affected." : ""}`,
      confirmLabel: "Delete",
      variant: "danger",
    })
    if (!ok) return
    if (openId === item.id) setOpenId(null)
    planner.remove(item.id)
  }

  const deleteLink = async (link: QuickLinkDTO) => {
    const ok = await confirm({ title: "Delete link", message: `Delete “${link.name}”?`, confirmLabel: "Delete", variant: "danger" })
    if (ok) planner.removeLink(link.id)
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">Log in to see your planner</h1>
        <Link href="/login" className="px-5 h-10 inline-flex items-center rounded-full bg-zinc-900 text-white text-sm font-semibold">
          Log in
        </Link>
      </div>
    )
  }

  const loading = planner.loading || status === "loading"
  const isEmpty = !loading && planner.items.length === 0

  return (
    <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col gap-4">
      <header className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900">Content Planner</h1>
          <p className="text-sm text-zinc-500 mt-0.5">One content database behind every view. New feed posts appear here automatically.</p>
        </div>
        <div className="flex items-center gap-2">
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
              <button onClick={() => setQuery("")} aria-label="Clear search" className="text-zinc-400 hover:text-zinc-900 cursor-pointer">
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
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-2.5">
          <span className="flex-1">{planner.error}</span>
          <button onClick={() => planner.setError(null)} className="p-1 cursor-pointer" aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {planner.alerts.length > 0 && (
        <a
          href="#outfits"
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 border text-sm ${
            dangerCount ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          <AlertTriangle size={16} className="shrink-0" />
          <span className="flex-1">
            <span className="font-semibold">
              {planner.alerts.length} outfit{planner.alerts.length === 1 ? " needs" : "s need"} attention
            </span>
            <span className="hidden sm:inline"> — {planner.alerts.slice(0, 2).map((a) => `${a.item.title}: ${a.alert.message.toLowerCase()}`).join(" · ")}</span>
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,31fr)_minmax(0,69fr)] items-start">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 order-2 lg:order-1">
          <DashboardNav />
          <QuickLinks planner={planner} onDelete={deleteLink} />
        </aside>
        <div className="flex flex-col gap-4 min-w-0 order-1 lg:order-2">
          {loading ? (
            [0, 1, 2].map((i) => <div key={i} className="bg-white border border-soft-200 rounded-2xl h-64 animate-pulse" />)
          ) : (
            <>
              <ContentCalendar planner={planner} query={query} onOpen={open} />
              <ContentTable planner={planner} query={query} onOpen={open} />
              <AvailablePosts planner={planner} query={query} onOpen={open} />
              <OutfitsTable planner={planner} query={query} onOpen={open} />
            </>
          )}
        </div>
      </div>

      {openItem && <ItemDrawer item={openItem} planner={planner} onClose={() => setOpenId(null)} onDelete={deleteItem} onOpen={open} />}
      <ConfirmModal {...modalProps} />
    </div>
  )
}
