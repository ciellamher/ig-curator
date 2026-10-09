"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { ORDER_LEAD_DAYS, RETURN_REMINDER_DAY, RETURN_WINDOW_DAYS } from "@/lib/planner/clothing"
import { formatDate } from "@/lib/planner/dates"
import { matchesSearch, outfitsView } from "@/lib/planner/views"
import type { ContentDTO } from "@/lib/planner/types"
import { ContentRows, type Column, type Row } from "./ContentRows"
import { Section } from "./Section"
import type { Planner } from "./usePlanner"

// Original Outfits columns, followed by the SHEIN deadline columns (an app addition).
const COLUMNS: Column[] = ["title", "edit", "clothing", "category", "pinterest", "shoot", "orderBy", "returnBy"]

export function OutfitsTable({ planner, query, onOpen }: { planner: Planner; query: string; onOpen: (item: ContentDTO) => void }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const groups = outfitsView(planner.items.filter((i) => matchesSearch(i, query)))

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const rows: Row[] = groups.flatMap((g) => {
    const isCollapsed = collapsed.has(g.item.id)
    const parent: Row = {
      item: g.item,
      contextOnly: !g.matches,
      childCount: g.children.length,
      collapsed: isCollapsed,
      onToggle: g.children.length ? () => toggle(g.item.id) : undefined,
    }
    return [parent, ...(isCollapsed ? [] : g.children.map((item) => ({ item, depth: 1 as const })))]
  })

  const alerts = planner.alerts

  return (
    <Section
      id="outfits"
      title="Outfits to Prep"
      subtitle={`Order ${ORDER_LEAD_DAYS} days before the shoot · return by day ${RETURN_REMINDER_DAY} of ${RETURN_WINDOW_DAYS}`}
    >
      {alerts.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Outfit alerts">
          {alerts.map(({ item, alert }) => (
            <li key={item.id}>
              <button
                onClick={() => onOpen(item)}
                className={`w-full flex items-center gap-2 text-left rounded-lg px-3 py-2 text-sm border cursor-pointer ${
                  alert.severity === "danger" ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
              >
                <AlertTriangle size={14} className="shrink-0" />
                <span className="font-medium truncate">{item.title}</span>
                <span className="ml-auto shrink-0 text-xs">
                  {alert.message} · {formatDate(alert.date)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ContentRows rows={rows} columns={COLUMNS} planner={planner} onOpen={onOpen} empty="No outfits to prep. Set a Clothing status on an item to track it here." />
    </Section>
  )
}
