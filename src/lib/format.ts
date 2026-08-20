const DAY_MS = 1000 * 60 * 60 * 24

export const DENVER = 'America/Denver'

export function daysAgo(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS)
}

export function relativeDays(days: number): string {
  return days <= 0 ? 'just now' : `${days}d ago`
}

/** `2026-09-15` on a Denver wall clock. Calendar comparisons use these strings, never
 *  instant arithmetic, so DST transitions can't shift a day boundary. */
export function denverYmd(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DENVER }).format(now)
}

/** Kept for callers that read "today" rather than "the day of this instant". */
export function denverToday(now: Date): string {
  return denverYmd(now)
}

/** `5:00 PM` */
export function denverTime(at: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: DENVER, hour: 'numeric', minute: '2-digit' }).format(at)
}

/** `Fri` */
export function denverWeekday(at: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: DENVER, weekday: 'short' }).format(at)
}

/** `Sep 15` */
export function denverMonthDay(at: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: DENVER, month: 'short', day: 'numeric' }).format(at)
}

/** `Tuesday, Sep 15` — the status bar's leading date (design.md §statusbar). */
export function denverLongDate(at: Date): string {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: DENVER, weekday: 'long' }).format(at)
  return `${weekday}, ${denverMonthDay(at)}`
}

/** Calendar arithmetic on `YYYY-MM-DD`, done in UTC so it never crosses a DST seam. */
export function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Monday–Sunday, Denver — the week the status bar and the study dials both mean. */
export function denverWeekBounds(now: Date): { monday: string; sunday: string } {
  const today = denverYmd(now)
  const [y, m, d] = today.split('-').map(Number)
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  const monday = shiftYmd(today, -((dayOfWeek + 6) % 7))
  return { monday, sunday: shiftYmd(monday, 6) }
}

/**
 * The seven Denver dates of the gym week, Sunday first.
 *
 * Deliberately a different week from `denverWeekBounds`: the study/status week is
 * Monday–Sunday, but the gym strip renders `Su…Sa` pips (design.md §gym) and
 * `settings.gym_days` indexes 0=Sun…6=Sat to match. Two different weeks, each matching
 * what its own UI shows.
 */
export function denverGymWeek(now: Date): string[] {
  const today = denverYmd(now)
  const [y, m, d] = today.split('-').map(Number)
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  const sunday = shiftYmd(today, -dayOfWeek)
  return Array.from({ length: 7 }, (_, i) => shiftYmd(sunday, i))
}
