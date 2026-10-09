"use client"

import { AlertTriangle, Plus, Trash2 } from "lucide-react"
import { Dropdown } from "@/components/ui/Dropdown"
import {
  BATCHES_PER_ORDER,
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
import { batchCandidates, matchesSearch, outfitsView } from "@/lib/planner/views"
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
  const batches = orderBatches(order, items).sort((a, b) => compareNullsLast(batchShootDate(a, items), batchShootDate(b, items)))
  const stage = orderStage(order)
  const t = orderTimeline(order, items)
  const alert = orderAlert(order, items)
  const dark = alert?.severity === "danger"
  const available = batchCandidates(items).filter((b) => !b.orderId || b.orderId === order.id)

  const setBatch = (slot: number, batchId: string) => {
    const ids = batches.map((b) => b.id)
    if (batchId) ids[slot] = batchId
    else ids.splice(slot, 1)
    orderActions.setBatches(order.id, Array.from(new Set(ids.filter(Boolean))))
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
        <p className="text-sm opacity-80">
          {stage === "Refunded"
            ? `Returned ${formatDate(order.returnedAt, { weekday: true })}`
            : stage === "Ordered"
              ? `Ordered ${formatDate(t.orderedOn)} — waiting for delivery`
              : t.orderBy
                ? `Order by ${formatDate(t.orderBy, { weekday: true })} (${ORDER_LEAD_DAYS} days before the first shoot)`
                : "Add shoot dates to the batches to get an order-by date"}
          {alert && stage === "Buy Clothes" && <span className="block mt-1 text-xs font-semibold">{alert.message}</span>}
        </p>
      )}

      {/* The two batches this order covers */}
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: BATCHES_PER_ORDER }, (_, slot) => {
          const batch = batches[slot]
          const children = batch ? items.filter((i) => i.parentId === batch.id) : []
          const shoot = batch ? batchShootDate(batch, items) : null
          const options = available.filter((b) => b.id === batch?.id || !batches.some((x) => x.id === b.id))
          return (
            <div key={slot} className={`rounded-xl p-2.5 flex flex-col gap-2 min-w-0 ${dark ? "bg-white/10" : "bg-zinc-50 border border-zinc-200"}`}>
              <Dropdown
                variant="ghost"
                label={`Batch ${slot + 1}`}
                options={[{ value: "", label: "No batch" }, ...options.map((b) => ({ value: b.id, label: b.title }))]}
                selected={[batch?.id ?? ""]}
                onSelect={(v) => setBatch(slot, v)}
                trigger={
                  <span className={`text-sm font-semibold ${batch ? "" : "opacity-50"}`}>
                    {batch ? batch.title : `Choose batch ${slot + 1}`}
                    {shoot && <span className="ml-1.5 text-xs font-normal opacity-70">shoot {formatDate(shoot)}</span>}
                  </span>
                }
                className={`whitespace-normal ${dark ? "hover:bg-white/10" : ""}`}
              />
              {batch && (
                <ul className="flex flex-col gap-1">
                  {children.length === 0 && <li className="text-xs opacity-50 px-1">No posts under this batch yet</li>}
                  {children.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => onOpen(c)}
                        className={`w-full flex items-center gap-2 text-left rounded-lg px-1 py-1 cursor-pointer ${dark ? "hover:bg-white/10" : "hover:bg-white"}`}
                      >
                        <Thumb item={c} size={22} />
                        <span className="flex-1 min-w-0 flex flex-col">
                          <span className="text-xs leading-snug break-words">{c.title}</span>
                          <span className="text-[11px] opacity-60">shoot {formatDate(c.shoot.start ?? shoot) || "—"}</span>
                        </span>
                        <span className="flex flex-col items-end gap-0.5">
                          <Badge value={c.status} styles={dark ? { [c.status]: "bg-white/15 text-white" } : STATUS_STYLES} />
                          {c.clothingStatus && (
                            <Badge value={c.clothingStatus} styles={dark ? { [c.clothingStatus]: "bg-white/15 text-white" } : CLOTHING_STYLES} />
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
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
}: {
  planner: Planner
  query: string
  onOpen: (item: ContentDTO) => void
  onDeleteMany: (ids: string[]) => Promise<boolean>
}) {
  const { items, orders, orderActions } = planner
  const rows = outfitsView(items.filter((i) => matchesSearch(i, query)), items)
  const selection = useSelection(rows.map((i) => i.id))

  const q = query.trim().toLowerCase()
  const visibleOrders = orders.filter((o) => !q || o.name.toLowerCase().includes(q) || orderBatches(o, items).some((b) => matchesSearch(b, query)))
  const active = visibleOrders.filter((o) => orderStage(o) !== "Refunded")
  const done = visibleOrders.filter((o) => orderStage(o) === "Refunded")

  // A new order pairs the next two batches (by shoot date) that aren't in an order yet.
  const nextBatches = batchCandidates(items)
    .filter((b) => !b.orderId && b.clothingStatus !== "Refunded" && b.status !== "Posted" && b.status !== "Worn")
    .sort((a, b) => compareNullsLast(batchShootDate(a, items), batchShootDate(b, items)))
    .slice(0, BATCHES_PER_ORDER)
  const standaloneAlerts = planner.alerts.filter((a) => a.item)

  return (
    <Section
      id="outfits"
      title="Outfits to Prep"
      subtitle={`One SHEIN order covers ${BATCHES_PER_ORDER} batches · return within ${RETURN_WINDOW_DAYS} days of delivery (reminder from day ${RETURN_REMINDER_DAY})`}
      actions={
        <button
          onClick={() => orderActions.create(nextBatches.map((b) => b.id))}
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
          No active orders. Click <span className="font-semibold text-zinc-800">New order</span> to pair your next {BATCHES_PER_ORDER} batches
          {nextBatches.length ? ` (${nextBatches.map((b) => b.title).join(" + ")})` : ""}.
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
        empty="No outfits to prep. Set a Clothing status, or the status To Buy/Plan Clothes, to track an item here."
      />
    </Section>
  )
}
