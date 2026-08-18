import { denverMonthDay, denverTime, denverWeekday, denverYmd, shiftYmd } from './format'

const HOUR_MS = 1000 * 60 * 60

export type CountdownTier = 'overdue' | 'today' | 'tomorrow' | 'soon' | 'later'

export interface CountdownParts {
  tier: CountdownTier
  /** The bold line: `OVERDUE`, `DUE TODAY`, `DUE TOMORROW`, `5 days left`. */
  label: string
  /** The small line beneath: `Fri · 5:00 PM`, `11:59 PM`, `Sep 12 · 11:59 PM`. */
  sub: string
  /** Ported verbatim from the mockup's `countdownEl` so the CSS matches exactly. */
  className: string
}

/**
 * The urgency carrier on every deadline row (design.md §countdown).
 *
 * Red is reserved for today and overdue. Tomorrow is amber on purpose: when everything
 * urgent is red, "due tomorrow" screams as loudly as "you already missed this" and the
 * tiering stops meaning anything.
 *
 * Day boundaries are Denver calendar days, not 24-hour windows — something due at 8am
 * tomorrow is "DUE TOMORROW" even though it is 14 hours out.
 */
export function countdownParts(dueAtIso: string, now: Date): CountdownParts {
  const due = new Date(dueAtIso)
  const hours = (due.getTime() - now.getTime()) / HOUR_MS
  const time = denverTime(due)

  if (hours < 0) {
    return {
      tier: 'overdue',
      label: 'OVERDUE',
      sub: `${denverMonthDay(due)} · ${time}`,
      className: 'count count-now count-loud',
    }
  }

  const todayYmd = denverYmd(now)
  const dueYmd = denverYmd(due)

  if (dueYmd === todayYmd) {
    return { tier: 'today', label: 'DUE TODAY', sub: time, className: 'count count-now count-loud' }
  }

  if (dueYmd === shiftYmd(todayYmd, 1) || hours <= 24) {
    return { tier: 'tomorrow', label: 'DUE TOMORROW', sub: time, className: 'count count-soon count-loud' }
  }

  const days = Math.round(hours / 24)
  return {
    tier: days <= 2 ? 'soon' : 'later',
    label: `${days} days left`,
    sub: `${denverWeekday(due)} · ${time}`,
    className: days <= 2 ? 'count count-soon' : 'count',
  }
}
