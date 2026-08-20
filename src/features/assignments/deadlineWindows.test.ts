import { describe, expect, it } from 'vitest'
import { dayLabel, DEFAULT_WINDOW, groupByDay, inWindow, sortByDue, WINDOWS } from './deadlineWindows'
import type { Assignment } from '@/types/domain'

// Tuesday 15 Sep 2026, 12:00 PM Denver (MDT).
const NOW = new Date('2026-09-15T18:00:00Z')
const HOUR = 1000 * 60 * 60

function at(hoursFromNow: number, id = String(hoursFromNow)): Assignment {
  return {
    id,
    user_id: 'u1',
    canvas_uid: null,
    course: 'ECEN 2250',
    title: `Task ${id}`,
    due_at: new Date(NOW.getTime() + hoursFromNow * HOUR).toISOString(),
    status: 'upcoming',
    is_exam: false,
    last_touched_at: null,
    first_seen_at: NOW.toISOString(),
    last_synced_at: NOW.toISOString(),
  }
}

describe('window selector', () => {
  it('defaults to the next 24 hours', () => {
    expect(WINDOWS[DEFAULT_WINDOW].label).toBe('Next 24h')
  })

  it('offers exactly the six specified windows', () => {
    expect(WINDOWS.map((w) => w.label)).toEqual(['Next 24h', '3 days', '1 week', '2 weeks', '4 weeks', 'All'])
  })
})

describe('inWindow', () => {
  it('keeps overdue visible in every window, including the narrowest', () => {
    // A narrower window must never hide something already missed — it is pinned.
    for (const window of WINDOWS) {
      expect(inWindow(at(-100), window, NOW)).toBe(true)
    }
  })

  it('includes work inside the window and excludes work beyond it', () => {
    const next24h = WINDOWS[0]
    expect(inWindow(at(23), next24h, NOW)).toBe(true)
    expect(inWindow(at(24), next24h, NOW)).toBe(true)
    expect(inWindow(at(25), next24h, NOW)).toBe(false)
  })

  it('lets the All window through unconditionally', () => {
    expect(inWindow(at(24 * 365), WINDOWS[5], NOW)).toBe(true)
  })

  it('widens monotonically — nothing drops out as the window grows', () => {
    const rows = [at(-5), at(2), at(50), at(24 * 10), at(24 * 20), at(24 * 200)]
    const counts = WINDOWS.map((w) => rows.filter((r) => inWindow(r, w, NOW)).length)
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1])
    }
    expect(counts[counts.length - 1]).toBe(rows.length)
  })
})

describe('dayLabel', () => {
  it('names the near days rather than dating them', () => {
    expect(dayLabel(new Date(NOW.getTime() - HOUR), NOW)).toBe('Overdue')
    expect(dayLabel(new Date('2026-09-16T05:59:00Z'), NOW)).toBe('Today') // 11:59 PM MDT tonight
    expect(dayLabel(new Date('2026-09-16T18:00:00Z'), NOW)).toBe('Tomorrow')
  })

  it('uses a bare weekday inside the coming week', () => {
    expect(dayLabel(new Date('2026-09-18T18:00:00Z'), NOW)).toBe('Friday')
  })

  it('adds the date beyond a week, so two Fridays cannot collide', () => {
    const near = dayLabel(new Date('2026-09-18T18:00:00Z'), NOW)
    const far = dayLabel(new Date('2026-10-02T18:00:00Z'), NOW)
    expect(near).toBe('Friday')
    expect(far).toBe('Friday · Oct 2')
    expect(near).not.toBe(far)
  })
})

describe('groupByDay', () => {
  it('keeps groups in chronological order across a multi-week window', () => {
    // The bug this guards: iterating a fixed weekday array puts next Monday above this
    // Friday, because Monday comes first in the array.
    const rows = sortByDue([at(24 * 10, 'nextWeekMonday'), at(72, 'thisFriday')])
    expect(groupByDay(rows, NOW).map((g) => g.rows[0].id)).toEqual(['thisFriday', 'nextWeekMonday'])
  })

  it('pins overdue first', () => {
    const rows = sortByDue([at(5, 'soon'), at(-30, 'missed')])
    expect(groupByDay(rows, NOW)[0].label).toBe('Overdue')
  })

  it('collects same-day rows into one group', () => {
    const rows = sortByDue([at(2, 'a'), at(4, 'b'), at(6, 'c')])
    const groups = groupByDay(rows, NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0].rows.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('splits two different weeks that share a weekday name into separate groups', () => {
    const rows = sortByDue([at(72, 'friday1'), at(72 + 24 * 14, 'friday3')])
    const groups = groupByDay(rows, NOW)
    expect(groups).toHaveLength(2)
    expect(groups[0].label).not.toBe(groups[1].label)
  })

  it('returns nothing for an empty window', () => {
    expect(groupByDay([], NOW)).toEqual([])
  })
})
