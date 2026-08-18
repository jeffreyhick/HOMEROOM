import { ClassTag } from '@/components/ClassTag'
import { Countdown } from '@/components/Countdown'
import type { Assignment } from '@/types/domain'

interface DeadlineListProps {
  assignments: Assignment[]
  now: Date
  identityFor: (course: string) => { color: string; icon: string }
  onOpen: (assignment: Assignment, source: HTMLElement) => void
}

/**
 * Dashboard zone 5 (design.md §pages). The collapsed preview shows the **3 soonest** and
 * **excludes overdue** — an overdue assignment is already pinned atop Needs Attention,
 * and repeating it spends the information budget on something already said. The full set
 * lives in the windowed Deadlines view (§deadlines-expanded), which is Phase 4.
 */
export function DeadlineList({ assignments, now, identityFor, onOpen }: DeadlineListProps) {
  const nowMs = now.getTime()
  const shown = assignments
    .filter((a) => a.status === 'upcoming' && new Date(a.due_at).getTime() >= nowMs)
    .slice(0, 3)

  if (shown.length === 0) {
    return <p className="empty">Nothing due in the next stretch.</p>
  }

  return (
    <div className="rows">
      {shown.map((a) => {
        const identity = identityFor(a.course)
        return (
          <button
            key={a.id}
            type="button"
            className="row"
            onClick={(e) => {
              e.stopPropagation()
              onOpen(a, e.currentTarget)
            }}
          >
            <ClassTag color={identity.color} icon={identity.icon} />
            <div className="row-main">
              <span className="row-kicker" style={{ color: identity.color }}>
                {a.course}
              </span>
              <span className="row-text">{a.title}</span>
              {a.is_exam && <span className="tag-exam">EXAM</span>}
            </div>
            <Countdown dueAt={a.due_at} now={now} />
          </button>
        )
      })}
    </div>
  )
}
