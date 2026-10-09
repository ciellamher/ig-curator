"use server"

import { prisma } from "@/lib/prisma"
import { requireUserId, run, type Result } from "@/lib/planner/server"
import { googleCalendarConfigured, revoke, syncUserCalendar } from "@/lib/googleCalendar"

export type CalendarStatus = { available: boolean; connected: boolean; lastSyncedAt: string | null; error: string | null; events: number }

export async function getCalendarStatus(): Promise<Result<CalendarStatus>> {
  return run(async () => {
    const userId = await requireUserId()
    const available = googleCalendarConfigured()
    const link = available ? await prisma.googleCalendarLink.findUnique({ where: { userId } }) : null
    const events = link ? await prisma.calendarEvent.count({ where: { userId } }) : 0
    return { available, connected: !!link, lastSyncedAt: link?.lastSyncedAt?.toISOString() ?? null, error: link?.lastError ?? null, events }
  })
}

export async function syncCalendarNow(): Promise<Result<CalendarStatus>> {
  return run(async () => {
    const userId = await requireUserId()
    await syncUserCalendar(userId)
    const res = await getCalendarStatus()
    if (!res.success) throw new Error(res.error)
    return res.data
  })
}

/** Stops syncing, removes the "IG Curator" calendar (so no stale reminders keep firing) and revokes access. */
export async function disconnectCalendar(): Promise<Result<{ ok: true }>> {
  return run(async () => {
    const userId = await requireUserId()
    const link = await prisma.googleCalendarLink.findUnique({ where: { userId } })
    if (link) {
      if (link.calendarId) {
        try {
          const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.GCAL_CLIENT_ID!,
              client_secret: process.env.GCAL_CLIENT_SECRET!,
              refresh_token: (await import("@/lib/googleCalendar")).decryptForDisconnect(link.refreshToken),
              grant_type: "refresh_token",
            }),
          })
          const { access_token } = await res.json()
          if (access_token) {
            await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(link.calendarId)}`, {
              method: "DELETE",
              headers: { authorization: `Bearer ${access_token}` },
            })
          }
        } catch {}
      }
      await revoke(link.refreshToken)
      await prisma.$transaction([
        prisma.calendarEvent.deleteMany({ where: { userId } }),
        prisma.googleCalendarLink.delete({ where: { userId } }),
      ])
    }
    return { ok: true as const }
  })
}
