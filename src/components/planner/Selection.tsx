"use client"

import { useCallback, useMemo, useState } from "react"
import { Trash2, X } from "lucide-react"
import type { Selection } from "./ContentRows"

/** Row selection for bulk actions. Selections of rows that disappear are dropped automatically. */
export function useSelection(visibleIds: string[]): Selection & { ids: string[]; clear: () => void } {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const visible = useMemo(() => new Set(visibleIds), [visibleIds])
  const live = useMemo(() => new Set([...selected].filter((id) => visible.has(id))), [selected, visible])

  const toggle = useCallback((id: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const setAll = useCallback((ids: string[], on: boolean) => {
    setSelected((s) => {
      const next = new Set(s)
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
      return next
    })
  }, [])
  const clear = useCallback(() => setSelected(new Set()), [])

  return { selected: live, toggle, setAll, ids: [...live], clear }
}

export function BulkBar({ count, onDelete, onClear }: { count: number; onDelete: () => void; onClear: () => void }) {
  if (count === 0) return null
  return (
    <div role="toolbar" aria-label="Selected items" className="flex items-center gap-2 rounded-xl bg-zinc-950 text-white px-3 py-2 animate-in fade-in slide-in-from-top-2 duration-150">
      <span className="text-sm font-medium">{count} selected</span>
      <button onClick={onDelete} className="ml-auto inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold bg-white text-zinc-950 hover:bg-zinc-200 cursor-pointer">
        <Trash2 size={13} /> Delete
      </button>
      <button onClick={onClear} aria-label="Clear selection" className="p-1.5 rounded-full hover:bg-white/10 cursor-pointer">
        <X size={15} />
      </button>
    </div>
  )
}
