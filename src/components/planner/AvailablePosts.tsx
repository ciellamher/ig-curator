"use client"

import { availablePostsView, matchesSearch } from "@/lib/planner/views"
import type { ContentDTO } from "@/lib/planner/types"
import { CategoryBadges, Thumb } from "./Fields"
import { Section } from "./Section"
import type { Planner } from "./usePlanner"

function Card({ item, onOpen, muted }: { item: ContentDTO; onOpen: (i: ContentDTO) => void; muted?: boolean }) {
  return (
    <button onClick={() => onOpen(item)} className="w-full flex items-start gap-2 text-left rounded-lg p-1.5 -m-1.5 hover:bg-soft-50 cursor-pointer">
      <Thumb item={item} size={32} />
      <span className="min-w-0 flex flex-col gap-1">
        <span className={`text-sm leading-snug break-words ${muted ? "text-zinc-400 italic" : "font-medium text-zinc-900"}`}>{item.title}</span>
        {!muted && <CategoryBadges value={item.categories} />}
      </span>
    </button>
  )
}

/** "Available Posts": unscheduled In progress / Ready to Post content, grouped under parents. */
export function AvailablePosts({ planner, query, onOpen }: { planner: Planner; query: string; onOpen: (item: ContentDTO) => void }) {
  const groups = availablePostsView(planner.items.filter((i) => matchesSearch(i, query)))

  return (
    <Section title="Ready to Post" subtitle="Available Posts">
      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">No unscheduled posts in progress or ready.</p>
      ) : (
        <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <article key={g.item.id} className="rounded-xl border border-soft-200 p-3 flex flex-col gap-2.5">
              <Card item={g.item} onOpen={onOpen} muted={!g.matches} />
              {g.children.length > 0 && (
                <details open={!g.matches} className="group/sub">
                  <summary className="text-xs text-zinc-500 cursor-pointer select-none hover:text-zinc-800">
                    {g.children.length} sub-item{g.children.length === 1 ? "" : "s"}
                  </summary>
                  <div className="mt-2 pl-3 border-l border-soft-200 flex flex-col gap-2.5">
                    {g.children.map((c) => (
                      <Card key={c.id} item={c} onOpen={onOpen} />
                    ))}
                  </div>
                </details>
              )}
            </article>
          ))}
        </div>
      )}
    </Section>
  )
}
