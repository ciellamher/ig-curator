// Google Calendar sync (server only). Mirrors planner dates into an "IG Curator" calendar the app creates, using the
// narrow calendar.app.created scope (it can't see or change any other calendar).

import { after } from "next/server"
import crypto from "node:crypto"
import type { CalendarEvent, Content, ClothingOrder } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { SHEIN_ENABLED } from "@/lib/features"
import {
  CALENDAR_TIMEZONE,
  desiredCalendarEvents,
  googleWindow,
  scheduleFromGoogle,
  sentWindow,
  type CalendarEventBody,
  type DesiredEvent,
  type GoogleEventTime,
} from "@/lib/planner/calendarEvents"
import { isValidScheduleValue, type Schedule } from "@/lib/planner/dates"
import { withScheduleRules } from "@/lib/planner/rules"
import type { ContentDTO, OrderDTO } from "@/lib/planner/types"

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.app.created"
const API = "https://www.googleapis.com/calendar/v3"

export function googleCalendarConfigured(): boolean {
  return Boolean(process.env.GCAL_CLIENT_ID && process.env.GCAL_CLIENT_SECRET)
}

export function appUrl(): string {
  return process.env.NEXTAUTH_URL || "https://ig-curator.vercel.app"
}

// ---- token encryption (AES-256-GCM, key derived from NEXTAUTH_SECRET) ----

function key() {
  return crypto.createHash("sha256").update(`gcal:${process.env.NEXTAUTH_SECRET || "fallback_secret_ig_curator_12345"}`).digest()
}
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv)
  const data = Buffer.concat([c.update(text, "utf8"), c.final()])
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".")
}
function decrypt(blob: string): string {
  const [iv, tag, data] = blob.split(".").map((p) => Buffer.from(p, "base64"))
  const d = crypto.createDecipheriv("aes-256-gcm", key(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(data), d.final()]).toString("utf8")
}

/** Used only when disconnecting, to remove the calendar before revoking access. */
export function decryptForDisconnect(blob: string): string {
  return decrypt(blob)
}

// ---- OAuth ----

export async function exchangeCode(code: string, redirectUri: string): Promise<{ refreshToken: string; accessToken: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GCAL_CLIENT_ID!,
      client_secret: process.env.GCAL_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })
  const json = await res.json()
  if (!res.ok || !json.refresh_token) throw new Error(json.error_description || json.error || "Google didn't return access")
  return { refreshToken: json.refresh_token, accessToken: json.access_token }
}

class ReconnectNeeded extends Error {}

async function accessToken(encryptedRefresh: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GCAL_CLIENT_ID!,
      client_secret: process.env.GCAL_CLIENT_SECRET!,
      refresh_token: decrypt(encryptedRefresh),
      grant_type: "refresh_token",
    }),
  })
  const json = await res.json()
  if (json.error === "invalid_grant") throw new ReconnectNeeded("Google Calendar access expired — reconnect it")
  if (!res.ok) throw new Error(json.error_description || json.error || "Couldn't reach Google")
  return json.access_token
}

async function google(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(json?.error?.message || `Google Calendar error ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return json
}

export async function revoke(encryptedRefresh: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(encryptedRefresh))}`, { method: "POST" }).catch(() => {})
}

// ---- data ----

function toItem(c: Content): ContentDTO {
  return {
    id: c.id, parentId: c.parentId, title: c.title, status: c.status, categories: c.categories, edited: c.edited,
    clothingStatus: c.clothingStatus, orderedAt: c.orderedAt?.toISOString() ?? null, deliveredAt: c.deliveredAt?.toISOString() ?? null,
    orderId: c.orderId, shoot: { start: c.shootStart, end: c.shootEnd }, edit: { start: c.editStart, end: c.editEnd },
    post: { start: c.postStart, end: c.postEnd }, pinterestUrl: null, location: null, body: "", slotId: c.slotId,
    contentType: c.contentType, extraSlots: null, media: [], createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
  }
}
function toOrder(o: ClothingOrder): OrderDTO {
  return {
    id: o.id, name: o.name, orderedAt: o.orderedAt?.toISOString() ?? null, deliveredAt: o.deliveredAt?.toISOString() ?? null,
    returnedAt: o.returnedAt?.toISOString() ?? null, createdAt: o.createdAt.toISOString(),
  }
}

