"use client"

import { useEffect, useRef } from "react"
import { CalendarClock, Check, CheckCheck, MapPin, Plus, Trash2, X } from "lucide-react"
import { LocalMediaImage } from "@/components/grid/LocalMedia"
import { RETURN_REMINDER_DAY, clothingAlert, clothingTimeline } from "@/lib/planner/clothing"
import { formatDate } from "@/lib/planner/dates"
import { STATUS_STYLES } from "@/lib/planner/options"
import { parentCandidates } from "@/lib/planner/views"
import { DATE_FIELDS, type ContentDTO, type Location } from "@/lib/planner/types"
import { Badge, CategorySelect, ClothingSelect, CommitInput, EditedCheckbox, ScheduleEditor, StatusSelect } from "./Fields"
import type { Planner } from "./usePlanner"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_1fr] items-start gap-2 py-1">
      <span className="text-sm text-zinc-400 pt-1">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function mapsUrl(loc: Location): string | null {
  if (loc.latitude != null && loc.longitude != null) return `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`
  const q = [loc.name, loc.address].filter(Boolean).join(", ")
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null
}

export function ItemDrawer({
  item,
  planner,
  onClose,
  onDelete,
  onOpen,
}: {
  item: ContentDTO
  planner: Planner
  onClose: () => void
  onDelete: (item: ContentDTO) => void
  onOpen: (item: ContentDTO) => void
}) {
  const { items, byId, update, create } = planner
  const children = items.filter((i) => i.parentId === item.id)
  const parent = item.parentId ? byId.get(item.parentId) : undefined
  const candidates = parentCandidates(items, item.id)
  const t = clothingTimeline(item, byId)
  const alert = clothingAlert(item, byId)
  const postRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    panelRef.current?.focus()
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const loc = item.location ?? { name: "" }
  const setLoc = (patch: Partial<Location>) => {
    const next = { ...loc, ...patch }
    update(item.id, { location: next.name.trim() ? next : null })
  }

  const action = "inline-flex items-center gap-1.5 px-2.5 h-8 rounded-full text-xs font-semibold border border-soft-200 hover:bg-soft-50 disabled:opacity-40 cursor-pointer"

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-xs animate-in fade-in duration-200" onClick={onClose} />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
        className="fixed z-[80] inset-x-0 bottom-0 max-h-[90dvh] rounded-t-3xl sm:inset-x-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[460px] sm:max-h-none sm:rounded-3xl bg-white shadow-2xl flex flex-col outline-none animate-in fade-in slide-in-from-bottom-4 duration-300 pb-safe"
      >
        <div className="flex items-start gap-1 px-4 pt-4 pb-2 border-b border-soft-100">
          <div className="flex-1 min-w-0">
            {parent && (
              <button onClick={() => onOpen(parent)} className="text-xs text-zinc-400 hover:text-zinc-800 px-1.5 cursor-pointer">
                ↑ {parent.title}
              </button>
            )}
            <CommitInput multiline label="Title" value={item.title} onCommit={(title) => update(item.id, { title })} className="w-full text-lg font-semibold text-zinc-900" />
          </div>
          <button onClick={() => onDelete(item)} className="p-2 rounded-full text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer" aria-label="Delete">
            <Trash2 size={16} />
          </button>
          <button onClick={onClose} className="p-2 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-soft-100 cursor-pointer" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            <button className={action} disabled={item.edited} onClick={() => update(item.id, { edited: true })}>
              <Check size={13} /> Mark edited
            </button>
            <button className={action} disabled={item.status === "Posted"} onClick={() => update(item.id, { status: "Posted" })}>
              <CheckCheck size={13} /> Mark posted
            </button>
            <button
              className={action}
              onClick={() => {
                postRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })
                postRef.current?.querySelector("input")?.focus()
              }}
            >
              <CalendarClock size={13} /> Schedule post
            </button>
          </div>

          {item.media.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
              {item.media.map((m) => (
                <LocalMediaImage key={m.id} src={m.url} className="h-36 w-28 shrink-0 rounded-xl object-cover" />
              ))}
            </div>
          )}

          <div className="flex flex-col">
            <Row label="Status">
              <StatusSelect value={item.status} onChange={(status) => update(item.id, { status })} />
            </Row>
            <Row label="Category">
              <CategorySelect value={item.categories} onChange={(categories) => update(item.id, { categories })} />
            </Row>
            <Row label="Edited">
              <div className="pt-1.5">
                <EditedCheckbox value={item.edited} onChange={(edited) => update(item.id, { edited })} />
              </div>
            </Row>
            {DATE_FIELDS.map(({ field, label }) => (
              <div key={field} ref={field === "post" ? postRef : undefined}>
                <Row label={label}>
                  <ScheduleEditor label={label} value={item[field]} onChange={(s) => update(item.id, { [field]: s })} />
                  {field === "shoot" && !item.shoot.start && t.shootDate && <p className="text-xs text-zinc-400 mt-1">Parent shoots {formatDate(t.shootDate)}</p>}
                </Row>
              </div>
            ))}
            <Row label="Clothing">
              <ClothingSelect value={item.clothingStatus} onChange={(clothingStatus) => update(item.id, { clothingStatus })} />
            </Row>
            <Row label="Pinterest">
              <div className="flex items-center gap-1">
                <CommitInput label="Pinterest URL" type="url" value={item.pinterestUrl ?? ""} placeholder="https://pinterest.com/…" onCommit={(v) => update(item.id, { pinterestUrl: v || null })} className="flex-1 text-sm text-zinc-700" />
                {item.pinterestUrl && (
                  <a href={item.pinterestUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 hover:text-zinc-900 px-1.5">
                    Open
                  </a>
                )}
              </div>
            </Row>
            <Row label="Location">
              <div className="flex flex-col gap-1">
                <CommitInput label="Location name" value={loc.name} placeholder="Place name" onCommit={(name) => setLoc({ name })} className="text-sm text-zinc-700" />
                {loc.name && (
                  <>
                    <CommitInput label="Address" value={loc.address ?? ""} placeholder="Address" onCommit={(address) => setLoc({ address })} className="text-sm text-zinc-700" />
                    <div className="grid grid-cols-2 gap-1">
                      <CommitInput label="Latitude" value={loc.latitude?.toString() ?? ""} placeholder="Latitude" onCommit={(v) => setLoc({ latitude: v === "" ? null : Number(v) })} className="text-sm text-zinc-700" />
                      <CommitInput label="Longitude" value={loc.longitude?.toString() ?? ""} placeholder="Longitude" onCommit={(v) => setLoc({ longitude: v === "" ? null : Number(v) })} className="text-sm text-zinc-700" />
                    </div>
                    <CommitInput label="Place ID" value={loc.placeId ?? ""} placeholder="Place ID (optional)" onCommit={(placeId) => setLoc({ placeId })} className="text-xs text-zinc-500" />
                    {mapsUrl(loc) && (
                      <a href={mapsUrl(loc)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 px-1.5">
                        <MapPin size={12} /> Open in Maps
                      </a>
                    )}
                  </>
                )}
              </div>
            </Row>
            <Row label="Parent">
              <select
                aria-label="Parent"
                value={item.parentId ?? ""}
                disabled={children.length > 0}
                onChange={(e) => update(item.id, { parentId: e.target.value || null })}
                className="w-full text-sm text-zinc-700 bg-transparent rounded-md px-1 py-1 hover:bg-soft-100 disabled:opacity-60 cursor-pointer"
              >
                <option value="">{children.length > 0 ? "Has sub-items (can't be nested)" : "None"}</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Row>
          </div>

          {item.clothingStatus && (
            <div className="rounded-xl bg-soft-50 border border-soft-200 p-3 flex flex-col gap-1 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-1">SHEIN timeline</div>
              <div className="flex justify-between gap-2"><span className="text-zinc-500">Order by</span><span>{t.orderBy ? formatDate(t.orderBy, { weekday: true }) : "Needs a Shoot Date"}</span></div>
              {item.orderedAt && <div className="flex justify-between gap-2"><span className="text-zinc-500">Ordered on</span><span>{formatDate(t.windowStart, { weekday: true })}</span></div>}
              <div className="flex justify-between gap-2"><span className="text-zinc-500">Return by (day {RETURN_REMINDER_DAY})</span><span className="font-semibold">{t.returnBy ? formatDate(t.returnBy, { weekday: true }) : "—"}</span></div>
              <div className="flex justify-between gap-2"><span className="text-zinc-500">Window closes</span><span>{t.windowEnd ? formatDate(t.windowEnd, { weekday: true }) : "—"}</span></div>
              {alert && <div className={`mt-1 text-xs font-semibold ${alert.severity === "danger" ? "text-rose-700" : "text-amber-800"}`}>{alert.message}</div>}
            </div>
          )}

          {!item.parentId && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Sub-items</h3>
                <button
                  onClick={async () => {
                    const child = await create({ title: "New sub-item", parentId: item.id })
                    if (child) onOpen(child)
                  }}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 px-2 py-1 rounded-md hover:bg-soft-100 cursor-pointer"
                >
                  <Plus size={12} /> Add sub-item
                </button>
              </div>
              {children.map((c) => (
                <button key={c.id} onClick={() => onOpen(c)} className="flex items-center gap-2 text-left text-sm rounded-lg px-2 py-1.5 hover:bg-soft-50 cursor-pointer">
                  <span className="flex-1 min-w-0 break-words">{c.title}</span>
                  <Badge value={c.status} styles={STATUS_STYLES} />
                </button>
              ))}
              {children.length === 0 && <p className="text-xs text-zinc-300 px-2">None</p>}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Notes</h3>
            <BodyEditor value={item.body} onCommit={(body) => update(item.id, { body })} />
          </div>

          {item.slotId && <p className="text-xs text-zinc-400">Linked to your feed. Photos update when you change them there.</p>}
        </div>
      </aside>
    </>
  )
}

function BodyEditor({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) ref.current.value = value
  }, [value])
  return (
    <textarea
      ref={ref}
      aria-label="Notes"
      defaultValue={value}
      onBlur={(e) => e.target.value !== value && onCommit(e.target.value)}
      placeholder="Write shot lists, captions, ideas…"
      className="w-full min-h-32 field-sizing-content rounded-xl border border-soft-200 p-3 text-sm text-zinc-800 leading-relaxed resize-y focus:outline-none focus:border-zinc-900 placeholder:text-zinc-300"
    />
  )
}
