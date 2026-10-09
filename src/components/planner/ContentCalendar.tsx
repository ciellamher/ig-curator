"use client"

import { useMemo, useState } from "react"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { clothingTimeline, effectiveShootDate } from "@/lib/planner/clothing"
import { addDaysISO, formatDate, formatSchedule, moveSchedule, scheduleCovers, todayISO, weekday, type DateField } from "@/lib/planner/dates"
import { STATUS_NAMES, STATUS_STYLES } from "@/lib/planner/options"
import { matchesSearch, parentFocused } from "@/lib/planner/views"
import type { ContentDTO } from "@/lib/planner/types"
import { Badge, CategoryBadges } from "./Fields"
import { Section, Tabs } from "./Section"
import type { Planner } from "./usePlanner"

type Mode = "shoot-week" | "shoot-month" | "edit" | "post"
type CalEvent = { key: string; item: ContentDTO; kind: "date" | "order" | "return"; date?: string }

const MODES: { id: Mode; label: string }[] = [
  { id: "shoot-week", label: "Shoot · Week" },
  { id: "shoot-month", label: "Shoot · Month" },
  { id: "edit", label: "Edit" },
  { id: "post", label: "Post" },
]
const FIELD: Record<Mode, DateField> = { "shoot-week": "shoot", "shoot-month": "shoot", edit: "edit", post: "post" }
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

