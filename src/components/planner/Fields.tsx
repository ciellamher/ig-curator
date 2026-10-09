"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ExternalLink, Image as ImageIcon } from "lucide-react"
import { LocalMediaImage } from "@/components/grid/LocalMedia"
import {
  CATEGORY_OPTIONS,
  CATEGORY_STYLES,
  CLOTHING_OPTIONS,
  CLOTHING_STYLES,
  STATUS_OPTIONS,
  STATUS_STYLES,
  type StatusGroup,
} from "@/lib/planner/options"
import { datePart, formatDate, moveSchedule, timePart, withTime, type Schedule } from "@/lib/planner/dates"
import type { ContentDTO } from "@/lib/planner/types"

const FIELD = "rounded-md hover:bg-soft-100 focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/15"

export function Badge({ value, styles }: { value: string; styles: Record<string, string> }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${styles[value] ?? "bg-zinc-100 text-zinc-600"}`}>
      {value}
    </span>
  )
}

export function Empty() {
  return <span className="text-zinc-300">—</span>
}

function grouped<T extends { name: string; group: StatusGroup }>(options: readonly T[]) {
  const groups: [StatusGroup, T[]][] = []
  for (const o of options) {
    const last = groups[groups.length - 1]
    if (last?.[0] === o.group) last[1].push(o)
    else groups.push([o.group, [o]])
  }
  return groups
}

/** Native select rendered as a badge, so it stays keyboard- and screen-reader-friendly. */
function BadgeSelect({
  label,
  value,
  options,
  styles,
  onChange,
  allowEmpty,
}: {
  label: string
  value: string | null
  options: readonly { name: string; group: StatusGroup }[]
  styles: Record<string, string>
  onChange: (v: string | null) => void
  allowEmpty?: boolean
}) {
  return (
    <div className={`relative inline-flex p-0.5 ${FIELD} focus-within:ring-2 focus-within:ring-zinc-900/15`}>
      {value ? <Badge value={value} styles={styles} /> : <Empty />}
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
      >
        {allowEmpty && <option value="">Empty</option>}
        {grouped(options).map(([group, opts]) => (
          <optgroup key={group} label={group}>
            {opts.map((o) => (
              <option key={o.name} value={o.name}>
                {o.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

export function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <BadgeSelect label="Status" value={value} options={STATUS_OPTIONS} styles={STATUS_STYLES} onChange={(v) => v && onChange(v)} />
}

export function ClothingSelect({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return <BadgeSelect label="Clothing" value={value} options={CLOTHING_OPTIONS} styles={CLOTHING_STYLES} onChange={onChange} allowEmpty />
}

export function CategoryBadges({ value }: { value: string[] }) {
  if (value.length === 0) return <Empty />
  return (
    <span className="inline-flex flex-wrap gap-1">
      {value.map((c) => (
        <Badge key={c} value={c} styles={CATEGORY_STYLES} />
      ))}
    </span>
  )
}

/** Multi-select popover for categories. */
export function CategorySelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const toggle = (c: string) => onChange(value.includes(c) ? value.filter((v) => v !== c) : [...value, c])

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="Category" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`text-left p-0.5 min-h-6 cursor-pointer ${FIELD}`}>
        <CategoryBadges value={value} />
      </button>
      {open && (
        <div role="group" aria-label="Categories" className="absolute z-30 mt-1 left-0 w-44 bg-white border border-soft-200 rounded-xl shadow-lg p-1 animate-in fade-in zoom-in-95 duration-150">
          {CATEGORY_OPTIONS.map((c) => {
            const on = value.includes(c)
            return (
              <button
                key={c}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(c)}
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-soft-100 cursor-pointer"
              >
                <Badge value={c} styles={CATEGORY_STYLES} />
                {on && <Check size={14} className="text-zinc-700" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function EditedCheckbox({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      aria-label="Edited"
      checked={value}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 accent-zinc-900 cursor-pointer align-middle"
    />
  )
}

/** Inline start-date input. Changing the day keeps any time and shifts an end date by the same amount. */
export function DateCell({ label, value, onChange }: { label: string; value: Schedule; onChange: (s: Schedule) => void }) {
  const hasExtra = value.start && (timePart(value.start) || value.end)
  return (
    <div className="flex flex-col">
      <input
        type="date"
        aria-label={label}
        value={value.start ? datePart(value.start) : ""}
        onChange={(e) => onChange(e.target.value ? moveSchedule(value, e.target.value) : { start: null, end: null })}
        className={`bg-transparent text-sm px-1 py-0.5 cursor-pointer ${FIELD} ${value.start ? "text-zinc-700" : "text-zinc-300"}`}
      />
      {hasExtra && (
        <span className="px-1 text-[11px] text-zinc-400">
          {timePart(value.start!) ? formatDate(value.start).split(" ").slice(-2).join(" ") : ""}
          {value.end ? ` → ${formatDate(value.end)}` : ""}
        </span>
      )}
    </div>
  )
}

/** Full schedule editor: date, optional time, optional end date/time. */
export function ScheduleEditor({ label, value, onChange }: { label: string; value: Schedule; onChange: (s: Schedule) => void }) {
  const startTime = value.start ? timePart(value.start) : null
  const endTime = value.end ? timePart(value.end) : null
  const input = `bg-transparent text-sm text-zinc-700 px-1.5 py-1 border border-soft-200 cursor-pointer ${FIELD}`

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          aria-label={label}
          value={value.start ? datePart(value.start) : ""}
          onChange={(e) => onChange(e.target.value ? moveSchedule(value, e.target.value) : { start: null, end: null })}
          className={input}
        />
        {value.start && startTime !== null && (
          <input
            type="time"
            aria-label={`${label} time`}
            value={startTime}
            onChange={(e) => onChange({ ...value, start: withTime(datePart(value.start!), e.target.value || null) })}
            className={input}
          />
        )}
        {value.start && (
          <button
            type="button"
            onClick={() => onChange({ ...value, start: withTime(datePart(value.start!), startTime ? null : "09:00") })}
            className="text-xs text-zinc-500 hover:text-zinc-900 px-1.5 py-1 rounded-md hover:bg-soft-100 cursor-pointer"
          >
            {startTime ? "Remove time" : "Add time"}
          </button>
        )}
      </div>
      {value.start && (
        <div className="flex flex-wrap items-center gap-1.5">
          {value.end ? (
            <>
              <span className="text-xs text-zinc-400">ends</span>
              <input
                type="date"
                aria-label={`${label} end`}
                value={datePart(value.end)}
                min={datePart(value.start)}
                onChange={(e) => onChange({ ...value, end: e.target.value ? withTime(e.target.value, endTime) : null })}
                className={input}
              />
              {endTime !== null && (
                <input
                  type="time"
                  aria-label={`${label} end time`}
                  value={endTime}
                  onChange={(e) => onChange({ ...value, end: withTime(datePart(value.end!), e.target.value || null) })}
                  className={input}
                />
              )}
              <button type="button" onClick={() => onChange({ ...value, end: null })} className="text-xs text-zinc-500 hover:text-zinc-900 px-1.5 py-1 rounded-md hover:bg-soft-100 cursor-pointer">
                Remove end
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onChange({ ...value, end: withTime(datePart(value.start!), startTime ? startTime : null) })}
              className="text-xs text-zinc-500 hover:text-zinc-900 px-1.5 py-1 rounded-md hover:bg-soft-100 cursor-pointer"
            >
              Add end date
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Text field that commits on blur / Enter, so typing doesn't send a request per keystroke. `multiline` wraps long text. */
export function CommitInput({
  value,
  onCommit,
  className = "",
  placeholder,
  label,
  type = "text",
  multiline,
}: {
  value: string
  onCommit: (v: string) => void
  className?: string
  placeholder?: string
  label: string
  type?: string
  multiline?: boolean
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const props = {
    "aria-label": label,
    value: draft,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: () => draft !== value && onCommit(draft),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        e.currentTarget.blur()
      }
      if (e.key === "Escape") {
        setDraft(value)
        e.currentTarget.blur()
      }
    },
    className: `min-w-0 bg-transparent px-1.5 py-1 placeholder:text-zinc-300 ${FIELD} ${className}`,
  }
  return multiline ? <textarea rows={1} {...props} className={`${props.className} resize-none field-sizing-content`} /> : <input type={type} {...props} />
}

export function PinterestLink({ url }: { url: string | null }) {
  if (!url) return <Empty />
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 underline decoration-soft-300 underline-offset-2 break-all"
    >
      {url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 32)}
      <ExternalLink size={11} className="shrink-0" />
    </a>
  )
}

export function Thumb({ item, size = 28 }: { item: ContentDTO; size?: number }) {
  const url = item.media[0]?.url
  const style = { width: size, height: size }
  if (!url) {
    return (
      <div style={style} className="shrink-0 rounded-md bg-soft-100 flex items-center justify-center text-zinc-300">
        <ImageIcon size={Math.round(size * 0.45)} />
      </div>
    )
  }
  return <LocalMediaImage src={url} style={style} className="shrink-0 rounded-md object-cover" />
}
