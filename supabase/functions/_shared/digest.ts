// Pure composition of the daily digest. No database, no network, no clock of its own —
// so the rules that are easy to get subtly wrong (which sections appear, when a quiet day
// sends nothing, when a stalled commitment earns its next ping) are unit-tested rather
// than discovered in a real inbox at 7am.
import { commitmentScore, isDeadlineStale, stalenessRatio } from './attention.ts'

const DAY_MS = 1000 * 60 * 60 * 24
const HOUR_MS = 1000 * 60 * 60
const DENVER = 'America/Denver'

export interface AssignmentRow {
  id: string
  course: string
  title: string
  due_at: string
  status: string
  is_exam: boolean
  last_touched_at: string | null
}

export interface CommitmentRow {
  id: string
  name: string
  cadence_days: number
  importance: number
  last_progress_at: string | null
  created_at: string
  status: string
  stalled_at: string | null
}

export interface StallPing {
  id: string
  name: string
  weeks: number
}

/** `Mon, Sep 14 at 11:59 PM` — Denver, because every deadline in this app is Denver. */
export function denverHuman(at: Date): string {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: DENVER,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(at)
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: DENVER,
    hour: 'numeric',
    minute: '2-digit',
  }).format(at)
  return `${day} at ${time}`
}

function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS)
}

function hoursUntil(iso: string, now: Date): number {
  return (new Date(iso).getTime() - now.getTime()) / HOUR_MS
}

/**
 * Which stalled commitments have crossed a fresh 7-day mark. `weeks` is the ping number:
 * 1 at seven days, 2 at fourteen, and so on. The caller turns each into a `stall:<id>:<k>`
 * dedupe key, so a given week can only ever ping once — and a commitment left stalled for
 * months pings at most once a week, never on every run.
 */
export function stallPingCandidates(commitments: CommitmentRow[], now: Date): StallPing[] {
  const out: StallPing[] = []
  for (const c of commitments) {
    if (c.status !== 'stalled' || !c.stalled_at) continue
    const weeks = Math.floor((now.getTime() - new Date(c.stalled_at).getTime()) / (7 * DAY_MS))
    if (weeks < 1) continue
    out.push({ id: c.id, name: c.name, weeks })
  }
  return out
}

export interface DigestInput {
  assignments: AssignmentRow[]
  commitments: CommitmentRow[]
  /** Only the pings whose dedupe key the caller actually won. */
  stallPings: StallPing[]
  staleDeadlineDays: number
  now: Date
  appUrl: string
}

/**
 * Returns null when there is genuinely nothing to say. That is the important case: a
 * digest that arrives every morning saying "all clear" is a digest you stop reading, and
 * then the one that matters gets skimmed too.
 */
export function buildDigest(input: DigestInput): { subject: string; body: string } | null {
  const { assignments, commitments, stallPings, staleDeadlineDays, now, appUrl } = input

  const upcoming = assignments.filter((a) => a.status === 'upcoming')
  const byDue = (x: AssignmentRow, y: AssignmentRow) =>
    new Date(x.due_at).getTime() - new Date(y.due_at).getTime()

  // (a) actually missed
  const overdue = upcoming.filter((a) => hoursUntil(a.due_at, now) < 0).sort(byDue)

  // (b) coming up and untouched
  const goingStale = upcoming
    .filter((a) => {
      const hours = hoursUntil(a.due_at, now)
      return hours >= 0 && hours <= 7 * 24 && isDeadlineStale(a, staleDeadlineDays, now)
    })
    .sort(byDue)

  // (c) commitments past their cadence — the same set the dashboard calls behind
  const behind = commitments
    .filter(
      (c) =>
        c.status === 'active' && stalenessRatio(c.last_progress_at, c.created_at, c.cadence_days, now) >= 1,
    )
    .sort((x, y) => commitmentScore(y, now) - commitmentScore(x, now))

  const sections: string[] = []

  if (overdue.length > 0) {
    sections.push(
      [
        'OVERDUE',
        ...overdue.map((a) => `  · ${a.course} — ${a.title} (was due ${denverHuman(new Date(a.due_at))})`),
      ].join('\n'),
    )
  }
  if (goingStale.length > 0) {
    sections.push(
      [
        'DUE SOON, NOT STARTED',
        ...goingStale.map(
          (a) => `  · ${a.course} — ${a.title}${a.is_exam ? ' · EXAM' : ''} (due ${denverHuman(new Date(a.due_at))})`,
        ),
      ].join('\n'),
    )
  }
  if (behind.length > 0) {
    sections.push(
      [
        'COMMITMENTS GOING QUIET',
        ...behind.map((c) => {
          const since = daysSince(c.last_progress_at ?? c.created_at, now)
          return `  · ${c.name} — ${since}d since progress (cadence ${c.cadence_days}d)`
        }),
      ].join('\n'),
    )
  }
  if (stallPings.length > 0) {
    sections.push(
      [
        'STILL STALLED',
        ...stallPings.map(
          (s) => `  · ${s.name} — ${s.weeks} week${s.weeks === 1 ? '' : 's'} stalled. Resume or archive it?`,
        ),
      ].join('\n'),
    )
  }

  if (sections.length === 0) return null

  const dueThisWeek = upcoming.filter((a) => {
    const hours = hoursUntil(a.due_at, now)
    return hours >= 0 && hours <= 7 * 24
  }).length

  return {
    // Deviates from the plan's "<m> due this week" wording: this counts the next seven
    // days, not the Monday–Sunday week the status bar means. Saying what is actually
    // counted beats mirroring the week-bounds helper into the function runtime.
    subject: `Homeroom — ${overdue.length} behind, ${dueThisWeek} due in the next 7 days`,
    body: [...sections, '', appUrl].filter(Boolean).join('\n\n'),
  }
}
