import type { Assignment, AttentionItem, Commitment, Settings } from '@/types/domain'

const DAY_MS = 1000 * 60 * 60 * 24
const HOUR_MS = 1000 * 60 * 60

export function stalenessRatio(
  lastProgressAt: string | null,
  createdAt: string,
  cadenceDays: number,
  now: Date,
): number {
  const referenceIso = lastProgressAt ?? createdAt
  const daysSince = (now.getTime() - new Date(referenceIso).getTime()) / DAY_MS
  return daysSince / cadenceDays
}

export function commitmentScore(c: Commitment, now: Date): number {
  if (c.status !== 'active') return 0
  const ratio = stalenessRatio(c.last_progress_at, c.created_at, c.cadence_days, now)
  if (ratio < 1) return 0
  return 20 * ratio * c.importance
}

export function commitmentTier(c: Commitment, now: Date): 'red' | 'amber' | 'green' {
  if (c.status === 'stalled') return 'red'
  const ratio = stalenessRatio(c.last_progress_at, c.created_at, c.cadence_days, now)
  if (ratio >= 2) return 'red'
  if (ratio >= 1) return 'amber'
  return 'green'
}

export function assignmentScore(
  a: Assignment,
  staleDeadlineDays: number,
  now: Date,
): number | 'overdue' | 0 {
  if (a.status !== 'upcoming') return 0

  const hoursUntilDue = (new Date(a.due_at).getTime() - now.getTime()) / HOUR_MS
  if (hoursUntilDue < 0) return 'overdue'

  const daysUntilDue = hoursUntilDue / 24
  let score = 100 / Math.max(daysUntilDue, 0.25)

  const isStale =
    a.last_touched_at === null ||
    (now.getTime() - new Date(a.last_touched_at).getTime()) / DAY_MS > staleDeadlineDays
  if (isStale && daysUntilDue <= 7) score *= 1.5

  return score
}

function scoredSortKey(item: AttentionItem): number {
  return item.kind === 'assignment'
    ? new Date(item.item.due_at).getTime()
    : new Date(item.item.created_at).getTime()
}

export function needsAttention(
  assignments: Assignment[],
  commitments: Commitment[],
  settings: Pick<Settings, 'stale_deadline_days'>,
  now: Date,
): AttentionItem[] {
  const overdue: AttentionItem[] = []
  const scored: AttentionItem[] = []

  for (const a of assignments) {
    const score = assignmentScore(a, settings.stale_deadline_days, now)
    if (score === 'overdue') {
      overdue.push({ kind: 'assignment', score: 'overdue', item: a })
    } else if (score > 0) {
      scored.push({ kind: 'assignment', score, item: a })
    }
  }

  for (const c of commitments) {
    const score = commitmentScore(c, now)
    if (score > 0) {
      scored.push({ kind: 'commitment', score, item: c })
    }
  }

  overdue.sort(
    (x, y) =>
      new Date((x.item as Assignment).due_at).getTime() -
      new Date((y.item as Assignment).due_at).getTime(),
  )

  scored.sort((x, y) => {
    const scoreDiff = (y.score as number) - (x.score as number)
    if (scoreDiff !== 0) return scoreDiff
    return scoredSortKey(x) - scoredSortKey(y)
  })

  return [...overdue, ...scored].slice(0, 5)
}

export function weeklyStreak(logIsoDates: string[], now: Date): number {
  const nowMs = now.getTime()
  const logTimes = logIsoDates.map((iso) => new Date(iso).getTime())

  let streak = 0
  while (true) {
    const windowEnd = nowMs - streak * 7 * DAY_MS
    const windowStart = windowEnd - 7 * DAY_MS
    const hasLog = logTimes.some((t) => t > windowStart && t <= windowEnd)
    if (!hasLog) break
    streak++
  }
  return streak
}
