import { ICONS } from './icons'
import { denverLongDate, denverWeekBounds, denverYmd } from '@/lib/format'
import type { Assignment } from '@/types/domain'

interface StatusBarProps {
  assignments: Assignment[]
  now: Date
  identityFor: (course: string) => { color: string; icon: string }
}

function SbIcon({ icon, color }: { icon: string; color: string }) {
  return (
    <span className="sb-ico" style={{ color }} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: ICONS[icon] ?? ICONS.book }}
      />
    </span>
  )
}

/**
 * One full-width coloured line, deliberately **not a card** (design.md §statusbar) —
 * date, this week's load, what is actually behind, and the next exam.
 *
 * The two counts are defined narrowly so the bar can never drift from the lists below:
 * "this week" is upcoming work inside the Monday–Sunday Denver week that is not yet
 * past due, and "behind" is deadlines actually *missed*. A commitment past its cadence
 * is not behind — it is "needs attention", the list right underneath, and counting it
 * here would double-report the same thing.
 */
export function StatusBar({ assignments, now, identityFor }: StatusBarProps) {
  const nowMs = now.getTime()
  const { monday, sunday } = denverWeekBounds(now)

  const upcoming = assignments.filter((a) => a.status === 'upcoming')

  const thisWeek = upcoming.filter((a) => {
    if (new Date(a.due_at).getTime() < nowMs) return false
    const ymd = denverYmd(new Date(a.due_at))
    return ymd >= monday && ymd <= sunday
  }).length

  const behind = upcoming.filter((a) => new Date(a.due_at).getTime() < nowMs).length

  const nextExam =
    upcoming
      .filter((a) => a.is_exam && new Date(a.due_at).getTime() >= nowMs)
      .sort((x, y) => new Date(x.due_at).getTime() - new Date(y.due_at).getTime())[0] ?? null

  const examDays = nextExam
    ? Math.max(1, Math.round((new Date(nextExam.due_at).getTime() - nowMs) / (1000 * 60 * 60 * 24)))
    : 0
  const examTone = examDays <= 2 ? ' now' : examDays <= 7 ? ' soon' : ''

  return (
    <div className="statusbar">
      <span className="sb-date">{denverLongDate(now)}</span>
      <span className="sb-sep" aria-hidden="true" />

      <span className="sb-item">
        <SbIcon icon="book" color="var(--accent)" />
        <span className="sb-num sb-deadlines">{thisWeek}</span>
        <span>{thisWeek === 1 ? ' deadline' : ' deadlines'} this week</span>
      </span>

      <span className="sb-sep" aria-hidden="true" />

      <span className="sb-item">
        {behind > 0 ? (
          <>
            <SbIcon icon="flame" color="var(--status-red)" />
            <span className="sb-num sb-behind-bad">{behind}</span>
            <span>{behind === 1 ? ' thing behind' : ' things behind'}</span>
          </>
        ) : (
          <span className="sb-behind-ok">on pace</span>
        )}
      </span>

      {nextExam && (
        <>
          <span className="sb-sep" aria-hidden="true" />
          <span className="sb-item sb-exam">
            <SbIcon icon="grad" color={identityFor(nextExam.course).color} />
            <span className="sb-exam-name">
              {nextExam.course} {nextExam.title}
            </span>
            <span className={`sb-exam-when${examTone}`}>{examDays === 1 ? 'tomorrow' : `in ${examDays}d`}</span>
          </span>
        </>
      )}
    </div>
  )
}
