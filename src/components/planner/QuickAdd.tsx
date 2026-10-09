"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { Dropdown } from "@/components/ui/Dropdown"
import { formatDate, type DateField } from "@/lib/planner/dates"
import { DEFAULT_STATUS, STATUS_OPTIONS, STATUS_STYLES } from "@/lib/planner/options"
import { autoEditDate } from "@/lib/planner/rules"
import { toggleCategory } from "@/lib/planner/feed"
import type { ContentPatch } from "@/lib/planner/types"
import { Badge } from "./Fields"

const QUICK_CATEGORIES = ["Post", "Reels", "Story"]

/** Small dialog for adding an item straight onto a calendar day. */
export function QuickAdd({
  day,
  field,
  fieldLabel,
  onClose,
  onCreate,
}: {
  day: string
  field: DateField
  fieldLabel: string
  onClose: () => void
  onCreate: (patch: ContentPatch, openAfter: boolean) => Promise<void>
}) {
  const [title, setTitle] = useState("")
  const [categories, setCategories] = useState<string[]>(["Post"])
  const [status, setStatus] = useState<string>(DEFAULT_STATUS)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const submit = async (openAfter: boolean) => {
    if (saving) return
    setSaving(true)
    await onCreate({ title: title.trim() || "Untitled", categories, status, [field]: { start: day, end: null } }, openAfter)
  }

  const autoEdit = field === "post" ? autoEditDate(day, categories) : null

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/20 animate-in fade-in duration-150" onClick={onClose} />
      <form
        role="dialog"
        aria-label={`Add on ${formatDate(day)}`}
        onSubmit={(e) => {
          e.preventDefault()
          submit(false)
        }}
        className="fixed z-[95] inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/3 sm:-translate-x-1/2 sm:w-[400px] bg-white rounded-2xl shadow-2xl border border-zinc-200 p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150 pb-safe"
      >
        <div className="flex items-center">
          <div>
            <div className="text-xs font-medium text-zinc-500">{fieldLabel}</div>
            <div className="text-sm font-semibold text-zinc-950">{formatDate(day, { weekday: true })}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto p-1.5 rounded-full text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What are you planning?"
          aria-label="Title"
          className="h-11 px-3 rounded-xl border border-zinc-200 text-base sm:text-sm focus:outline-none focus:border-zinc-950 focus:ring-4 focus:ring-zinc-950/5"
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1" role="group" aria-label="Category">
            {QUICK_CATEGORIES.map((c) => {
              const on = categories.includes(c)
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCategories(toggleCategory(categories, c))}
                  className={`px-3 h-8 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                    on ? "bg-zinc-950 text-white border-zinc-950" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  {c}
                </button>
              )
            })}
          </div>
          <div className="ml-auto">
            <Dropdown
              label="Status"
              options={STATUS_OPTIONS.map((o) => ({ value: o.name, group: o.group }))}
              selected={[status]}
              onSelect={setStatus}
              trigger={<Badge value={status} styles={STATUS_STYLES} />}
              renderOption={(o) => <Badge value={o.value} styles={STATUS_STYLES} />}
            />
          </div>
        </div>

        {autoEdit && (
          <p className="text-xs text-zinc-500">
            Edit date set automatically to <span className="font-semibold text-zinc-800">{formatDate(autoEdit, { weekday: true })}</span> (
            {categories.includes("Story") ? "3 days" : "1 week"} before posting)
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => submit(true)} disabled={saving} className="px-3 h-9 rounded-full text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 cursor-pointer">
            Add &amp; open
          </button>
          <button type="submit" disabled={saving} className="px-4 h-9 rounded-full text-sm font-semibold bg-zinc-950 text-white hover:bg-black disabled:opacity-50 cursor-pointer">
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </>
  )
}
