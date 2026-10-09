"use client"

import { SHEIN_ENABLED } from "@/lib/features"
import { Dropdown } from "@/components/ui/Dropdown"
import { useMemo, useState } from "react"
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { itemTimeline, orderBatches, orderFor, orderStage, orderTimeline } from "@/lib/planner/clothing"
import { addDaysISO, formatDate, formatSchedule, moveSchedule, scheduleCovers, todayISO, weekday, type DateField } from "@/lib/planner/dates"
import { GROUP_DOT, STATUS_OPTIONS, STATUS_STYLES, statusGroup } from "@/lib/planner/options"
import { matchesSearch } from "@/lib/planner/views"
import type { ContentDTO } from "@/lib/planner/types"
import { Badge, CategoryBadges } from "./Fields"
import { Section, Tabs } from "./Section"
import { READY_DRAG_TYPE } from "./AvailablePosts"
import { QuickAdd } from "./QuickAdd"
import type { Planner } from "./usePlanner"

type Mode = "shoot-week" | "shoot-month" | "edit" | "post"
type CalEvent = { key: string; item: ContentDTO; kind: "date" | "order" | "return" | "delivery"; date?: string }

const MODES: { id: Mode; label: string }[] = [
  { id: "shoot-week", label: "Shoot · Week" },
  { id: "shoot-month", label: "Shoot · Month" },
  { id: "edit", label: "Edit" },
  { id: "post", label: "Post" },
]
const FIELD: Record<Mode, DateField> = { "shoot-week": "shoot", "shoot-month": "shoot", edit: "edit", post: "post" }
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const FIELD_LABEL: Record<DateField, string> = { shoot: "Shoot Date", edit: "Edit Date", post: "Post Now" }
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

