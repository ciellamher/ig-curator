"use client"

import { GripVertical } from "lucide-react"
import { formatDate } from "@/lib/planner/dates"
import { availablePostsView, matchesSearch } from "@/lib/planner/views"
import type { ContentDTO } from "@/lib/planner/types"
import { CategoryBadges, Thumb } from "./Fields"
import { Section } from "./Section"
import type { Planner } from "./usePlanner"

/** Data type set on drag so the calendar knows a card came from Ready to Post. */
export const READY_DRAG_TYPE = "application/x-ig-curator-ready"

/** Ready to Post: everything waiting to be scheduled. Drag a card onto a calendar day to schedule it (it becomes To Edit). */
export function AvailablePosts({ planner, query, onOpen }: { planner: Planner; query: string; onOpen: (item: ContentDTO) => void }) {
  const posts = availablePostsView(planner.items.filter((i) => matchesSearch(i, query)))

  return (
    <Section title="Ready to Post" subtitle={posts.length ? "To Schedule · drag a card onto a calendar day" : "To Schedule"}>
      {posts.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-400">Nothing waiting to be scheduled. Items with status To Schedule show up here.</p>
      ) : (
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((item) => (
            <button
              key={item.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", item.id)
                e.dataTransfer.setData(READY_DRAG_TYPE, item.id)
                e.dataTransfer.effectAllowed = "move"
              }}
              onClick={() => onOpen(item)}
              title="Drag onto the calendar to schedule"
              className="group flex items-center gap-2.5 text-left rounded-xl border border-zinc-200 bg-white p-2.5 hover:border-zinc-950 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all"
            >
              <GripVertical size={14} className="shrink-0 text-zinc-300 group-hover:text-zinc-500" />
              <Thumb item={item} size={36} />
              <span className="min-w-0 flex-1 flex flex-col gap-1">
                <span className="text-sm font-medium text-zinc-950 leading-snug break-words">{item.title}</span>
                <span className="flex flex-wrap items-center gap-1">
                  <CategoryBadges value={item.categories} />
                  {item.shoot.start && <span className="text-[11px] text-zinc-400">shot {formatDate(item.shoot.start)}</span>}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Section>
  )
}