const hashOf = (b: CalendarEventBody) => crypto.createHash("sha1").update(JSON.stringify(b)).digest("hex")

// ---- Google → planner ----

type GoogleEvent = { id: string; status?: string; start?: GoogleEventTime; end?: GoogleEventTime }

/** Events changed since the last sync (all of them the first time, or when Google says the token is too old). */
async function changedEvents(token: string, cal: string, syncToken: string | null): Promise<{ events: GoogleEvent[]; nextSyncToken: string | null }> {
  const events: GoogleEvent[] = []
  let pageToken: string | undefined
  for (;;) {
    const q = new URLSearchParams({ timeZone: CALENDAR_TIMEZONE, maxResults: "250", showDeleted: "true" })
    if (syncToken) q.set("syncToken", syncToken)
    if (pageToken) q.set("pageToken", pageToken)
    let page
    try {
      page = await google(token, "GET", `/calendars/${cal}/events?${q}`)
    } catch (e) {
      if ((e as { status?: number }).status === 410 && syncToken) return changedEvents(token, cal, null)
      throw e
    }
    events.push(...((page.items ?? []) as GoogleEvent[]))
    if (page.nextPageToken) pageToken = page.nextPageToken
    else return { events, nextSyncToken: page.nextSyncToken ?? null }
  }
}

const FIELDS = { shoot: ["shootStart", "shootEnd"], edit: ["editStart", "editEnd"], post: ["postStart", "postEnd"] } as const
type Field = keyof typeof FIELDS

/** Shoot / edit / post events moved in Google Calendar move the planner dates too. Returns how many pages changed. */
async function pullMovedEvents(userId: string, events: GoogleEvent[], existing: CalendarEvent[], rows: Content[], desired: DesiredEvent[]): Promise<number> {
  const byGoogleId = new Map(existing.map((e) => [e.googleEventId, e]))
  const desiredByKey = new Map(desired.map((d) => [d.key, d]))
  const pages = new Map(rows.map((r) => [r.id, r]))
  let changed = 0
  for (const ev of events) {
    if (ev.status === "cancelled") continue // deleted in Google: it's put back on the next push
    const row = byGoogleId.get(ev.id)
    if (!row) continue
    const [contentId, field] = row.key.split(":") as [string, Field]
    const page = pages.get(contentId)
    const win = googleWindow(ev)
    if (!(field in FIELDS) || !page || !win) continue
    const wanted = desiredByKey.get(row.key)
    const sent = row.start && row.end ? { start: row.start, end: row.end } : wanted ? sentWindow(wanted.body) : null
    if (!sent || (sent.start === win.start && sent.end === win.end)) continue

    const [startCol, endCol] = FIELDS[field]
    const previous: Schedule = { start: page[startCol], end: page[endCol] }
    const next = scheduleFromGoogle(win, previous)
    await prisma.calendarEvent.update({ where: { id: row.id }, data: { start: win.start, end: win.end } })
    if (!next.start || !isValidScheduleValue(next.start) || (next.end && !isValidScheduleValue(next.end))) continue
    if (next.start === previous.start && next.end === previous.end) continue

    // Same automatic rules as the planner (moving Post Now moves the edit date, etc.)
    const item = toItem(page)
    const patch = withScheduleRules(item, { [field]: next })
    const data: Record<string, unknown> = {}
    for (const f of Object.keys(FIELDS) as Field[]) {
      const value = patch[f]
      if (value) {
        data[FIELDS[f][0]] = value.start
        data[FIELDS[f][1]] = value.end
      }
    }
    if (patch.status) data.status = patch.status
    if (typeof patch.edited === "boolean") data.edited = patch.edited
    await prisma.content.update({ where: { id: page.id }, data })
    changed++
  }
  return changed
}

// ---- sync ----

const running = new Map<string, Promise<number>>()

/**
 * Two-way sync with the user's "IG Curator" calendar: first takes in events moved in Google, then sends the planner's
 * dates (only what changed). Returns how many planner pages changed because of Google.
 */
export async function syncUserCalendar(userId: string): Promise<number> {
  if (!googleCalendarConfigured()) return 0
  // One sync at a time per user (in this server instance)
  const prev = running.get(userId) ?? Promise.resolve(0)
  const next = prev.catch(() => 0).then(() => doSync(userId))
  running.set(userId, next)
  try {
    return await next
  } finally {
    if (running.get(userId) === next) running.delete(userId)
  }
}

