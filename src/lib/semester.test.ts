import { describe, expect, it } from 'vitest'
import { semesterStartIso, semesterStartYmd } from './semester'

describe('semesterStartYmd', () => {
  it('opens the fall term on August 1', () => {
    expect(semesterStartYmd(new Date('2026-08-01T12:00:00Z'))).toBe('2026-08-01')
    expect(semesterStartYmd(new Date('2026-09-15T18:00:00Z'))).toBe('2026-08-01')
    expect(semesterStartYmd(new Date('2026-12-31T12:00:00Z'))).toBe('2026-08-01')
  })

  it('opens the spring term on January 1 and carries summer with it', () => {
    expect(semesterStartYmd(new Date('2027-01-01T12:00:00Z'))).toBe('2027-01-01')
    expect(semesterStartYmd(new Date('2027-06-20T12:00:00Z'))).toBe('2027-01-01')
    expect(semesterStartYmd(new Date('2027-07-31T12:00:00Z'))).toBe('2027-01-01')
  })

  it('reads the boundary in Denver, not UTC', () => {
    // 2026-08-01T04:00:00Z is still July 31 in Denver, so the fall term has not opened.
    expect(semesterStartYmd(new Date('2026-08-01T04:00:00Z'))).toBe('2026-01-01')
  })

  it('produces an instant on the boundary date', () => {
    expect(semesterStartIso(new Date('2026-09-15T18:00:00Z'))).toBe('2026-08-01T07:00:00.000Z')
  })
})
