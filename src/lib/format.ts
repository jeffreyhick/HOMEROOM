const DAY_MS = 1000 * 60 * 60 * 24

export function daysAgo(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS)
}

export function relativeDays(days: number): string {
  return days <= 0 ? 'just now' : `${days}d ago`
}

export function denverToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver' }).format(now)
}
