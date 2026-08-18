// Pure ICS parsing for the Canvas calendar feed. No Deno APIs and no network here on
// purpose: index.ts owns all I/O, and this file stays importable by the unit tests.

const DENVER = 'America/Denver'

export interface ParsedEvent {
  canvas_uid: string
  title: string
  course: string
  due_at: string
}

/** RFC 5545 line unfolding: a line starting with space/tab continues the previous one. */
export function unfold(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const out: string[] = []
  for (const line of lines) {
    if (out.length > 0 && (line.startsWith(' ') || line.startsWith('\t'))) {
      out[out.length - 1] += line.slice(1)
    } else {
      out.push(line)
    }
  }
  return out
}

export function unescapeIcs(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c))
}

/**
 * What UTC instant shows `y-m-d hh:mm:ss` on a Denver wall clock?
 * Guess the instant as if the components were UTC, ask what Denver actually reads at
 * that instant, and correct by the difference. One pass is exact except within an hour
 * of a DST transition, and the only wall time we convert is 23:59:59.
 */
export function denverWallClockToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DENVER,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(guess))
  const at = Object.fromEntries(parts.map((p) => [p.type, p.value])) as Record<string, string>
  const denverAsUtc = Date.UTC(
    Number(at.year),
    Number(at.month) - 1,
    Number(at.day),
    Number(at.hour) % 24,
    Number(at.minute),
    Number(at.second),
  )
  return new Date(guess + (guess - denverAsUtc))
}

/** `DTSTART:20260914T235900Z` (UTC instant) or `DTSTART;VALUE=DATE:20260914` (all-day). */
export function parseIcsDate(rawParams: string, value: string): Date | null {
  const isDateOnly = /VALUE=DATE(?!-TIME)/i.test(rawParams) || /^\d{8}$/.test(value)
  if (isDateOnly) {
    const m = value.match(/^(\d{4})(\d{2})(\d{2})$/)
    if (!m) return null
    // An all-day Canvas deadline means "by the end of that day, Denver time".
    return denverWallClockToInstant(Number(m[1]), Number(m[2]), Number(m[3]), 23, 59, 59)
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/)
  if (!m) return null
  const [, y, mo, d, hh, mi, ss, zulu] = m
  if (zulu === 'Z') {
    return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mi), Number(ss)))
  }
  // Floating local time — Canvas emits Denver wall clock for this account.
  return denverWallClockToInstant(Number(y), Number(mo), Number(d), Number(hh), Number(mi), Number(ss))
}

/** `"Problem Set 4 [ECEN 2250]"` → course from the last bracket group, title from the rest. */
export function parseSummary(summary: string): { title: string; course: string } {
  const open = summary.lastIndexOf('[')
  const close = summary.lastIndexOf(']')
  if (open !== -1 && close > open) {
    const course = summary.slice(open + 1, close).trim()
    const title = (summary.slice(0, open) + summary.slice(close + 1)).trim()
    if (course) return { title: title || summary.trim(), course }
  }
  return { title: summary.trim(), course: 'Canvas' }
}

/** First-insert heuristic only. A hand-set `is_exam` always wins on re-sync. */
export function looksLikeExam(title: string): boolean {
  return /\b(exam|midterm|finals?)\b/i.test(title)
}

function eventFromBlock(block: string[]): ParsedEvent | null {
  let uid = ''
  let summary = ''
  let dtStart: Date | null = null
  let dtEnd: Date | null = null

  for (const line of block) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const head = line.slice(0, colon)
    const value = line.slice(colon + 1)
    const name = head.split(';')[0].toUpperCase()

    if (name === 'UID') uid = value.trim()
    else if (name === 'SUMMARY') summary = unescapeIcs(value)
    else if (name === 'DTSTART') dtStart = parseIcsDate(head, value.trim())
    else if (name === 'DTEND') dtEnd = parseIcsDate(head, value.trim())
  }

  // Canvas assignment events only; plain calendar events are out of scope.
  if (!uid.startsWith('event-assignment-')) return null
  const due = dtStart ?? dtEnd
  if (!due || Number.isNaN(due.getTime())) return null

  const { title, course } = parseSummary(summary)
  if (!title) return null

  return { canvas_uid: uid, title, course, due_at: due.toISOString() }
}

export function parseIcs(raw: string): ParsedEvent[] {
  const lines = unfold(raw)
  const events: ParsedEvent[] = []
  let block: string[] | null = null

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      block = []
      continue
    }
    if (line.startsWith('END:VEVENT')) {
      if (block) {
        const event = eventFromBlock(block)
        if (event) events.push(event)
      }
      block = null
      continue
    }
    if (block) block.push(line)
  }
  return events
}
