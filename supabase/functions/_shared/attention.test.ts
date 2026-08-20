// Drift guard for the one piece of duplicated logic in the codebase.
//
// The digest's "going stale" section and the dashboard's Needs Attention list must rank
// the same rows the same way (implementation-plan.md Phase 3 checklist, Rule 7). They run
// in different runtimes and cannot share a module, so instead of trusting a comment we
// run both implementations over the same inputs and require identical output.
import { describe, expect, it } from 'vitest'
import * as server from './attention'
import * as client from '@/lib/attention'
import type { Assignment, Commitment } from '@/types/domain'

const NOW = new Date('2026-09-15T12:00:00Z')
const DAY_MS = 1000 * 60 * 60 * 24

function daysAgoIso(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString()
}

function commitment(overrides: Partial<Commitment>): Commitment {
  return {
    id: 'c1',
    user_id: 'u1',
    name: 'Test',
    category: 'technical',
    color: '#2C8C7C',
    icon: 'book',
    cadence_days: 4,
    importance: 2,
    last_progress_at: null,
    status: 'active',
    stalled_at: null,
    context: null,
    created_at: daysAgoIso(30),
    ...overrides,
  }
}

function assignment(overrides: Partial<Assignment>): Assignment {
  return {
    id: 'a1',
    user_id: 'u1',
    canvas_uid: 'event-assignment-1',
    course: 'ECEN 2250',
    title: 'Test',
    due_at: NOW.toISOString(),
    status: 'upcoming',
    is_exam: false,
    last_touched_at: null,
    first_seen_at: daysAgoIso(30),
    last_synced_at: daysAgoIso(1),
    ...overrides,
  }
}

// A grid wide enough to catch a one-sided edit: on-pace, exactly at cadence, well past
// it, every status, every importance, and never-logged.
const CADENCES = [1, 4, 7, 30]
const IMPORTANCES = [1, 2, 3]
const SINCE_DAYS = [0, 0.5, 3.9, 4, 4.1, 9, 40]
const STATUSES: Commitment['status'][] = ['active', 'stalled', 'done', 'archived']

describe('server attention mirror matches the client', () => {
  it('agrees on stalenessRatio across the grid', () => {
    for (const cadence of CADENCES) {
      for (const since of SINCE_DAYS) {
        const last = daysAgoIso(since)
        expect(server.stalenessRatio(last, daysAgoIso(30), cadence, NOW)).toBe(
          client.stalenessRatio(last, daysAgoIso(30), cadence, NOW),
        )
      }
    }
  })

  it('agrees on stalenessRatio when nothing was ever logged', () => {
    for (const cadence of CADENCES) {
      const created = daysAgoIso(12)
      expect(server.stalenessRatio(null, created, cadence, NOW)).toBe(
        client.stalenessRatio(null, created, cadence, NOW),
      )
    }
  })

  it('agrees on commitmentScore across cadence, importance, staleness, and status', () => {
    for (const cadence of CADENCES) {
      for (const importance of IMPORTANCES) {
        for (const since of SINCE_DAYS) {
          for (const status of STATUSES) {
            const c = commitment({
              cadence_days: cadence,
              importance,
              last_progress_at: daysAgoIso(since),
              status,
            })
            expect(server.commitmentScore(c, NOW)).toBe(client.commitmentScore(c, NOW))
          }
        }
      }
    }
  })

  it('agrees on isDeadlineStale, including the never-touched case', () => {
    for (const threshold of [1, 4, 7]) {
      for (const touched of [null, daysAgoIso(0), daysAgoIso(4), daysAgoIso(4.1), daysAgoIso(20)]) {
        const a = assignment({ last_touched_at: touched })
        expect(server.isDeadlineStale(a, threshold, NOW)).toBe(client.isDeadlineStale(a, threshold, NOW))
      }
    }
  })

  it('picks out exactly the commitments the dashboard calls behind', () => {
    // Section (c) of the digest is "active commitments with ratio >= 1", which is the
    // same set the dashboard scores above zero. Same input, same membership.
    const rows = [
      commitment({ id: 'onpace', last_progress_at: daysAgoIso(1), cadence_days: 4 }),
      commitment({ id: 'due', last_progress_at: daysAgoIso(4), cadence_days: 4 }),
      commitment({ id: 'late', last_progress_at: daysAgoIso(9), cadence_days: 4 }),
      commitment({ id: 'stalled', last_progress_at: daysAgoIso(9), cadence_days: 4, status: 'stalled' }),
    ]

    const digestPicks = rows
      .filter((c) => c.status === 'active' && server.stalenessRatio(c.last_progress_at, c.created_at, c.cadence_days, NOW) >= 1)
      .map((c) => c.id)
    const dashboardPicks = rows.filter((c) => client.commitmentScore(c, NOW) > 0).map((c) => c.id)

    expect(digestPicks).toEqual(dashboardPicks)
    expect(digestPicks).toEqual(['due', 'late'])
  })
})
