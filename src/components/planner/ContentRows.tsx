"use client"

import { ChevronRight, CornerDownRight, Maximize2 } from "lucide-react"
import { clothingTimeline } from "@/lib/planner/clothing"
import { formatDate } from "@/lib/planner/dates"
import type { ContentDTO } from "@/lib/planner/types"
import { CategorySelect, ClothingSelect, CommitInput, DateCell, EditedCheckbox, Empty, PinterestLink, StatusSelect, Thumb } from "./Fields"
import type { Planner } from "./usePlanner"

export type Column = "edited" | "title" | "shoot" | "edit" | "post" | "status" | "category" | "pinterest" | "clothing" | "orderBy" | "returnBy"

const HEADERS: Record<Column, string> = {
  edited: "Edited",
  title: "Title",
  shoot: "Shoot Date",
  edit: "Edit Date",
  post: "Post Now",
  status: "Status",
  category: "Category",
  pinterest: "Pinterest",
  clothing: "Clothing",
  orderBy: "Order by",
  returnBy: "Return by",
}

const WIDTHS: Partial<Record<Column, string>> = {
  edited: "w-14",
  title: "min-w-[280px]",
  category: "min-w-[130px]",
  pinterest: "min-w-[140px]",
}

export type Row = {
  item: ContentDTO
  depth?: 0 | 1
  /** Shown only to give a matching sub-item its parent context; it doesn't meet the view's filter itself. */
  contextOnly?: boolean
  childCount?: number
  collapsed?: boolean
  onToggle?: () => void
}

export function ContentRows({
  rows,
  columns,
  planner,
  onOpen,
  empty,
}: {
  rows: Row[]
  columns: Column[]
  planner: Planner
  onOpen: (item: ContentDTO) => void
  empty: string
}) {
  const { update, byId } = planner

  const cell = (col: Column, row: Row) => {
    const { item } = row
    switch (col) {
      case "edited":
        return <EditedCheckbox value={item.edited} onChange={(edited) => update(item.id, { edited })} />
      case "title":
        return (
          <div className={`flex items-start gap-1.5 ${row.depth ? "pl-5" : ""}`}>
            {row.onToggle ? (
              <button
                onClick={row.onToggle}
                aria-label={row.collapsed ? "Expand sub-items" : "Collapse sub-items"}
                aria-expanded={!row.collapsed}
                className="mt-1 w-5 h-5 shrink-0 flex items-center justify-center rounded text-zinc-400 hover:bg-soft-200 cursor-pointer"
              >
                <ChevronRight size={14} className={`transition-transform ${row.collapsed ? "" : "rotate-90"}`} />
              </button>
            ) : row.depth ? (
              <CornerDownRight size={13} className="mt-1.5 shrink-0 text-zinc-300" />
            ) : null}
            <Thumb item={item} size={26} />
            <CommitInput
              multiline
              label="Title"
              value={item.title}
              onCommit={(title) => update(item.id, { title })}
              className={`flex-1 text-sm leading-snug ${row.contextOnly ? "text-zinc-400 italic" : "text-zinc-900 font-medium"}`}
            />
            {row.contextOnly && <span className="mt-1 shrink-0 text-[10px] uppercase tracking-wide text-zinc-400">parent</span>}
            <button
              onClick={() => onOpen(item)}
              aria-label={`Open ${item.title}`}
              className="mt-0.5 p-1 shrink-0 rounded text-zinc-400 hover:text-zinc-900 hover:bg-soft-200 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 cursor-pointer"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        )
      case "shoot":
      case "edit":
      case "post":
        return <DateCell label={HEADERS[col]} value={item[col]} onChange={(s) => update(item.id, { [col]: s })} />
      case "status":
        return <StatusSelect value={item.status} onChange={(status) => update(item.id, { status })} />
      case "category":
        return <CategorySelect value={item.categories} onChange={(categories) => update(item.id, { categories })} />
      case "pinterest":
        return <PinterestLink url={item.pinterestUrl} />
      case "clothing":
        return <ClothingSelect value={item.clothingStatus} onChange={(clothingStatus) => update(item.id, { clothingStatus })} />
      case "orderBy":
      case "returnBy": {
        if (!item.clothingStatus) return <Empty />
        const t = clothingTimeline(item, byId)
        const d = col === "orderBy" ? t.orderBy : t.returnBy
        return d ? <span className="text-sm text-zinc-600 whitespace-nowrap">{formatDate(d)}</span> : <Empty />
      }
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs text-zinc-500 border-b border-soft-200">
            {columns.map((c) => (
              <th key={c} scope="col" className={`font-medium px-2 py-2 whitespace-nowrap ${WIDTHS[c] ?? ""}`}>
                {HEADERS[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.item.id} className={`group border-b border-soft-100 last:border-0 align-top hover:bg-soft-50/70 ${row.contextOnly ? "bg-soft-50/40" : ""}`}>
              {columns.map((c) => (
                <td key={c} className="px-2 py-1.5 whitespace-normal break-words">
                  {cell(c, row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-zinc-400">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
