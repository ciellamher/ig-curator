"use client"

import { SHEIN_ENABLED } from "@/lib/features"
import { Dropdown } from "@/components/ui/Dropdown"
import { useEffect, useRef } from "react"
import { CalendarClock, Check, CheckCheck, MapPin, Plus, Trash2, X } from "lucide-react"
import { LocalMediaImage } from "@/components/grid/LocalMedia"
import { RETURN_WINDOW_DAYS, clothingAlert, itemTimeline, orderAlert, orderFor } from "@/lib/planner/clothing"
import { formatDate } from "@/lib/planner/dates"
import { STATUS_STYLES } from "@/lib/planner/options"
import { batchOptionsFor } from "@/lib/planner/views"
import { autoEditDate, editLeadDays } from "@/lib/planner/rules"
import { feedKindsFor } from "@/lib/planner/feed"
import { DATE_FIELDS, PAGE_EDITOR_EVENT, type ContentDTO, type Location, type PageEditorHost } from "@/lib/planner/types"
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
  overlay = true,
}: {
  item: ContentDTO
  planner: Planner
  onClose: () => void
  onDelete: (item: ContentDTO) => void
  onOpen: (item: ContentDTO) => void
  /** false when opened from the feed: no dimmed backdrop, so the feed stays usable alongside */
  overlay?: boolean
}) {
  const { items, byId, update, create } = planner
  const holdsPosts = items.filter((i) => i.parentId === item.id)
  const batchOptions = batchOptionsFor(items, item.id)
  const autoEdit = autoEditDate(item.post.start, item.categories)
  const order = orderFor(item, byId, planner.ordersById)
  const t = itemTimeline(item, byId, planner.ordersById, items)
  const alert = order ? orderAlert(order, items) : clothingAlert(item, byId)
  const postRef = useRef<HTMLDivElement>(null)
  const feedKind = feedKindsFor(item.categories)
  const panelRef = useRef<HTMLElement>(null)
  // The page's grid box (post or reel): its Edit Slot tools show inside the page
  const gridSlotId = item.contentType && item.contentType !== "StoryFolder" ? item.slotId : (item.extraSlots?.Post ?? item.extraSlots?.Reel ?? null)
  const slotHostRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = slotHostRef.current
    if (!gridSlotId || !el) return
    const detail: PageEditorHost = { slotId: gridSlotId, el }
    window.dispatchEvent(new CustomEvent(PAGE_EDITOR_EVENT, { detail }))
    return () => {
      window.dispatchEvent(new CustomEvent(PAGE_EDITOR_EVENT, { detail: null }))
    }
  }, [gridSlotId])

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  // Focus the page when it opens (not on every update, which would pull focus out of the field being typed in)
  useEffect(() => {
    if (overlay) panelRef.current?.focus()
  }, [item.id, overlay])

  const loc = item.location ?? { name: "" }
  const setLoc = (patch: Partial<Location>) => {
    const next = { ...loc, ...patch }
    update(item.id, { location: next.name.trim() ? next : null })
  }

  const action = "inline-flex items-center gap-1.5 px-2.5 h-8 rounded-full text-xs font-semibold border border-soft-200 hover:bg-soft-50 disabled:opacity-40 cursor-pointer"

  return (
    <>
      {overlay && <div className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-xs animate-in fade-in duration-200 lg:hidden" onClick={onClose} />}
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal={overlay}
        aria-label={item.title}
        className="fixed z-[80] inset-x-0 bottom-0 max-h-[90dvh] rounded-t-3xl sm:inset-x-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[460px] sm:max-h-none sm:rounded-3xl bg-white shadow-2xl flex flex-col outline-none animate-in fade-in slide-in-from-bottom-4 duration-300 pb-safe"
      >
        <div className="flex items-start gap-1 px-4 pt-4 pb-2 border-b border-soft-100">
          <div className="flex-1 min-w-0">
            <CommitInput multiline label="Title" value={item.title} onCommit={(title) => update(item.id, { title })} className="w-full text-lg font-semibold text-zinc-900" />
          </div>
          <button onClick={() => onDelete(item)} className="p-2 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 cursor-pointer" aria-label="Delete">
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

          {gridSlotId && (
            <section aria-label="Feed post" className="rounded-2xl border border-zinc-200 overflow-hidden">
              <div ref={slotHostRef} />
            </section>
          )}

          {!gridSlotId && item.media.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {item.media.map((m) => (
                <LocalMediaImage key={m.id} src={m.url} className="h-14 w-11 shrink-0 rounded-md object-cover" />
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
            {(!item.categories.includes("Story") || item.categories.includes("Post") || item.categories.includes("Reels")) && (
              <Row label="Feed">
                <div className="pt-1.5 flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={item.hiddenFromFeed}
                    onChange={(e) => update(item.id, { hiddenFromFeed: e.target.checked })}
                    className="w-4 h-4 accent-zinc-950"
                    id="hide-from-feed"
                  />
                  <label htmlFor="hide-from-feed" className="cursor-pointer select-none">
                    Hide from feed
                  </label>
                </div>
              </Row>
            )}
            {DATE_FIELDS.map(({ field, label }) => (
              <div key={field} ref={field === "post" ? postRef : undefined}>
                <Row label={label}>
                  <ScheduleEditor label={label} value={item[field]} onChange={(s) => update(item.id, { [field]: s })} />
                  {field === "shoot" && !item.shoot.start && t.shootDate && <p className="text-xs text-zinc-400 mt-1">Batch shoots {formatDate(t.shootDate)}</p>}
                  {field === "edit" && autoEdit && (
                    <p className="text-xs text-zinc-400 mt-1">
                      {item.edit.start?.slice(0, 10) === autoEdit ? "Auto" : "Suggested"}: {editLeadDays(item.categories) === 3 ? "3 days" : "1 week"} before Post Now
                      {item.edit.start?.slice(0, 10) !== autoEdit && (
                        <button type="button" onClick={() => update(item.id, { edit: { start: autoEdit, end: null } })} className="ml-1.5 underline underline-offset-2 hover:text-zinc-950 cursor-pointer">
                          use {formatDate(autoEdit)}
                        </button>
                      )}
                    </p>
                  )}
                </Row>
              </div>
            ))}
            {SHEIN_ENABLED && (
              <Row label="Clothing">
                <ClothingSelect value={item.clothingStatus} onChange={(clothingStatus) => update(item.id, { clothingStatus })} />
              </Row>
            )}
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

          </div>

          {SHEIN_ENABLED && item.clothingStatus && (
            <div className="rounded-xl bg-soft-50 border border-soft-200 p-3 flex flex-col gap-1 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-1">SHEIN timeline</div>
              {order && <div className="flex justify-between gap-2"><span className="text-zinc-500">Order</span><span className="font-medium">{order.name}</span></div>}
              <div className="flex justify-between gap-2"><span className="text-zinc-500">Order by</span><span>{t.orderBy ? formatDate(t.orderBy, { weekday: true }) : "Needs a Shoot Date"}</span></div>
              {t.orderedOn && <div className="flex justify-between gap-2"><span className="text-zinc-500">Ordered</span><span>{formatDate(t.orderedOn, { weekday: true })}</span></div>}
              {t.expectedDelivery && !t.deliveredOn && <div className="flex justify-between gap-2"><span className="text-zinc-500">Expected Delivery</span><span>{formatDate(t.expectedDelivery, { weekday: true })}</span></div>}
              <div className="flex justify-between gap-2"><span className="text-zinc-500">Delivered</span><span>{t.deliveredOn ? formatDate(t.deliveredOn, { weekday: true }) : "Not yet"}</span></div>
              {t.daysSinceDelivery !== null && (
                <div className="flex justify-between gap-2"><span className="text-zinc-500">Since delivery</span><span className="font-semibold">Day {t.daysSinceDelivery} of {RETURN_WINDOW_DAYS}</span></div>
              )}
              <div className="flex justify-between gap-2"><span className="text-zinc-500">Return by</span><span className="font-semibold">{t.windowEnd ? formatDate(t.windowEnd, { weekday: true }) : "14 days after delivery"}</span></div>
              {alert && <div className={`mt-1 text-xs font-semibold ${alert.severity === "danger" ? "text-zinc-950 underline underline-offset-2" : "text-zinc-700"}`}>{alert.message}</div>}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Notes</h3>
            <BodyEditor value={item.body} onCommit={(body) => update(item.id, { body })} />
          </div>

          <p className="text-xs text-zinc-400">
            {item.slotId || (item.extraSlots && Object.keys(item.extraSlots).length > 0)
              ? "In your feed. Photos and the title stay in sync with its boxes."
              : feedKind.length > 0
                ? "In your feed once you add a photo to its box."
                : "Planner only. Pick Post, Reels or Story (Category) to show it in the feed."}
          </p>
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
