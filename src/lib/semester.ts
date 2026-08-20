import { DENVER } from './format'

/**
 * When the current term started, Denver time.
 *
 * Nothing in the schema records semester boundaries, and adding a table for two dates a
 * year would be its own kind of nonsense. So this is a rule, stated once and testable:
 * **August 1 opens the fall term, January 1 opens the spring term.** Summer work counts
 * toward spring, which is the honest answer for a student who is not taking summer
 * classes and would otherwise watch the counter reset for no reason.
 *
 * The counter is a feel-good number, not an accounting record — a boundary that is
 * predictable matters more than one that is precise.
 */
export function semesterStartYmd(now: Date): string {
  const [year, month] = new Intl.DateTimeFormat('en-CA', { timeZone: DENVER })
    .format(now)
    .split('-')
    .map(Number)
  return month >= 8 ? `${year}-08-01` : `${year}-01-01`
}

/** The same boundary as an instant, for `timestamptz` comparisons. */
export function semesterStartIso(now: Date): string {
  const [y, m, d] = semesterStartYmd(now).split('-').map(Number)
  // Denver is UTC-6 or -7; 07:00Z is midnight-or-later Denver on that date either way,
  // and a term boundary is a day, not a second.
  return new Date(Date.UTC(y, m - 1, d, 7, 0, 0)).toISOString()
}
