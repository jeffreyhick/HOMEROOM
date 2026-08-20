import { denverMonthDay, denverYmd, shiftYmd } from '@/lib/format'
import type { Assignment } from '@/types/domain'

export interface DeadlineWindow {
  label: string
  /** Hours from now, or null for "everything". */
  hours: number | null
}

export const WINDOWS: DeadlineWindow[] = [
  { label: 'Next 24h', hours: 24 },
  { label: '3 days', hours: 24 * 3 },
  { label: '1 week', hours: 24 * 7 },
  { label: '2 weeks', hours: 24 * 14 },
  { label: '4 weeks', hours: 24 * 28 },
  { label: 'All', hours: null },
]

/** Next 24h — the default. Most days that is the only question worth asking. */
export const DEFAULT_WINDOW = 0

/**
 * Day header for a row. Anything inside the next week gets a bare weekday; beyond that
 * the date is appended, because in a four-week window two different Fridays would
 * otherwise carry identical headers.
 */
export function dayLabel(due: Date, now: Date): string {
  if (due.getTime() < now.getTime()) return 'Overdue'
  const todayYmd = denverYmd(now)
  const dueYmd = denverYmd(due)
  if (dueYmd === todayYmd) return 'Today'
  if (dueYmd === shiftYmd(todayYmd, 1)) return 'Tomorrow'

  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', weekday: 'long' }).format(due)
  return dueYmd <= shiftYmd(todayYmd, 7) ? weekday : `${weekday} · ${denverMonthDay(due)}`
}

export function inWindow(a: Assignment, window: DeadlineWindow, now: Date): boolean {
  const hours = (new Date(a.due_at).getTime() - now.getTime()) / (1000 * 60 * 60)
  // Overdue is always shown regardless of the window — it is pinned at the top, and a
  // narrower window must never be able to hide something already missed.
  if (hours < 0) return true
  return window.hours === null || hours <= window.hours
}

export interface DayGroup {
  label: string
  rows: Assignment[]
}

/**
 * Group in **encounter order** over rows already sorted by due date — start a new group
 * whenever the label changes. Iterating a fixed weekday array instead would render next
 * Monday above this Friday in any window longer than a week.
 */
export function groupByDay(rows: Assignment[], now: Date): DayGroup[] {
  const groups: DayGroup[] = []
  for (const row of rows) {
    const label = dayLabel(new Date(row.due_at), now)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.rows.push(row)
    else groups.push({ label, rows: [row] })
  }
  return groups
}

export function sortByDue(rows: Assignment[]): Assignment[] {
  return [...rows].sort((x, y) => new Date(x.due_at).getTime() - new Date(y.due_at).getTime())
}
