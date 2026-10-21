"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Undo2 } from "lucide-react"
import { UNDO_SECONDS } from "./usePlanner"

/** "Deleted … · Undo" for a few seconds after pages are deleted. ⌘Z / Ctrl+Z works too while it shows. */
export function UndoDeleteBar({ undoable, onUndo }: { undoable: { key: string; count: number; title: string } | null; onUndo: () => void }) {
  const [left, setLeft] = useState(UNDO_SECONDS)
  useEffect(() => {
    if (!undoable) return
    setLeft(UNDO_SECONDS)
    const started = Date.now()
    const tick = setInterval(() => setLeft(Math.max(0, UNDO_SECONDS - Math.floor((Date.now() - started) / 1000))), 250)
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault()
        onUndo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      clearInterval(tick)
      window.removeEventListener("keydown", onKey)
    }
  }, [undoable, onUndo])

  if (!undoable || typeof document === "undefined") return null
  const what = undoable.count === 1 ? `“${undoable.title.length > 40 ? undoable.title.slice(0, 40) + "…" : undoable.title}”` : `${undoable.count} pages`
  return createPortal(
    <div role="status" className="fixed z-[130] bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 pl-4 pr-1.5 py-1.5 rounded-full bg-zinc-950 text-white shadow-2xl text-sm max-w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-2 duration-200">
      <span className="truncate">Deleted {what}</span>
      <button
        onClick={onUndo}
        className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-100 cursor-pointer"
      >
        <Undo2 size={14} /> Undo <span className="text-zinc-400 tabular-nums">{left}s</span>
      </button>
    </div>,
    document.body,
  )
}