const MARKER_STYLE = {
  order: "bg-white text-zinc-950 border border-dashed border-zinc-950",
  delivery: "bg-zinc-100 text-zinc-900 border border-zinc-300",
  return: "bg-zinc-950 text-white",
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
  const [adding, setAdding] = useState<string | null>(null)
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
    return items.filter((i) => i[field].start && matchesSearch(i, query) && (statusFilter === "All" || i.status === statusFilter))
  }, [items, query, statusFilter, field])

  const eventsOn = (day: string): CalEvent[] => {
    const out: CalEvent[] = visible.filter((i) => scheduleCovers(i[field], day)).map((item) => ({ key: `${item.id}-${field}`, item, kind: "date" }))
    if (field === "shoot" && SHEIN_ENABLED) {
      // App addition: SHEIN order/return deadlines alongside shoots.
      for (const order of planner.orders) {
        const batches = orderBatches(order, items)
        if (!batches.length || !batches.some((b) => matchesSearch(b, query))) continue
        const t = orderTimeline(order, items)
        const stage = orderStage(order)
        const label = { ...batches[0], title: order.name }
        if (stage === "Buy Clothes" && t.orderBy === day) out.push({ key: `${order.id}-order`, item: label, kind: "order", date: day })
        if (stage === "Ordered" && t.expectedDelivery === day) out.push({ key: `${order.id}-delivery`, item: label, kind: "delivery", date: day })
        if (stage === "Delivered" && t.returnBy === day) out.push({ key: `${order.id}-return`, item: label, kind: "return", date: day })
      }
      for (const item of items) {
        if (!item.clothingStatus || !matchesSearch(item, query) || orderFor(item, byId, planner.ordersById)) continue
        const t = itemTimeline(item, byId)
        if (item.clothingStatus === "Buy Clothes" && t.orderBy === day) out.push({ key: `${item.id}-order`, item, kind: "order", date: day })
        if (item.clothingStatus === "Ordered" && t.expectedDelivery === day) out.push({ key: `${item.id}-delivery`, item, kind: "delivery", date: day })
        if (item.clothingStatus === "Delivered" && t.returnBy === day) out.push({ key: `${item.id}-return`, item, kind: "return", date: day })
      }
    }
    return out
  }

  const step = (dir: 1 | -1) => setCursor((c) => (isWeek ? addDaysISO(c, dir * 7) : monthStart(addDaysISO(monthStart(c), dir === 1 ? 32 : -1))))
  const [y, m] = cursor.split("-").map(Number)
  const heading = isWeek ? `${formatDate(days[0])} – ${formatDate(days[6])}` : `${MONTHS[m - 1]} ${y}`

  const card = (e: CalEvent, compact: boolean) => {
    const { item } = e
    if (e.kind !== "date") {
      return (
        <button
          key={e.key}
          onClick={() => onOpen(item)}
          className={`w-full text-left rounded-md px-1.5 py-0.5 text-[11px] font-medium truncate cursor-pointer ${MARKER_STYLE[e.kind]}`}
          title={`${e.kind === "order" ? "Order clothes" : e.kind === "delivery" ? "Expected delivery" : "Return clothes"}: ${item.title}`}
        >
          {e.kind === "order" ? "Order · " : e.kind === "delivery" ? "Delivers · " : "Return · "}
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
          <span className={`h-1 w-6 rounded-full ${GROUP_DOT[statusGroup(item.status) ?? "To-do"]}`} />
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            <Badge value={item.status} styles={STATUS_STYLES} />
            {field === "edit" && (
              <span className={`inline-flex items-center gap-0.5 text-[11px] ${item.edited ? "text-zinc-900" : "text-zinc-400"}`}>
                {item.edited && <Check size={11} />} {item.edited ? "Edited" : "Not edited"}
              </span>
            )}
            {field === "post" && <CategoryBadges value={item.categories} />}
            {field !== "edit" && <span className="text-[11px] text-zinc-500">{formatSchedule(sched)}</span>}
          </span>
        )}
      </button>
    )
  }

  const AddButton = ({ day }: { day: string }) => (
    <button
      onClick={(e) => {
        e.stopPropagation()
        setAdding(day)
      }}
      aria-label={`Add on ${formatDate(day)}`}
      className="ml-auto p-0.5 rounded text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 cursor-pointer"
    >
      <Plus size={13} />
    </button>
  )

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
      if (!item) return
      // Only this calendar's date field changes (time of day and range length are kept). Scheduling something
      // from To Schedule moves it on to To Edit.
      const fromReady = item.status === "To Schedule"
      update(item.id, { [field]: moveSchedule(item[field], day), ...(fromReady ? { status: "To Edit" } : {}) })
    },
  })

  return (
    <Section
      title="Content Calendar"
      actions={
        <Dropdown
          label="Status filter"
          options={[{ value: "All", label: "All statuses" }, ...STATUS_OPTIONS.map((s) => ({ value: s.name, group: s.group }))]}
          selected={[statusFilter]}
          onSelect={setStatusFilter}
          className="w-40"
        />
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
                onDoubleClick={() => setAdding(day)}
                className={`group rounded-lg border p-1.5 md:min-h-[180px] flex flex-col gap-1 transition-colors ${
                  dragOver === day ? "bg-zinc-50 border-zinc-300" : day === today ? "border-zinc-900" : "border-soft-200"
                }`}
              >
                <div className="group/day flex items-center gap-1 px-0.5">
                  <span className="text-[11px] text-zinc-500">{WEEKDAYS[weekday(day)]}</span>
                  <span className={`text-sm font-semibold ${day === today ? "underline underline-offset-4" : ""} text-zinc-950`}>{Number(day.slice(8))}</span>
                  <AddButton day={day} />
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
                  onDoubleClick={() => setAdding(day)}
                  className={`group border-r border-b border-soft-200 min-h-[52px] sm:min-h-[136px] p-1 flex flex-col gap-1 min-w-0 transition-colors ${
                    dragOver === day ? "bg-zinc-50" : inMonth ? "bg-white" : "bg-soft-50/70"
                  } ${selected === day ? "max-sm:bg-pastel-50" : ""}`}
                >
                  <div className="flex items-center">
                    <span
                      className={`text-[11px] w-5 h-5 flex items-center justify-center rounded-full ${
                        day === today ? "bg-zinc-900 text-white font-semibold" : inMonth ? "text-zinc-700" : "text-zinc-300"
                      }`}
                    >
                      {Number(day.slice(8))}
                    </span>
                    <AddButton day={day} />
                  </div>
                  <div className="flex sm:hidden flex-wrap gap-0.5">
                    {evs.slice(0, 4).map((e) => (
                      <span key={e.key} className={`w-1.5 h-1.5 rounded-full ${e.kind === "date" ? "bg-zinc-400" : e.kind === "order" ? "ring-1 ring-zinc-950 bg-white" : e.kind === "delivery" ? "bg-zinc-300" : "bg-zinc-950"}`} />
                    ))}
                  </div>
                  <div className="hidden sm:flex flex-col gap-1 min-w-0">
                    {evs.slice(0, 4).map((e) => card(e, true))}
                    {evs.length > 4 && <span className="text-[11px] text-zinc-400 px-1">+{evs.length - 4} more</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="sm:hidden flex flex-col gap-1.5">
            <div className="flex items-center">
              <span className="text-xs font-semibold text-zinc-500">{formatDate(selected, { weekday: true })}</span>
              <button onClick={() => setAdding(selected)} className="ml-auto inline-flex items-center gap-1 px-2.5 h-7 rounded-full bg-zinc-950 text-white text-xs font-semibold cursor-pointer">
                <Plus size={12} /> Add
              </button>
            </div>
            {eventsOn(selected).map((e) => card(e, false))}
            {eventsOn(selected).length === 0 && <div className="text-xs text-zinc-300">Nothing scheduled</div>}
          </div>
        </>
      )}
      <p className="hidden sm:block text-[11px] text-zinc-400">
        Press + or double-click a day to add · drag cards between days to reschedule their {FIELD_LABEL[field]} · drag from Ready to Post to schedule
      </p>
      {adding && (
        <QuickAdd
          day={adding}
          field={field}
          fieldLabel={FIELD_LABEL[field]}
          onClose={() => setAdding(null)}
          onCreate={async (patch, open) => {
            const created = await planner.create(patch)
            setAdding(null)
            if (created && open) onOpen(created)
          }}
        />
      )}
    </Section>
  )
}
