// Schedule values are wall-clock strings in the display timezone ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm").
// Keeping them as strings means a date-only value never shifts a day when viewed from another timezone.

export const DISPLAY_TIMEZONE = "Asia/Manila"

export type DateField = "shoot" | "edit" | "post"
export type Schedule = { start: string | null; end: string | null }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

export function isValidScheduleValue(value: string): boolean {
  if (!DATE_RE.test(value) && !DATETIME_RE.test(value)) return false
  const [y, m, d] = datePart(value).split("-").map(Number)
  const probe = new Date(Date.UTC(y, m - 1, d))
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
}

/** "YYYY-MM-DD" portion of a schedule value. */
export function datePart(value: string): string {
  return value.slice(0, 10)
}

/** "HH:mm" portion, or null for date-only values. */
export function timePart(value: string): string | null {
  return value.length > 10 ? value.slice(11, 16) : null
}

export function withTime(date: string, time: string | null): string {
  return time ? `${date}T${time}` : date
}

/** Today's calendar date in the display timezone. */
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DISPLAY_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}

export function addDaysISO(date: string, days: number): string {
  const [y, m, d] = datePart(date).split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

export function diffDays(from: string, to: string): number {
  const a = Date.parse(`${datePart(from)}T00:00:00Z`)
  const b = Date.parse(`${datePart(to)}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

/** Day of week (0 = Sunday) of a calendar date. */
export function weekday(date: string): number {
  return new Date(`${datePart(date)}T00:00:00Z`).getUTCDay()
}

/**
 * Moves a schedule so it starts on `newDate`, keeping its time of day and shifting any end by the same number of days.
 */
export function moveSchedule(schedule: Schedule, newDate: string): Schedule {
  if (!schedule.start) return { start: newDate, end: null }
  const delta = diffDays(schedule.start, newDate)
  const start = withTime(newDate, timePart(schedule.start))
  const end = schedule.end ? withTime(addDaysISO(schedule.end, delta), timePart(schedule.end)) : null
  return { start, end }
}

/** True if a calendar day falls within the schedule (inclusive of a multi-day range). */
export function scheduleCovers(schedule: Schedule, date: string): boolean {
  if (!schedule.start) return false
  const start = datePart(schedule.start)
  const end = schedule.end ? datePart(schedule.end) : start
  return date >= start && date <= end
}

/** Ascending comparison with empty values last. Schedule strings sort chronologically as text. */
export function compareNullsLast(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a < b ? -1 : a > b ? 1 : 0
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number)
  const suffix = h >= 12 ? "PM" : "AM"
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`
}

export function formatDate(value: string | null | undefined, opts: { weekday?: boolean; today?: string } = {}): string {
  if (!value) return ""
  const date = datePart(value)
  const [y, m, d] = date.split("-").map(Number)
  const thisYear = Number((opts.today ?? todayISO()).slice(0, 4))
  let out = `${MONTHS[m - 1]} ${d}${y !== thisYear ? `, ${y}` : ""}`
  if (opts.weekday) out = `${WEEKDAYS[weekday(date)]}, ${out}`
  const time = timePart(value)
  return time ? `${out} ${formatTime(time)}` : out
}

export function formatSchedule(schedule: Schedule): string {
  if (!schedule.start) return ""
  if (!schedule.end) return formatDate(schedule.start)
  const sameDay = datePart(schedule.start) === datePart(schedule.end)
  const endText = sameDay && timePart(schedule.end) ? formatTime(timePart(schedule.end)!) : formatDate(schedule.end)
  return `${formatDate(schedule.start)} → ${endText}`
}

export function relativeDays(date: string, today = todayISO()): string {
  const diff = diffDays(today, date)
  if (diff === 0) return "today"
  if (diff === 1) return "tomorrow"
  if (diff === -1) return "yesterday"
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`
}