const MARKER_STYLE = {
  order: "bg-white text-rose-700 ring-1 ring-inset ring-rose-300 border-dashed",
  return: "bg-white text-orange-700 ring-1 ring-inset ring-orange-300",
}

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`
}

export function ContentCalendar({ planner, query, onOpen }: { planner: Planner; query: string; onOpen: (item: ContentDTO) => void }) {
  const { items, byId, update } = planner
  const today = todayISO()
  const [mode, setMode] = useState<Mode>("shoot-month")
  const [cursor, setCursor] = useState(today)
  const [selected, setSelected] = useState(today)
  const [statusFilter, setStatusFilter] = useState("All")
  const [dragOver, setDragOver] = useState<string | null>(null)
  const field = FIELD[mode]
  const isWeek = mode === "shoot-week"

  const days = useMemo(() => {
    if (isWeek) {
      const start = addDaysISO(cursor, -weekday(cursor))
      return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i))
    }
    const first = monthStart(cursor)
    const start = addDaysISO(first, -weekday(first))
    const nextMonth = monthStart(addDaysISO(first, 32))
    const count = Math.ceil((weekday(first) + Number(addDaysISO(nextMonth, -1).slice(8))) / 7) * 7
    return Array.from({ length: count }, (_, i) => addDaysISO(start, i))
  }, [cursor, isWeek])

  const visible = useMemo(() => {
    const filtered = items.filter((i) => matchesSearch(i, query) && (statusFilter === "All" || i.status === statusFilter))
    // Edit is parent-focused; Shoot and Post show parents and sub-items as independent entries.
    return field === "edit" ? parentFocused(filtered, (i) => !!i.edit.start) : filtered.filter((i) => i[field].start)
  }, [items, query, statusFilter, field])

  const eventsOn = (day: string): CalEvent[] => {
    const out: CalEvent[] = visible.filter((i) => scheduleCovers(i[field], day)).map((item) => ({ key: `${item.id}-${field}`, item, kind: "date" }))
    if (field === "shoot") {
      // App addition: SHEIN order/return deadlines alongside shoots.
      for (const item of items) {
        if (!item.clothingStatus || !matchesSearch(item, query) || !effectiveShootDate(item, byId)) continue
        const t = clothingTimeline(item, byId)
        if (item.clothingStatus === "Buy Clothes" && t.orderBy === day) out.push({ key: `${item.id}-order`, item, kind: "order", date: day })
        if ((item.clothingStatus === "Ordered" || item.clothingStatus === "Delivered") && t.returnBy === day)
          out.push({ key: `${item.id}-return`, item, kind: "return", date: day })
      }
    }
    return out
  }

  const step = (dir: 1 | -1) => setCursor((c) => (isWeek ? addDaysISO(c, dir * 7) : monthStart(addDaysISO(monthStart(c), dir === 1 ? 32 : -1))))
  const [y, m] = cursor.split("-").map(Number)
  const heading = isWeek ? `${formatDate(days[0])} – ${formatDate(days[6])}` : `${MONTHS[m - 1]} ${y}`

  const childCount = (id: string) => items.filter((i) => i.parentId === id).length

  const card = (e: CalEvent, compact: boolean) => {
    const { item } = e
    if (e.kind !== "date") {
      return (
        <button
          key={e.key}
          onClick={() => onOpen(item)}
          className={`w-full text-left rounded-md px-1.5 py-0.5 text-[11px] font-medium truncate cursor-pointer ${MARKER_STYLE[e.kind]}`}
          title={`${e.kind === "order" ? "Order clothes" : "Return clothes"}: ${item.title}`}
        >
          {e.kind === "order" ? "Order · " : "Return · "}
          {item.title}
        </button>
      )
    }
    const sched = item[field]
    return (
      <button
        key={e.key}
        draggable
        onDragStart={(ev) => {
          ev.dataTransfer.setData("text/plain", item.id)
          ev.dataTransfer.effectAllowed = "move"
        }}
        onClick={() => onOpen(item)}
        title={item.title}
        className={`w-full text-left rounded-md border border-soft-200 bg-white hover:border-soft-300 hover:shadow-sm cursor-pointer active:cursor-grabbing ${compact ? "px-1.5 py-1" : "px-2 py-1.5"} flex flex-col gap-1`}
      >
        <span className={`text-xs font-medium text-zinc-900 leading-snug ${compact ? "truncate" : "break-words"}`}>{item.title}</span>
        {compact ? (
          <span className={`h-1 w-6 rounded-full ${STATUS_STYLES[item.status]?.split(" ")[0] ?? "bg-zinc-200"}`} />
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            <Badge value={item.status} styles={STATUS_STYLES} />
            {field === "edit" && (
              <span className={`inline-flex items-center gap-0.5 text-[11px] ${item.edited ? "text-emerald-700" : "text-zinc-400"}`}>
                {item.edited && <Check size={11} />} {item.edited ? "Edited" : "Not edited"}
              </span>
            )}
            {field === "post" && <CategoryBadges value={item.categories} />}
            {field !== "edit" && <span className="text-[11px] text-zinc-500">{formatSchedule(sched)}</span>}
            {field === "edit" && childCount(item.id) > 0 && <span className="text-[11px] text-zinc-400">{childCount(item.id)} sub-items</span>}
          </span>
        )}
      </button>
    )
  }

  const dropProps = (day: string) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(day)
    },
    onDragLeave: () => setDragOver((d) => (d === day ? null : d)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(null)
      const item = byId.get(e.dataTransfer.getData("text/plain"))
      // Only this calendar's date field changes; time of day and range length are preserved.
      if (item) update(item.id, { [field]: moveSchedule(item[field], day) })
    },
  })

  return (
    <Section
      title="Content Calendar"
      actions={
        <select
          aria-label="Status filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-7 rounded-md border border-soft-200 bg-white px-1.5 text-xs text-zinc-700 cursor-pointer"
        >
          <option value="All">All statuses</option>
          {STATUS_NAMES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      }
    >
      <Tabs tabs={MODES} value={mode} onChange={setMode} />

      <div className="flex items-center gap-1">
        <h3 className="text-sm font-semibold text-zinc-900 mr-auto">{heading}</h3>
        <button onClick={() => step(-1)} className="p-1.5 rounded-md hover:bg-soft-100 cursor-pointer" aria-label="Previous">
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => {
            setCursor(today)
            setSelected(today)
          }}
          className="px-2.5 h-7 rounded-md text-xs font-medium border border-soft-200 hover:bg-soft-50 cursor-pointer"
        >
          Today
        </button>
        <button onClick={() => step(1)} className="p-1.5 rounded-md hover:bg-soft-100 cursor-pointer" aria-label="Next">
          <ChevronRight size={16} />
        </button>
      </div>

      {isWeek ? (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-1.5">
          {days.map((day) => {
            const evs = eventsOn(day)
            return (
              <div
                key={day}
                {...dropProps(day)}
                className={`rounded-lg border p-1.5 md:min-h-[180px] flex flex-col gap-1 transition-colors ${
                  dragOver === day ? "bg-sky-50 border-sky-300" : day === today ? "border-zinc-900" : "border-soft-200"
                }`}
              >
                <div className="flex items-baseline gap-1 px-0.5">
                  <span className="text-[11px] text-zinc-500">{WEEKDAYS[weekday(day)]}</span>
                  <span className={`text-sm font-semibold ${day === today ? "text-pastel-600" : "text-zinc-900"}`}>{Number(day.slice(8))}</span>
                </div>
                {evs.map((e) => card(e, false))}
                {evs.length === 0 && <span className="md:hidden text-xs text-zinc-300 px-0.5">Nothing scheduled</span>}
              </div>
            )
          })}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 border-t border-l border-soft-200 rounded-lg overflow-hidden">
            {WEEKDAYS.map((w) => (
              <div key={w} className="border-r border-b border-soft-200 bg-soft-50 py-1.5 text-center text-[11px] font-medium text-zinc-500">
                <span className="sm:hidden">{w[0]}</span>
                <span className="hidden sm:inline">{w}</span>
              </div>
            ))}
            {days.map((day) => {
              const evs = eventsOn(day)
              const inMonth = day.slice(0, 7) === cursor.slice(0, 7)
              return (
                <div
                  key={day}
                  {...dropProps(day)}
                  onClick={() => setSelected(day)}
                  className={`border-r border-b border-soft-200 min-h-[52px] sm:min-h-[104px] p-1 flex flex-col gap-1 min-w-0 transition-colors ${
                    dragOver === day ? "bg-sky-50" : inMonth ? "bg-white" : "bg-soft-50/70"
                  } ${selected === day ? "max-sm:bg-pastel-50" : ""}`}
                >
                  <span
                    className={`self-start text-[11px] w-5 h-5 flex items-center justify-center rounded-full ${
                      day === today ? "bg-zinc-900 text-white font-semibold" : inMonth ? "text-zinc-700" : "text-zinc-300"
                    }`}
                  >
                    {Number(day.slice(8))}
                  </span>
                  <div className="flex sm:hidden flex-wrap gap-0.5">
                    {evs.slice(0, 4).map((e) => (
                      <span key={e.key} className={`w-1.5 h-1.5 rounded-full ${e.kind === "date" ? "bg-zinc-700" : e.kind === "order" ? "bg-rose-400" : "bg-orange-400"}`} />
                    ))}
                  </div>
                  <div className="hidden sm:flex flex-col gap-1 min-w-0">
                    {evs.slice(0, 3).map((e) => card(e, true))}
                    {evs.length > 3 && <span className="text-[11px] text-zinc-400 px-1">+{evs.length - 3} more</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="sm:hidden flex flex-col gap-1.5">
            <div className="text-xs font-semibold text-zinc-500">{formatDate(selected, { weekday: true })}</div>
            {eventsOn(selected).map((e) => card(e, false))}
            {eventsOn(selected).length === 0 && <div className="text-xs text-zinc-300">Nothing scheduled</div>}
          </div>
        </>
      )}
      <p className="hidden sm:block text-[11px] text-zinc-400">Drag a card to another day to reschedule its {field === "post" ? "Post Now" : field === "edit" ? "Edit Date" : "Shoot Date"}.</p>
    </Section>
  )
}
