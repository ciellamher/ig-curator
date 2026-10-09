"use client"

import { Dropdown } from "@/components/ui/Dropdown"
import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { byTitle, matchesSearch, sortBy, toEditView, toPostView, toShootView, type EditedFilter } from "@/lib/planner/views"
import type { ContentDTO } from "@/lib/planner/types"
import { ContentRows, type Column } from "./ContentRows"
import { Section, Tabs } from "./Section"
import { BulkBar, useSelection } from "./Selection"
import type { Planner } from "./usePlanner"
import type { DateField } from "@/lib/planner/dates"

type Tab = "shoot" | "edit" | "post" | "all"

const TABS: { id: Tab; label: string }[] = [
  { id: "shoot", label: "To Shoot" },
  { id: "edit", label: "To Edit" },
  { id: "post", label: "To Post" },
  { id: "all", label: "All" },
]

const COLUMNS: Record<Tab, Column[]> = {
  shoot: ["title", "shoot", "status", "category", "pinterest"],
  edit: ["edited", "title", "edit", "post", "status", "category", "pinterest"],
  post: ["edited", "title", "post", "status", "category", "pinterest"],
  all: ["title", "status", "category", "shoot", "edit", "post"],
}

/** New items start in the stage of the tab they're added from. */
const NEW_STATUS: Record<Tab, string | null> = { shoot: "To Shoot", edit: "To Edit", post: "Ready to Post", all: null }

const EMPTY: Record<Tab, string> = {
  shoot: "Nothing in the To-do stage.",
  edit: "Nothing waiting to be edited.",
  post: "Nothing is Ready to Post.",
  all: "No content yet. Add a post in the feed, or use + on a calendar day.",
}

export function ContentTable({
  planner,
  query,
  onOpen,
  onDeleteMany,
  focus,
  onFocusItem,
  stage,
  onStage,
}: {
  planner: Planner
  query: string
  onOpen: (item: ContentDTO) => void
  onDeleteMany: (ids: string[]) => Promise<boolean>
  focus?: { id: string; reveal: number } | null
  onFocusItem?: (item: ContentDTO) => void
  stage: DateField
  onStage: (stage: DateField) => void
}) {
  const [tab, setTabState] = useState<Tab>(stage)
  const setTab = (t: Tab) => {
    setTabState(t)
    if (t !== "all") onStage(t)
  }
  // The calendar switched stage: show the same tab
  useEffect(() => {
    setTabState((t) => (t === stage ? t : stage))
  }, [stage])
  const [edited, setEdited] = useState<EditedFilter>("any")

  const source = planner.items.filter((i) => matchesSearch(i, query))
  const views: Record<Tab, ContentDTO[]> = {
    shoot: toShootView(source),
    edit: toEditView(source),
    post: toPostView(source, edited),
    all: sortBy(source, byTitle),
  }
  const rows = views[tab]
  const selection = useSelection(rows.map((i) => i.id))

  // A box picked in the feed: open the tab that lists it and bring its row into view
  useEffect(() => {
    if (!focus?.reveal) return
    const order: Tab[] = ["shoot", "edit", "post", "all"]
    const target = order.find((t) => views[t].some((i) => i.id === focus.id))
    if (target && target !== tab) setTab(target)
    const t = setTimeout(() => {
      if (!window.matchMedia("(min-width: 1024px)").matches) return // phones: feed is above, don't jump away
      document.querySelector(`[data-row-id="${CSS.escape(focus.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 60)
    return () => clearTimeout(t)
  }, [focus?.id, focus?.reveal]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Section
      title="Content"
      actions={
        <>
          {tab === "post" && (
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              Edited
              <Dropdown
                label="Edited filter"
                options={[
                  { value: "any", label: "Any" },
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
                selected={[edited]}
                onSelect={(v) => setEdited(v as EditedFilter)}
                className="w-24"
              />
            </div>
          )}
          <button
            onClick={async () => {
              const created = await planner.create({ title: "Untitled", ...(NEW_STATUS[tab] ? { status: NEW_STATUS[tab] } : {}) })
              if (created) onOpen(created)
            }}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold bg-zinc-950 text-white hover:bg-black cursor-pointer"
          >
            <Plus size={14} /> Add
          </button>
        </>
      }
    >
      <Tabs
        tabs={TABS}
        value={tab}
        onChange={(t) => {
          setTab(t)
          selection.clear()
        }}
        counts={{ shoot: views.shoot.length, edit: views.edit.length, post: views.post.length, all: views.all.length }}
      />
      <BulkBar
        count={selection.ids.length}
        onClear={selection.clear}
        onDelete={async () => {
          if (await onDeleteMany(selection.ids)) selection.clear()
        }}
      />
      <ContentRows
        items={rows}
        columns={COLUMNS[tab]}
        planner={planner}
        onOpen={onOpen}
        selection={selection}
        focusId={focus?.id ?? null}
        onFocusItem={onFocusItem}
        empty={query ? "No titles match your search." : EMPTY[tab]}
      />
    </Section>
  )
}
