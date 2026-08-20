// Server-side mirror of `src/lib/attention.ts`.
//
// Rule 7 (define shared logic once) cannot be met literally here: the browser bundle and
// the Deno function have no shared module graph, and reaching outside `supabase/functions/`
// breaks `functions deploy`. So this is a deliberate, *verified* duplicate — the bodies
// below are kept line-for-line comparable with the client file, and
// `attention.test.ts` next to it runs both implementations over the same grid of inputs
// and fails the build if they ever disagree.
//
// If you change a formula, change it in both files. The test will tell you if you didn't.

const DAY_MS = 1000 * 60 * 60 * 24

// Structural shapes only — the function has no access to `src/types/domain.ts`.
export interface CommitmentLike {
  cadence_days: number
  importance: number
  last_progress_at: string | null
  created_at: string
  status: string
}

export interface AssignmentLike {
  last_touched_at: string | null
}

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

export function commitmentScore(c: CommitmentLike, now: Date): number {
  if (c.status !== 'active') return 0
  const ratio = stalenessRatio(c.last_progress_at, c.created_at, c.cadence_days, now)
  if (ratio < 1) return 0
  return 20 * ratio * c.importance
}

export function isDeadlineStale(a: AssignmentLike, staleDeadlineDays: number, now: Date): boolean {
  if (a.last_touched_at === null) return true
  return (now.getTime() - new Date(a.last_touched_at).getTime()) / DAY_MS > staleDeadlineDays
}
