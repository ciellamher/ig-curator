"use client"

import { useState } from "react"
import { AlertTriangle, Plus, Trash2, X } from "lucide-react"
import {
  ORDER_LEAD_DAYS,
  RETURN_REMINDER_DAY,
  RETURN_WINDOW_DAYS,
  batchShootDate,
  orderAlert,
  orderBatches,
  orderStage,
  orderTimeline,
} from "@/lib/planner/clothing"
import { compareNullsLast, formatDate } from "@/lib/planner/dates"
import { CLOTHING_STYLES, STATUS_STYLES } from "@/lib/planner/options"
import { matchesSearch, outfitsView, shootDateOf } from "@/lib/planner/views"
import type { ContentDTO, OrderDTO } from "@/lib/planner/types"
import { ContentRows, type Column } from "./ContentRows"
import { BulkBar, useSelection } from "./Selection"
import { Badge, CommitInput, Thumb } from "./Fields"
import { Section } from "./Section"
import type { Planner } from "./usePlanner"

// Original Outfits columns, followed by the SHEIN deadline columns (an app addition).
const COLUMNS: Column[] = ["title", "shoot", "status", "clothing", "edit", "category", "pinterest", "orderBy", "returnBy"]

function DateField({ label, value, onChange, dark }: { label: string; value: string | null; onChange: (v: string | null) => void; dark?: boolean }) {
  return (
    <label className="flex items-center gap-1.5 text-xs opacity-80">
      {label}
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={`bg-transparent rounded-md px-1 py-0.5 border border-current/20 text-xs cursor-pointer ${dark ? "[color-scheme:dark]" : ""}`}
      />
    </label>
  )
}

