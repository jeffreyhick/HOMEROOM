import { describe, expect, it } from 'vitest'
import { countdownParts } from './countdown'
import { denverLongDate, denverWeekBounds, shiftYmd } from './format'

// Tuesday 15 Sep 2026, 12:00 PM in Denver (MDT, UTC-6).
const NOW = new Date('2026-09-15T18:00:00Z')
const HOUR = 1000 * 60 * 60

function at(iso: string) {
  return countdownParts(iso, NOW)
}

describe('countdownParts', () => {
  it('marks anything past due as OVERDUE in red', () => {
    const c = countdownParts(new Date(NOW.getTime() - HOUR).toISOString(), NOW)
    expect(c.tier).toBe('overdue')
    expect(c.label).toBe('OVERDUE')
    expect(c.className).toBe('count count-now count-loud')
  })

  it('marks the rest of the Denver day as DUE TODAY in red', () => {
    // 11:59 PM MDT tonight.
    const c = at('2026-09-16T05:59:00Z')
    expect(c.tier).toBe('today')
    expect(c.label).toBe('DUE TODAY')
    expect(c.className).toBe('count count-now count-loud')
    expect(c.sub).toBe('11:59 PM')
  })

  it('keeps DUE TODAY when the deadline is hours away but still today', () => {
    // 9:00 PM MDT, looking at something due at 11:59 PM MDT the same evening.
    const evening = new Date('2026-09-16T03:00:00Z')
    const c = countdownParts('2026-09-16T05:59:00Z', evening)
    expect(c.tier).toBe('today')
  })

  it('uses amber, never red, for tomorrow', () => {
    const c = at('2026-09-16T14:00:00Z') // 8:00 AM MDT tomorrow
    expect(c.tier).toBe('tomorrow')
    expect(c.label).toBe('DUE TOMORROW')
    expect(c.className).toBe('count count-soon count-loud')
  })

  it('says DUE TOMORROW for late tomorrow even though it is over 24h out', () => {
    // 11:59 PM MDT tomorrow is ~36 hours away. Day boundaries are calendar days,
    // not 24-hour windows, so this must not fall through to "1 days left".
    const c = at('2026-09-17T05:59:00Z')
    expect(c.tier).toBe('tomorrow')
    expect(c.label).toBe('DUE TOMORROW')
  })

  it('treats two days out as amber but not loud', () => {
    const c = at('2026-09-17T18:00:00Z') // Thursday noon MDT
    expect(c.tier).toBe('soon')
    expect(c.label).toBe('2 days left')
    expect(c.className).toBe('count count-soon')
  })

  it('leaves anything further out quiet', () => {
    const c = at('2026-09-20T18:00:00Z') // Sunday noon MDT
    expect(c.tier).toBe('later')
    expect(c.label).toBe('5 days left')
    expect(c.className).toBe('count')
    expect(c.sub).toBe('Sun · 12:00 PM')
  })

  it('reads the day boundary in Denver, not UTC', () => {
    // 12:30 AM MDT on the 16th is already the 16th in Denver but still the 15th in UTC.
    expect(at('2026-09-16T06:30:00Z').tier).toBe('tomorrow')
  })
})

describe('denver calendar helpers', () => {
  it('shifts a date string across a month boundary', () => {
    expect(shiftYmd('2026-09-30', 1)).toBe('2026-10-01')
    expect(shiftYmd('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('bounds the week Monday through Sunday', () => {
    // NOW is a Tuesday.
    expect(denverWeekBounds(NOW)).toEqual({ monday: '2026-09-14', sunday: '2026-09-20' })
  })

  it('treats Sunday as the end of the week it closes, not the start of the next', () => {
    const sunday = new Date('2026-09-20T18:00:00Z')
    expect(denverWeekBounds(sunday)).toEqual({ monday: '2026-09-14', sunday: '2026-09-20' })
  })

  it('formats the status bar date', () => {
    expect(denverLongDate(NOW)).toBe('Tuesday, Sep 15')
  })
})
