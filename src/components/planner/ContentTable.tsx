"use client"

import { useState } from "react"
import { matchesSearch, toEditView, toPostView, toShootView, type EditedFilter } from "@/lib/planner/views"
import type { ContentDTO } from "@/lib/planner/types"
import { ContentRows, type Column } from "./ContentRows"
import { Section, Tabs } from "./Section"
import type { Planner } from "./usePlanner"

type Tab = "shoot" | "edit" | "post"

const TABS: { id: Tab; label: string }[] = [
  { id: "shoot", label: "To Shoot" },
  { id: "edit", label: "To Edit" },
  { id: "post", label: "To Post" },
]

const COLUMNS: Record<Tab, Column[]> = {
  shoot: ["title", "shoot", "status", "category", "pinterest"],
  edit: ["edited", "title", "edit", "post", "status", "category", "pinterest"],
  post: ["edited", "title", "post", "status", "category", "pinterest"],
}

const EMPTY: Record<Tab, string> = {
  shoot: "Nothing in the To-do stage.",
  edit: "Nothing waiting to be edited.",
  post: "Nothing is Ready to Post.",
}

export function ContentTable({ planner, query, onOpen }: { planner: Planner; query: string; onOpen: (item: ContentDTO) => void }) {
  const [tab, setTab] = useState<Tab>("shoot")
  const [edited, setEdited] = useState<EditedFilter>("any")

  const source = planner.items.filter((i) => matchesSearch(i, query))
  const rows = (tab === "shoot" ? toShootView(source) : tab === "edit" ? toEditView(source) : toPostView(source, edited)).map((item) => ({ item }))

  return (
    <Section
      title="Content"
      actions={
        tab === "post" && (
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            Edited
            <select
              value={edited}
              onChange={(e) => setEdited(e.target.value as EditedFilter)}
              className="h-7 rounded-md border border-soft-200 bg-white px-1.5 text-xs text-zinc-700 cursor-pointer"
            >
              <option value="any">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        )
      }
    >
      <Tabs tabs={TABS} value={tab} onChange={setTab} counts={{ shoot: toShootView(source).length, edit: toEditView(source).length, post: toPostView(source, edited).length }} />
      <ContentRows rows={rows} columns={COLUMNS[tab]} planner={planner} onOpen={onOpen} empty={query ? "No titles match your search." : EMPTY[tab]} />
    </Section>
  )
}
