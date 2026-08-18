import { describe, expect, it } from 'vitest'
import { assignmentScore, commitmentScore, needsAttention, stalenessRatio, weeklyStreak } from './attention'
import type { Assignment, Commitment } from '@/types/domain'

const DAY_MS = 1000 * 60 * 60 * 24
const HOUR_MS = 1000 * 60 * 60
const NOW = new Date('2026-09-15T12:00:00Z')

function makeCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: 'c1',
    user_id: 'u1',
    name: 'Test commitment',
    category: 'technical',
    color: '#2C8C7C',
    icon: 'book',
    cadence_days: 4,
    importance: 2,
    last_progress_at: null,
    status: 'active',
    stalled_at: null,
    context: null,
    created_at: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 'a1',
    user_id: 'u1',
    canvas_uid: 'event-assignment-1',
    course: 'ECEN 2250',
    title: 'Test assignment',
    due_at: NOW.toISOString(),
    status: 'upcoming',
    is_exam: false,
    last_touched_at: null,
    first_seen_at: '2026-09-01T00:00:00Z',
    last_synced_at: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

describe('stalenessRatio', () => {
  it('uses created_at when never logged', () => {
    const createdAt = new Date(NOW.getTime() - 4 * DAY_MS).toISOString()
    expect(stalenessRatio(null, createdAt, 4, NOW)).toBeCloseTo(1)
  })
})

describe('commitmentScore', () => {
  it('excludes a ratio just under 1.0', () => {
    const c = makeCommitment({
      last_progress_at: null,
      created_at: new Date(NOW.getTime() - 3.9 * DAY_MS).toISOString(),
      cadence_days: 4,
    })
    expect(commitmentScore(c, NOW)).toBe(0)
  })

  it('includes a ratio exactly at 1.0', () => {
    const c = makeCommitment({
      last_progress_at: null,
      created_at: new Date(NOW.getTime() - 4 * DAY_MS).toISOString(),
      cadence_days: 4,
      importance: 1,
    })
    expect(commitmentScore(c, NOW)).toBeCloseTo(20)
  })

  it('multiplies score by importance', () => {
    const base = makeCommitment({
      importance: 1,
      last_progress_at: null,
      created_at: new Date(NOW.getTime() - 8 * DAY_MS).toISOString(),
      cadence_days: 4,
    })
    const tripled = makeCommitment({ ...base, importance: 3 })
    expect(commitmentScore(tripled, NOW)).toBeCloseTo(commitmentScore(base, NOW) * 3)
  })

  it.each(['stalled', 'done', 'archived'] as const)('scores a %s commitment as 0', (status) => {
    const c = makeCommitment({
      status,
      last_progress_at: null,
      created_at: new Date(NOW.getTime() - 20 * DAY_MS).toISOString(),
    })
    expect(commitmentScore(c, NOW)).toBe(0)
  })
})

describe('assignmentScore', () => {
  it('scores an assignment due in 6 hours around 400', () => {
    const a = makeAssignment({
      due_at: new Date(NOW.getTime() + 6 * HOUR_MS).toISOString(),
      last_touched_at: NOW.toISOString(),
    })
    expect(assignmentScore(a, 4, NOW)).toBeCloseTo(400)
  })

  it('scores an assignment due in 4 days as 25', () => {
    const a = makeAssignment({
      due_at: new Date(NOW.getTime() + 4 * DAY_MS).toISOString(),
      last_touched_at: NOW.toISOString(),
    })
    expect(assignmentScore(a, 4, NOW)).toBeCloseTo(25)
  })

  it('applies the stale x1.5 multiplier only when due within 7 days', () => {
    const staleTouch = new Date(NOW.getTime() - 10 * DAY_MS).toISOString()
    const dueSoon = makeAssignment({
      due_at: new Date(NOW.getTime() + 4 * DAY_MS).toISOString(),
      last_touched_at: staleTouch,
    })
    const dueLater = makeAssignment({
      due_at: new Date(NOW.getTime() + 10 * DAY_MS).toISOString(),
      last_touched_at: staleTouch,
    })

    expect(assignmentScore(dueSoon, 4, NOW)).toBeCloseTo((100 / 4) * 1.5)
    expect(assignmentScore(dueLater, 4, NOW)).toBeCloseTo(100 / 10)
  })

  it('returns overdue for a past-due assignment', () => {
    const a = makeAssignment({ due_at: new Date(NOW.getTime() - HOUR_MS).toISOString() })
    expect(assignmentScore(a, 4, NOW)).toBe('overdue')
  })
})

describe('needsAttention', () => {
  it('pins overdue assignments above any scored item', () => {
    const overdueAssignment = makeAssignment({
      id: 'overdue1',
      due_at: new Date(NOW.getTime() - DAY_MS).toISOString(),
    })
    const highScoreCommitment = makeCommitment({
      id: 'hot1',
      last_progress_at: null,
      created_at: new Date(NOW.getTime() - 100 * DAY_MS).toISOString(),
      importance: 3,
    })

    const result = needsAttention(
      [overdueAssignment],
      [highScoreCommitment],
      { stale_deadline_days: 4 },
      NOW,
    )

    expect(result[0].kind).toBe('assignment')
    expect(result[0].score).toBe('overdue')
    expect(result[0].item.id).toBe('overdue1')
  })

  it('caps the list at 5 items', () => {
    const commitments = Array.from({ length: 8 }, (_, i) =>
      makeCommitment({
        id: `c${i}`,
        importance: 1,
        last_progress_at: null,
        created_at: new Date(NOW.getTime() - (5 + i) * DAY_MS).toISOString(),
        cadence_days: 4,
      }),
    )

    const result = needsAttention([], commitments, { stale_deadline_days: 4 }, NOW)
    expect(result).toHaveLength(5)
  })
})

describe('weeklyStreak', () => {
  it('counts consecutive 7-day windows with at least one log', () => {
    const logs = [
      new Date(NOW.getTime() - 3 * DAY_MS).toISOString(),
      new Date(NOW.getTime() - 9 * DAY_MS).toISOString(),
    ]
    expect(weeklyStreak(logs, NOW)).toBe(2)
  })

  it('returns 0 with no logs', () => {
    expect(weeklyStreak([], NOW)).toBe(0)
  })
})
