import { describe, expect, it } from 'vitest'
import { looksLikeExam, parseIcs, parseSummary, unescapeIcs, unfold } from './ics'

function feed(...vevents: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...vevents, 'END:VCALENDAR'].join('\r\n')
}

function vevent(uid: string, summary: string, dtstart: string): string {
  return ['BEGIN:VEVENT', `UID:${uid}`, `SUMMARY:${summary}`, dtstart, 'END:VEVENT'].join('\r\n')
}

describe('unfold', () => {
  it('joins continuation lines and strips the single leading space', () => {
    expect(unfold('SUMMARY:Problem Set\r\n  4 [ECEN 2250]')).toEqual(['SUMMARY:Problem Set 4 [ECEN 2250]'])
  })

  it('treats a tab continuation the same as a space', () => {
    expect(unfold('UID:abc\r\n\tdef')).toEqual(['UID:abcdef'])
  })
})

describe('unescapeIcs', () => {
  it('unescapes commas, semicolons, and newlines', () => {
    expect(unescapeIcs('Lab 3\\, part 2\\; final\\nnotes')).toBe('Lab 3, part 2; final\nnotes')
  })
})

describe('parseSummary', () => {
  it('takes the course from the trailing bracket group', () => {
    expect(parseSummary('Problem Set 4 [ECEN 2250]')).toEqual({ title: 'Problem Set 4', course: 'ECEN 2250' })
  })

  it('uses the last bracket group when the title contains brackets', () => {
    expect(parseSummary('Reading [ch 3] [Oceanography]')).toEqual({
      title: 'Reading [ch 3]',
      course: 'Oceanography',
    })
  })

  it('falls back to the Canvas course when there is no bracket group', () => {
    expect(parseSummary('Course evaluation')).toEqual({ title: 'Course evaluation', course: 'Canvas' })
  })
})

describe('looksLikeExam', () => {
  it('flags exams, midterms, and finals', () => {
    expect(looksLikeExam('Midterm 1')).toBe(true)
    expect(looksLikeExam('Final Exam')).toBe(true)
    expect(looksLikeExam('Finals review session')).toBe(true)
  })

  it('does not flag ordinary work', () => {
    expect(looksLikeExam('Problem Set 4')).toBe(false)
    expect(looksLikeExam('Lab report')).toBe(false)
  })
})

describe('parseIcs', () => {
  it('parses a UTC DTSTART as an exact instant', () => {
    const events = parseIcs(
      feed(vevent('event-assignment-9001', 'Problem Set 4 [ECEN 2250]', 'DTSTART:20260914T235900Z')),
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      canvas_uid: 'event-assignment-9001',
      title: 'Problem Set 4',
      course: 'ECEN 2250',
      due_at: '2026-09-14T23:59:00.000Z',
    })
  })

  it('treats an all-day date as 23:59:59 Denver — MDT in September', () => {
    const events = parseIcs(
      feed(vevent('event-assignment-9002', 'Lab 3 [Statics]', 'DTSTART;VALUE=DATE:20260914')),
    )
    // 23:59:59 MDT (UTC-6) is 05:59:59Z the next morning.
    expect(events[0].due_at).toBe('2026-09-15T05:59:59.000Z')
  })

  it('treats an all-day date as 23:59:59 Denver — MST in December', () => {
    const events = parseIcs(
      feed(vevent('event-assignment-9003', 'Final report [Statics]', 'DTSTART;VALUE=DATE:20261210')),
    )
    // 23:59:59 MST (UTC-7) is 06:59:59Z the next morning.
    expect(events[0].due_at).toBe('2026-12-11T06:59:59.000Z')
  })

  it('keeps only Canvas assignment events', () => {
    const events = parseIcs(
      feed(
        vevent('event-assignment-9004', 'Quiz 2 [Thermodynamics]', 'DTSTART:20260920T180000Z'),
        vevent('event-calendar-event-77', 'Office hours [ECEN 2250]', 'DTSTART:20260920T180000Z'),
      ),
    )
    expect(events.map((e) => e.canvas_uid)).toEqual(['event-assignment-9004'])
  })

  it('falls back to DTEND when an event has no DTSTART', () => {
    const events = parseIcs(
      feed(
        [
          'BEGIN:VEVENT',
          'UID:event-assignment-9005',
          'SUMMARY:Draft [Oceanography]',
          'DTEND:20261001T045959Z',
          'END:VEVENT',
        ].join('\r\n'),
      ),
    )
    expect(events[0].due_at).toBe('2026-10-01T04:59:59.000Z')
  })

  it('skips events with no usable date', () => {
    const events = parseIcs(
      feed(['BEGIN:VEVENT', 'UID:event-assignment-9006', 'SUMMARY:No date [ECEN 2250]', 'END:VEVENT'].join('\r\n')),
    )
    expect(events).toEqual([])
  })

  it('applies unfolding and unescaping to a real-shaped feed', () => {
    const raw = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:event-assignment-9007',
      'SUMMARY:Homework 5\\, extended',
      '  [Thermodynamics]',
      'DTSTART:20260918T055959Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    expect(parseIcs(raw)[0]).toMatchObject({ title: 'Homework 5, extended', course: 'Thermodynamics' })
  })
})