function OrderCard({ order, planner, onOpen }: { order: OrderDTO; planner: Planner; onOpen: (item: ContentDTO) => void }) {
  const { items, orderActions } = planner
  const byId = new Map(items.map((i) => [i.id, i]))
  const posts = orderBatches(order, items).sort((a, b) => compareNullsLast(shootDateOf(a, byId), shootDateOf(b, byId)))
  const [picking, setPicking] = useState(posts.length === 0)
  const [find, setFind] = useState("")
  const stage = orderStage(order)
  const t = orderTimeline(order, items)
  const alert = orderAlert(order, items)
  const dark = alert?.severity === "danger"
  // Posts that can be picked: anything not already in another order
  const pickable = items
    .filter((i) => (!i.orderId || i.orderId === order.id) && i.status !== "Posted" && i.status !== "Worn")
    .filter((i) => !find.trim() || i.title.toLowerCase().includes(find.trim().toLowerCase()))
    .sort((a, b) => compareNullsLast(shootDateOf(a, byId), shootDateOf(b, byId)))
  const setPosts = (ids: string[]) => orderActions.setBatches(order.id, ids)
  const toggle = (id: string) => setPosts(posts.some((p) => p.id === id) ? posts.filter((p) => p.id !== id).map((p) => p.id) : [...posts.map((p) => p.id), id])

  // Group the picked posts by the batch they're in (set on each page)
  const groups = new Map<string, ContentDTO[]>()
  for (const p of posts) {
    const batch = p.parentId ? byId.get(p.parentId)?.title ?? "No batch" : "No batch"
    groups.set(batch, [...(groups.get(batch) ?? []), p])
  }

  const progress = t.daysSinceDelivery === null ? 0 : Math.min(1, t.daysSinceDelivery / RETURN_WINDOW_DAYS)
  const button = `px-3 h-8 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
    dark ? "bg-white text-zinc-950 hover:bg-zinc-200" : "bg-zinc-950 text-white hover:bg-black"
  }`
  const ghost = `px-3 h-8 rounded-full text-xs font-semibold cursor-pointer border ${dark ? "border-white/30 hover:bg-white/10" : "border-zinc-300 hover:bg-zinc-100"}`

  return (
    <article
      className={`rounded-2xl p-4 flex flex-col gap-3 border-2 ${
        dark ? "bg-zinc-950 text-white border-zinc-950" : alert ? "bg-white border-zinc-950" : "bg-white border-zinc-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <CommitInput label="Order name" value={order.name} onCommit={(name) => orderActions.rename(order.id, name)} className="flex-1 text-base font-semibold" />
        <Badge value={stage} styles={dark ? { [stage]: "bg-white text-zinc-950" } : CLOTHING_STYLES} />
        <button
          onClick={() => orderActions.remove(order.id)}
          aria-label={`Delete ${order.name}`}
          className={`p-1.5 rounded-md cursor-pointer ${dark ? "hover:bg-white/10" : "text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100"}`}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* 14-day return window, counted from delivery */}
      {t.daysSinceDelivery !== null && stage !== "Refunded" ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-semibold tabular-nums">Day {t.daysSinceDelivery}</span>
            <span className="text-sm opacity-70">of {RETURN_WINDOW_DAYS} since delivery</span>
            <span className="ml-auto text-xs opacity-80">Return by {formatDate(t.windowEnd, { weekday: true })}</span>
          </div>
          <div className={`h-1.5 rounded-full overflow-hidden ${dark ? "bg-white/20" : "bg-zinc-200"}`}>
            <div className={`h-full rounded-full ${dark ? "bg-white" : "bg-zinc-950"}`} style={{ width: `${progress * 100}%` }} />
          </div>
          {alert && (
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <AlertTriangle size={13} className="shrink-0" /> {alert.message}
            </p>
          )}
        </div>
      ) : (
        <div className="text-sm opacity-80 flex flex-col gap-0.5">
          {stage === "Refunded"
            ? <p>Returned {formatDate(order.returnedAt, { weekday: true })}</p>
            : stage === "Ordered"
              ? <p>Ordered {formatDate(t.orderedOn)} — waiting for delivery</p>
              : t.orderBy
                ? <p>Order by {formatDate(t.orderBy, { weekday: true })} ({ORDER_LEAD_DAYS} days before the first shoot)</p>
                : <p>Add posts with shoot dates to get an order-by date</p>}
          
          {t.cutoffDate && stage !== "Refunded" && (
            <p className="text-xs font-medium text-inherit opacity-70">
              You can add shoots up to {formatDate(t.cutoffDate, { weekday: true })} for this batch
            </p>
          )}

          {alert && stage === "Buy Clothes" && <span className="block mt-1 text-xs font-semibold">{alert.message}</span>}
        </div>
      )}

      {/* The posts this order covers, grouped by batch */}
      <div className={`rounded-xl p-2.5 flex flex-col gap-2 ${dark ? "bg-white/10" : "bg-zinc-50 border border-zinc-200"}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Posts in this order</span>
          <span className="text-xs opacity-60">{posts.length}</span>
          <button
            onClick={() => setPicking((v) => !v)}
            className={`ml-auto inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-xs font-semibold cursor-pointer ${dark ? "bg-white text-zinc-950" : "bg-zinc-950 text-white"}`}
          >
            {picking ? "Done" : <><Plus size={12} /> Add posts</>}
          </button>
        </div>

        {picking && (
          <div className={`rounded-lg border ${dark ? "border-white/20" : "border-zinc-200 bg-white"} p-2 flex flex-col gap-1.5`}>
            <input
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="Search your content…"
              aria-label="Search posts"
              className={`h-8 px-2.5 rounded-md text-base sm:text-sm outline-none border ${dark ? "bg-transparent border-white/20" : "border-zinc-200 focus:border-zinc-950"}`}
            />
            <ul className="max-h-60 overflow-y-auto flex flex-col">
              {pickable.length === 0 && <li className="text-xs opacity-60 px-1 py-2">Nothing matches.</li>}
              {pickable.map((p) => {
                const on = posts.some((x) => x.id === p.id)
                const batch = p.parentId ? byId.get(p.parentId)?.title : null
                return (
                  <li key={p.id}>
                    <label className={`flex items-center gap-2 px-1.5 py-1.5 rounded-md cursor-pointer ${dark ? "hover:bg-white/10" : "hover:bg-zinc-50"}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="w-4 h-4 accent-zinc-950" />
                      <Thumb item={p} size={22} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-medium truncate">{p.title}</span>
                        <span className="block text-[11px] opacity-60 truncate">
                          {batch ? `${batch} · ` : ""}
                          {shootDateOf(p, byId) ? `shoot ${formatDate(shootDateOf(p, byId))}` : "no shoot date"}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {posts.length === 0 && !picking && <p className="text-xs opacity-60 px-1">No posts yet — click Add posts.</p>}
        {[...groups.entries()].map(([batch, list]) => (
          <div key={batch} className="flex flex-col gap-1">
            {batch !== "No batch" && <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60 px-1">{batch}</span>}
            {list.map((c) => (
              <div key={c.id} className={`flex items-center gap-2 rounded-lg px-1 py-1 ${dark ? "hover:bg-white/10" : "hover:bg-white"}`}>
                <button onClick={() => onOpen(c)} className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer">
                  <Thumb item={c} size={22} />
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="text-xs leading-snug break-words">{c.title}</span>
                    <span className="text-[11px] opacity-60">shoot {formatDate(shootDateOf(c, byId)) || "—"}</span>
                  </span>
                  <Badge value={c.status} styles={dark ? { [c.status]: "bg-white/15 text-white" } : STATUS_STYLES} />
                </button>
                <button onClick={() => toggle(c.id)} aria-label={`Remove ${c.title} from order`} className="p-1 rounded opacity-50 hover:opacity-100 cursor-pointer">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Stage actions and date corrections */}
      <div className="flex flex-wrap items-center gap-2">
        {stage === "Buy Clothes" && (
          <button className={button} onClick={() => orderActions.setStage(order.id, "ordered")}>
            Mark ordered
          </button>
        )}
        {stage === "Ordered" && (
          <button className={button} onClick={() => orderActions.setStage(order.id, "delivered")}>
            Mark delivered
          </button>
        )}
        {stage === "Delivered" && (
          <button className={button} onClick={() => orderActions.setStage(order.id, "returned")}>
            Mark returned
          </button>
        )}
        {stage !== "Buy Clothes" && (
          <button className={ghost} onClick={() => orderActions.setStage(order.id, "reset")}>
            Reset
          </button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {t.orderedOn && <DateField dark={dark} label="Ordered" value={t.orderedOn} onChange={(d) => orderActions.setDate(order.id, "orderedAt", d)} />}
          {t.deliveredOn && <DateField dark={dark} label="Delivered" value={t.deliveredOn} onChange={(d) => orderActions.setDate(order.id, "deliveredAt", d)} />}
        </div>
      </div>
    </article>
  )
}

export function OutfitsTable({
  planner,
  query,
  onOpen,
  onDeleteMany,
  focusId,
  onFocusItem,
}: {
  planner: Planner
  query: string
  onOpen: (item: ContentDTO) => void
  onDeleteMany: (ids: string[]) => Promise<boolean>
  focusId?: string | null
  onFocusItem?: (item: ContentDTO) => void
}) {
  const { items, orders, orderActions } = planner
  
  const orderedIds = new Set<string>()
  for (const o of orders) {
    for (const batchId of o.batchIds) {
      orderedIds.add(batchId)
    }
  }

  const allOutfits = outfitsView(items.filter((i) => matchesSearch(i, query)), items)
  const rows = allOutfits.filter(i => !orderedIds.has(i.id) && !(i.parentId && orderedIds.has(i.parentId)))

  const selection = useSelection(rows.map((i) => i.id))

  const q = query.trim().toLowerCase()
  const visibleOrders = orders.filter((o) => !q || o.name.toLowerCase().includes(q) || orderBatches(o, items).some((b) => matchesSearch(b, query)))
  const active = visibleOrders.filter((o) => orderStage(o) !== "Refunded")
  const done = visibleOrders.filter((o) => orderStage(o) === "Refunded")

  const standaloneAlerts = planner.alerts.filter((a) => a.item)

  return (
    <Section
      id="outfits"
      title="Outfits to Prep"
      subtitle={`Pick the posts each SHEIN order is for · return within ${RETURN_WINDOW_DAYS} days of delivery (reminder from day ${RETURN_REMINDER_DAY})`}
      actions={
        <button
          onClick={() => orderActions.create([])}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold bg-zinc-950 text-white hover:bg-black cursor-pointer"
        >
          <Plus size={14} /> New order
        </button>
      }
    >
      {active.length > 0 ? (
        <div className={`grid gap-3 ${active.length > 1 ? "2xl:grid-cols-2" : ""}`}>
          {active.map((o) => (
            <OrderCard key={o.id} order={o} planner={planner} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
          No active orders. Click <span className="font-semibold text-zinc-800">New order</span>, then pick the posts it&apos;s for.
        </p>
      )}

      {done.length > 0 && (
        <details>
          <summary className="text-xs text-zinc-500 cursor-pointer select-none hover:text-zinc-900">Returned orders ({done.length})</summary>
          <div className={`mt-2 grid gap-3 ${done.length > 1 ? "2xl:grid-cols-2" : ""}`}>
            {done.map((o) => (
              <OrderCard key={o.id} order={o} planner={planner} onOpen={onOpen} />
            ))}
          </div>
        </details>
      )}

      {standaloneAlerts.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Outfit alerts">
          {standaloneAlerts.map(({ key, item, title, alert }) => (
            <li key={key}>
              <button
                onClick={() => item && onOpen(item)}
                className={`w-full flex items-center gap-2 text-left rounded-lg px-3 py-2 text-sm border cursor-pointer ${
                  alert.severity === "danger" ? "bg-zinc-950 border-zinc-950 text-white" : "bg-white border-zinc-950 text-zinc-950"
                }`}
              >
                <AlertTriangle size={14} className="shrink-0" />
                <span className="font-medium truncate">{title}</span>
                <span className="ml-auto shrink-0 text-xs">{alert.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 pt-1">All outfits</h3>
      <BulkBar
        count={selection.ids.length}
        onClear={selection.clear}
        onDelete={async () => {
          if (await onDeleteMany(selection.ids)) selection.clear()
        }}
      />
      <ContentRows
        items={rows}
        columns={COLUMNS}
        planner={planner}
        onOpen={onOpen}
        selection={selection}
        focusId={focusId}
        onFocusItem={onFocusItem}
        empty="No outfits to prep. Set a Clothing status to Buy Clothes, or the status To Buy/Plan Clothes, to track an item here."
      />
    </Section>
  )
}
