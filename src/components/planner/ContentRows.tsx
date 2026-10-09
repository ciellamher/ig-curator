"use client"

import { Maximize2 } from "lucide-react"
import { itemTimeline } from "@/lib/planner/clothing"
import { formatDate } from "@/lib/planner/dates"
import { autoEditDate } from "@/lib/planner/rules"
import { shootDateOf } from "@/lib/planner/views"
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
  title: "min-w-[260px]",
  category: "min-w-[130px]",
  pinterest: "min-w-[140px]",
}

export type Selection = { selected: Set<string>; toggle: (id: string) => void; setAll: (ids: string[], on: boolean) => void }

function Checkbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: () => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate
      }}
      onChange={onChange}
      className="w-4 h-4 accent-zinc-950 cursor-pointer align-middle"
    />
  )
}

export function ContentRows({
  items,
  columns,
  planner,
  onOpen,
  empty,
  selection,
  focusId,
  onFocusItem,
}: {
  items: ContentDTO[]
  columns: Column[]
  planner: Planner
  onOpen: (item: ContentDTO) => void
  empty: string
  selection?: Selection
  focusId?: string | null
  onFocusItem?: (item: ContentDTO) => void
}) {
  const { update, byId } = planner
  const ids = items.map((i) => i.id)
  const selectedHere = selection ? ids.filter((id) => selection.selected.has(id)).length : 0

  const cell = (col: Column, item: ContentDTO) => {
    switch (col) {
      case "edited":
        return <EditedCheckbox value={item.edited} onChange={(edited) => update(item.id, { edited })} />
      case "title":
        return (
          <div className="flex items-start gap-1.5">
            <Thumb item={item} size={26} />
            <CommitInput
              multiline
              label="Title"
              value={item.title}
              onCommit={(title) => update(item.id, { title })}
              className="flex-1 text-sm leading-snug text-zinc-950 font-medium"
            />
            <button
              onClick={() => onOpen(item)}
              aria-label={`Open ${item.title}`}
              className="mt-0.5 p-1 shrink-0 rounded text-zinc-400 hover:text-zinc-950 hover:bg-zinc-200 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 cursor-pointer"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        )
      case "shoot": {
        const inherited = !item.shoot.start ? shootDateOf(item, byId) : null
        return (
          <div>
            <DateCell label="Shoot Date" value={item.shoot} onChange={(shoot) => update(item.id, { shoot })} />
            {inherited && <span className="block px-1 text-[11px] text-zinc-500">{formatDate(inherited)} · from batch</span>}
          </div>
        )
      }
      case "edit": {
        const auto = autoEditDate(item.post.start, item.categories)
        return (
          <div>
            <DateCell label="Edit Date" value={item.edit} onChange={(edit) => update(item.id, { edit })} />
            {auto && item.edit.start?.slice(0, 10) === auto && <span className="block px-1 text-[11px] text-zinc-400">auto from Post Now</span>}
          </div>
        )
      }
      case "post":
        return <DateCell label="Post Now" value={item.post} onChange={(post) => update(item.id, { post })} />
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
        const t = itemTimeline(item, byId, planner.ordersById, planner.items)
        const d = col === "orderBy" ? t.orderBy : t.windowEnd
        return d ? <span className="text-sm text-zinc-600 whitespace-nowrap">{formatDate(d)}</span> : <Empty />
      }
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200">
            {selection && (
              <th scope="col" className="w-9 px-2 py-2">
                <Checkbox
                  label="Select all"
                  checked={ids.length > 0 && selectedHere === ids.length}
                  indeterminate={selectedHere > 0 && selectedHere < ids.length}
                  onChange={() => selection.setAll(ids, selectedHere < ids.length)}
                />
              </th>
            )}
            {columns.map((c) => (
              <th key={c} scope="col" className={`font-medium px-2 py-2 whitespace-nowrap ${WIDTHS[c] ?? ""}`}>
                {HEADERS[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isSelected = !!selection?.selected.has(item.id)
            return (
              <tr
                key={item.id}
                data-row-id={item.id}
                onClick={() => onFocusItem?.(item)}
                className={`group border-b border-zinc-100 last:border-0 align-top cursor-default ${
                  item.id === focusId ? "bg-zinc-100 shadow-[inset_3px_0_0_#09090b]" : isSelected ? "bg-zinc-100" : "hover:bg-zinc-50"
                }`}
              >
                {selection && (
                  <td className="px-2 py-2.5">
                    <Checkbox label={`Select ${item.title}`} checked={isSelected} onChange={() => selection.toggle(item.id)} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c} className="px-2 py-1.5 whitespace-normal break-words">
                    {cell(c, item)}
                  </td>
                ))}
              </tr>
            )
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={columns.length + (selection ? 1 : 0)} className="px-4 py-10 text-center text-sm text-zinc-400">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
