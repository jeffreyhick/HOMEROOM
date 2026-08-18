import { ClassTag } from '@/components/ClassTag'
import { Countdown } from '@/components/Countdown'
import { StatusDot } from '@/components/StatusDot'
import { assignmentTier, commitmentTier } from '@/lib/attention'
import { daysAgo, relativeDays } from '@/lib/format'
import type { Assignment, AttentionItem, Commitment } from '@/types/domain'

interface NeedsAttentionListProps {
  items: AttentionItem[]
  now: Date
  staleDeadlineDays: number
  identityFor: (course: string) => { color: string; icon: string }
  onOpenCommitment: (commitment: Commitment, source: HTMLElement) => void
  onOpenAssignment: (assignment: Assignment, source: HTMLElement) => void
}

/**
 * Ranked top-5 (formula in schema.md). Row = status dot + class glyph + title + meta.
 * The course prefix is a kicker *inline* with the title, not a column — this zone is
 * ranked, so rows deliberately do not align tabularly with each other.
 */
export function NeedsAttentionList({
  items,
  now,
  staleDeadlineDays,
  identityFor,
  onOpenCommitment,
  onOpenAssignment,
}: NeedsAttentionListProps) {
  if (!items.length) {
    return <p className="empty">Nothing behind. Go live your life.</p>
  }

  return (
    <div className="rows">
      {items.map((entry) => {
        if (entry.kind === 'commitment') {
          const c = entry.item
          return (
            <button key={c.id} type="button" className="row" onClick={(e) => onOpenCommitment(c, e.currentTarget)}>
              <StatusDot status={commitmentTier(c, now)} />
              <ClassTag color={c.color} icon={c.icon} />
              <div className="row-main">
                <span className="row-text">{c.name}</span>
                <span className="row-kicker">commitment</span>
              </div>
              <span className="row-meta">
                {relativeDays(daysAgo(c.last_progress_at ?? c.created_at, now))} since progress
              </span>
            </button>
          )
        }

        const a = entry.item
        const identity = identityFor(a.course)
        return (
          <button key={a.id} type="button" className="row" onClick={(e) => onOpenAssignment(a, e.currentTarget)}>
            <StatusDot status={assignmentTier(a, staleDeadlineDays, now)} />
            <ClassTag color={identity.color} icon={identity.icon} />
            <div className="row-main">
              <span className="row-kicker" style={{ color: identity.color }}>
                {a.course}
              </span>
              <span className="row-text">{a.title}</span>
              {entry.score === 'overdue' && <span className="tag-overdue">OVERDUE</span>}
              {a.is_exam && <span className="tag-exam">EXAM</span>}
            </div>
            <Countdown dueAt={a.due_at} now={now} />
          </button>
        )
      })}
    </div>
  )
}
