import { describe, expect, it } from 'vitest'
import { type AssignmentRow, buildDigest, type CommitmentRow, stallPingCandidates } from './digest'

const NOW = new Date('2026-09-15T18:00:00Z') // Tuesday noon, Denver
const HOUR = 1000 * 60 * 60
const DAY = HOUR * 24

function hoursOut(h: number): string {
  return new Date(NOW.getTime() + h * HOUR).toISOString()
}
function daysAgo(d: number): string {
  return new Date(NOW.getTime() - d * DAY).toISOString()
}

function assignment(overrides: Partial<AssignmentRow> = {}): AssignmentRow {
  return {
    id: 'a1',
    course: 'ECEN 2250',
    title: 'Problem Set 4',
    due_at: hoursOut(48),
    status: 'upcoming',
    is_exam: false,
    last_touched_at: NOW.toISOString(),
    ...overrides,
  }
}

function commitment(overrides: Partial<CommitmentRow> = {}): CommitmentRow {
  return {
    id: 'c1',
    name: 'Space Grant',
    cadence_days: 4,
    importance: 2,
    last_progress_at: NOW.toISOString(),
    created_at: daysAgo(60),
    status: 'active',
    stalled_at: null,
    ...overrides,
  }
}

function build(over: Partial<Parameters<typeof buildDigest>[0]> = {}) {
  return buildDigest({
    assignments: [],
    commitments: [],
    stallPings: [],
    staleDeadlineDays: 4,
    now: NOW,
    appUrl: 'https://homeroom.example',
    ...over,
  })
}

describe('buildDigest', () => {
  it('sends nothing at all on a clean day', () => {
    // The single most important rule here: a digest that arrives every morning saying
    // "all clear" is one you stop reading.
    expect(build()).toBeNull()
  })

  it('stays silent when the only deadlines are on track and recently touched', () => {
    expect(
      build({
        assignments: [assignment({ due_at: hoursOut(100), last_touched_at: NOW.toISOString() })],
        commitments: [commitment({ last_progress_at: daysAgo(1) })],
      }),
    ).toBeNull()
  })

  it('lists missed deadlines first, soonest-missed first', () => {
    const digest = build({
      assignments: [
        assignment({ id: 'late2', title: 'Lab 2', due_at: hoursOut(-10) }),
        assignment({ id: 'late1', title: 'Lab 1', due_at: hoursOut(-70) }),
      ],
    })
    expect(digest).not.toBeNull()
    expect(digest!.body).toContain('OVERDUE')
    expect(digest!.body.indexOf('Lab 1')).toBeLessThan(digest!.body.indexOf('Lab 2'))
  })

  it('flags deadlines inside a week that have not been touched', () => {
    const digest = build({
      assignments: [assignment({ title: 'Untouched', due_at: hoursOut(72), last_touched_at: null })],
    })
    expect(digest!.body).toContain('DUE SOON, NOT STARTED')
    expect(digest!.body).toContain('Untouched')
  })

  it('leaves a recently touched deadline out of the stale section', () => {
    expect(
      build({
        assignments: [assignment({ due_at: hoursOut(72), last_touched_at: daysAgo(1) })],
      }),
    ).toBeNull()
  })

  it('ignores a deadline further out than a week even if untouched', () => {
    expect(
      build({ assignments: [assignment({ due_at: hoursOut(24 * 10), last_touched_at: null })] }),
    ).toBeNull()
  })

  it('marks an exam in the stale section', () => {
    const digest = build({
      assignments: [assignment({ title: 'Midterm 1', due_at: hoursOut(72), last_touched_at: null, is_exam: true })],
    })
    expect(digest!.body).toContain('Midterm 1 · EXAM')
  })

  it('ranks quiet commitments by the same score the dashboard uses', () => {
    const digest = build({
      commitments: [
        commitment({ id: 'mild', name: 'Email professors', cadence_days: 4, importance: 1, last_progress_at: daysAgo(5) }),
        commitment({ id: 'bad', name: 'Rocket sim', cadence_days: 4, importance: 3, last_progress_at: daysAgo(9) }),
      ],
    })
    expect(digest!.body).toContain('COMMITMENTS GOING QUIET')
    expect(digest!.body.indexOf('Rocket sim')).toBeLessThan(digest!.body.indexOf('Email professors'))
    expect(digest!.body).toContain('9d since progress (cadence 4d)')
  })

  it('never lists a stalled commitment as going quiet', () => {
    // Stalled work resurfaces through its own ping, not through the attention list.
    expect(
      build({ commitments: [commitment({ status: 'stalled', last_progress_at: daysAgo(40), stalled_at: daysAgo(2) })] }),
    ).toBeNull()
  })

  it('renders stall pings with correct pluralisation', () => {
    const digest = build({
      stallPings: [
        { id: 'c1', name: 'Rocket sim', weeks: 1 },
        { id: 'c2', name: 'Space Grant', weeks: 3 },
      ],
    })
    expect(digest!.body).toContain('Rocket sim — 1 week stalled')
    expect(digest!.body).toContain('Space Grant — 3 weeks stalled')
  })

  it('sends on stall pings alone, even when everything else is clean', () => {
    expect(build({ stallPings: [{ id: 'c1', name: 'Rocket sim', weeks: 2 }] })).not.toBeNull()
  })

  it('counts the subject from missed work and the next seven days', () => {
    const digest = build({
      assignments: [
        assignment({ id: 'o1', due_at: hoursOut(-5) }),
        assignment({ id: 'o2', due_at: hoursOut(-30) }),
        assignment({ id: 'soon', due_at: hoursOut(30) }),
        assignment({ id: 'far', due_at: hoursOut(24 * 20) }),
      ],
    })
    expect(digest!.subject).toBe('Homeroom — 2 behind, 1 due in the next 7 days')
  })

  it('ends with the app link', () => {
    const digest = build({ assignments: [assignment({ due_at: hoursOut(-1) })] })
    expect(digest!.body.trimEnd().endsWith('https://homeroom.example')).toBe(true)
  })
})

describe('stallPingCandidates', () => {
  it('stays quiet for the first week', () => {
    expect(stallPingCandidates([commitment({ status: 'stalled', stalled_at: daysAgo(6) })], NOW)).toEqual([])
  })

  it('pings once at seven days and holds that number all week', () => {
    expect(stallPingCandidates([commitment({ status: 'stalled', stalled_at: daysAgo(7) })], NOW)[0].weeks).toBe(1)
    expect(stallPingCandidates([commitment({ status: 'stalled', stalled_at: daysAgo(13) })], NOW)[0].weeks).toBe(1)
  })

  it('moves to the next ping number at fourteen and twenty-one days', () => {
    expect(stallPingCandidates([commitment({ status: 'stalled', stalled_at: daysAgo(14) })], NOW)[0].weeks).toBe(2)
    expect(stallPingCandidates([commitment({ status: 'stalled', stalled_at: daysAgo(21) })], NOW)[0].weeks).toBe(3)
  })

  it('ignores commitments that are not stalled, and stalled rows with no timestamp', () => {
    expect(
      stallPingCandidates(
        [
          commitment({ id: 'active', status: 'active', stalled_at: daysAgo(30) }),
          commitment({ id: 'nodate', status: 'stalled', stalled_at: null }),
        ],
        NOW,
      ),
    ).toEqual([])
  })
})