async function doSync(userId: string): Promise<number> {
  const link = await prisma.googleCalendarLink.findUnique({ where: { userId } })
  if (!link) return 0
  try {
    const token = await accessToken(link.refreshToken)
    let calendarId = link.calendarId
    let syncToken = link.syncToken
    if (calendarId) {
      // The calendar may have been deleted in Google: recreate it (and its events) if so
      try {
        await google(token, "GET", `/calendars/${encodeURIComponent(calendarId)}`)
      } catch (e) {
        if ((e as { status?: number }).status === 404 || (e as { status?: number }).status === 410) calendarId = null
        else throw e
      }
    }
    if (!calendarId) {
      const cal = await google(token, "POST", "/calendars", { summary: "IG Curator", description: "Shoot, edit and post reminders from IG Curator", timeZone: CALENDAR_TIMEZONE })
      calendarId = cal.id as string
      syncToken = null
      await prisma.calendarEvent.deleteMany({ where: { userId } })
      await prisma.googleCalendarLink.update({ where: { userId }, data: { calendarId, syncToken: null } })
    }
    const cal = encodeURIComponent(calendarId)

    const load = () =>
      Promise.all([
        prisma.content.findMany({ where: { userId } }),
        prisma.clothingOrder.findMany({ where: { userId } }),
        prisma.calendarEvent.findMany({ where: { userId } }),
      ])
    const wantedNow = (rows: Content[], orders: ClothingOrder[]) =>
      desiredCalendarEvents(rows.map(toItem), orders.map(toOrder), { shein: SHEIN_ENABLED, appUrl: appUrl() })

    // 1. Google → planner
    let [rows, orders, existing] = await load()
    const { events, nextSyncToken } = await changedEvents(token, cal, syncToken)
    const pulled = await pullMovedEvents(userId, events, existing, rows, wantedNow(rows, orders))
    if (pulled) [rows, orders, existing] = await load()
    else existing = await prisma.calendarEvent.findMany({ where: { userId } })

    // 2. Planner → Google
    const desired = wantedNow(rows, orders)
    const byKey = new Map(existing.map((e) => [e.key, e]))
    const wanted = new Set(desired.map((d) => d.key))

    for (const d of desired) {
      const hash = hashOf(d.body)
      const sent = sentWindow(d.body)
      const have = byKey.get(d.key)
      if (have && have.hash === hash) continue
      if (have) {
        try {
          await google(token, "PUT", `/calendars/${cal}/events/${encodeURIComponent(have.googleEventId)}`, d.body)
          await prisma.calendarEvent.update({ where: { id: have.id }, data: { hash, ...sent } })
          continue
        } catch (e) {
          if ((e as { status?: number }).status !== 404 && (e as { status?: number }).status !== 410) throw e
          await prisma.calendarEvent.delete({ where: { id: have.id } }) // deleted in Google: create it again
        }
      }
      const ev = await google(token, "POST", `/calendars/${cal}/events`, d.body)
      try {
        await prisma.calendarEvent.create({ data: { userId, key: d.key, googleEventId: ev.id, hash, ...sent } })
      } catch {
        await google(token, "DELETE", `/calendars/${cal}/events/${encodeURIComponent(ev.id)}`).catch(() => {}) // a parallel sync won
      }
    }
    for (const e of existing) {
      if (wanted.has(e.key)) continue
      await google(token, "DELETE", `/calendars/${cal}/events/${encodeURIComponent(e.googleEventId)}`).catch((err) => {
        if (err.status !== 404 && err.status !== 410) throw err
      })
      await prisma.calendarEvent.delete({ where: { id: e.id } }).catch(() => {})
    }
    await prisma.googleCalendarLink.update({ where: { userId }, data: { lastSyncedAt: new Date(), lastError: null, syncToken: nextSyncToken } })
    return pulled
  } catch (e) {
    console.error("Google Calendar sync failed:", e)
    await prisma.googleCalendarLink.update({ where: { userId }, data: { lastError: String((e as Error).message).slice(0, 300) } }).catch(() => {})
    return 0
  }
}

/** Queue a sync after the current response, so saving in the planner is never slowed down by Google. */
export function scheduleCalendarSync(userId: string) {
  if (!googleCalendarConfigured()) return
  try {
    after(() => syncUserCalendar(userId))
  } catch {
    syncUserCalendar(userId).catch(() => {})
  }
}
