"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CalendarCheck, CalendarPlus, RefreshCw } from "lucide-react"
import { disconnectCalendar, getCalendarStatus, syncCalendarNow, type CalendarStatus } from "@/app/actions/googleCalendar"

/** Connect / status button for the Google Calendar sync. Hidden where the sync isn't set up. */
export function CalendarConnect() {
  const [status, setStatus] = useState<CalendarStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await getCalendarStatus()
    if (res.success) setStatus(res.data)
  }, [])

  useEffect(() => {
    load()
    // Back from Google: say how it went, then tidy the address bar
    const result = new URLSearchParams(window.location.search).get("gcal")
    if (result) {
      setNote(
        result === "connected"
          ? "Google Calendar connected — your dates are in the “IG Curator” calendar."
          : result === "denied"
            ? "Google Calendar wasn't connected (access was declined)."
            : "Couldn't connect Google Calendar. Please try again.",
      )
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [load])

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener("pointerdown", close)
    return () => window.removeEventListener("pointerdown", close)
  }, [open])

  if (!status?.available) return null

  const needsReconnect = !!status.error && /reconnect/i.test(status.error)

  if (!status.connected || needsReconnect) {
    return (
      <div className="flex flex-col items-end gap-1">
        <a
          href="/api/google/connect"
          className="shrink-0 inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-zinc-300 bg-white text-sm font-semibold text-zinc-800 hover:border-zinc-950"
        >
          <CalendarPlus size={16} /> {needsReconnect ? "Reconnect Google Calendar" : "Connect Google Calendar"}
        </a>
        {note && <span className="text-[11px] text-zinc-500 max-w-60 text-right">{note}</span>}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-zinc-300 bg-white text-sm font-semibold text-zinc-800 hover:border-zinc-950 cursor-pointer"
        title={status.error ?? undefined}
      >
        <CalendarCheck size={16} /> {status.error ? "Calendar: sync issue" : "Google Calendar"}
      </button>
      {(open || note) && (
        <div className="absolute right-0 top-12 z-40 w-72 rounded-2xl border border-zinc-200 bg-white shadow-xl p-3 flex flex-col gap-2 text-sm">
          {note && <p className="text-zinc-700">{note}</p>}
          <p className="text-xs text-zinc-500">
            {status.events} event{status.events === 1 ? "" : "s"} in your “IG Curator” calendar
            {status.lastSyncedAt ? ` · synced ${new Date(status.lastSyncedAt).toLocaleString()}` : ""}
          </p>
          <p className="text-xs text-zinc-500">Reminders: shoots and edits the night before (8pm) and on the day; posts on the day.</p>
          {status.error && <p className="text-xs font-semibold text-zinc-950">{status.error}</p>}
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                const res = await syncCalendarNow()
                if (res.success) setStatus(res.data)
                setNote(null)
                setBusy(false)
              }}
              className="inline-flex items-center gap-1 px-3 h-8 rounded-full bg-zinc-950 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={12} className={busy ? "animate-spin" : ""} /> Sync now
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                if (!confirm("Disconnect Google Calendar? The “IG Curator” calendar and its reminders will be removed.")) return
                setBusy(true)
                await disconnectCalendar()
                await load()
                setNote(null)
                setOpen(false)
                setBusy(false)
              }}
              className="px-3 h-8 rounded-full border border-zinc-300 text-xs font-semibold text-zinc-700 hover:border-zinc-950 cursor-pointer"
            >
              Disconnect
            </button>
            {note && (
              <button onClick={() => setNote(null)} className="ml-auto text-xs text-zinc-400 hover:text-zinc-900 cursor-pointer">
                OK
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
