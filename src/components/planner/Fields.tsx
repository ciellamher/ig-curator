"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Image as ImageIcon } from "lucide-react"
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown"
import { toggleCategory } from "@/lib/planner/feed"
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

function toOptions(options: readonly { name: string; group?: StatusGroup }[]): DropdownOption[] {
  return options.map((o) => ({ value: o.name, group: o.group }))
}

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
  const opts = [...(allowEmpty ? [{ value: "", label: "None" }] : []), ...toOptions(options)]
  return (
    <Dropdown
      variant="ghost"
      label={label}
      options={opts}
      selected={[value ?? ""]}
      onSelect={(v) => onChange(v || null)}
      trigger={value ? <Badge value={value} styles={styles} /> : <Empty />}
      renderOption={(o) => (o.value ? <Badge value={o.value} styles={styles} /> : <span className="text-zinc-400 text-xs">None</span>)}
    />
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

/** Multi-select dropdown for categories. */
export function CategorySelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Dropdown
      variant="ghost"
      multiple
      label="Category"
      options={CATEGORY_OPTIONS.map((c) => ({ value: c }))}
      selected={value}
      onSelect={(c) => onChange(toggleCategory(value, c))}
      trigger={<CategoryBadges value={value} />}
      renderOption={(o) => <Badge value={o.value} styles={CATEGORY_STYLES} />}
      className="whitespace-normal"
    />
  )
}

/** Edited on/off switch (a switch, so it doesn't read as another row-selection checkbox). */
export function EditedCheckbox({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label="Edited"
      title={value ? "Edited" : "Not edited yet"}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/30 ${
        value ? "bg-zinc-950" : "bg-zinc-200 hover:bg-zinc-300"
      }`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
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

export function Thumb({ item, size = 28 }: { item: ContentDTO; size?: number }) {
  const url = item.media[0]?.url
  const style = { width: size, height: size }
  const fallback = (
    <div style={style} className="shrink-0 rounded-md bg-soft-100 flex items-center justify-center text-zinc-300">
      <ImageIcon size={Math.round(size * 0.45)} />
    </div>
  )
  if (!url) {
    return fallback
  }
  return <LocalMediaImage src={url} style={style} className="shrink-0 rounded-md object-cover" fallback={fallback} />
}
