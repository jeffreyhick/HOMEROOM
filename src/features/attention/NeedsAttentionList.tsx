import type { AttentionItem, Commitment } from '@/types/domain'
import { ClassTag } from '@/components/ClassTag'
import { StatusDot } from '@/components/StatusDot'
import { commitmentTier } from '@/lib/attention'
import { daysAgo, relativeDays } from '@/lib/format'

interface NeedsAttentionListProps {
  items: AttentionItem[]
  now: Date
  onOpenCommitment: (commitment: Commitment, source: HTMLElement) => void
}

// Ranked top-5 (formula in schema.md). Row = status dot + class glyph + title + meta.
// Assignment rows land in Phase 2 once `assignments` exists; the branch below stays
// inert (no click handler) until AssignmentExpanded ships.
export function NeedsAttentionList({ items, now, onOpenCommitment }: NeedsAttentionListProps) {
  if (!items.length) {
    return <p className="empty">Nothing behind. Go live your life.</p>
  }

  return (
    <div className="rows">
      {items.map((entry) =>
        entry.kind === 'commitment' ? (
          <button
            key={entry.item.id}
            type="button"
            className="row"
            onClick={(e) => onOpenCommitment(entry.item, e.currentTarget)}
          >
            <StatusDot status={commitmentTier(entry.item, now)} />
            <ClassTag color={entry.item.color} icon={entry.item.icon} />
            <div className="row-main">
              <span className="row-text">{entry.item.name}</span>
              <span className="row-kicker">commitment</span>
            </div>
            <span className="row-meta">
              {relativeDays(daysAgo(entry.item.last_progress_at ?? entry.item.created_at, now))} since progress
            </span>
          </button>
        ) : (
          <div key={entry.item.id} className="row">
            <div className="row-main">
              <span className="row-kicker">{entry.item.course}</span>
              <span className="row-text">{entry.item.title}</span>
            </div>
            <span className="row-meta">{entry.item.due_at}</span>
          </div>
        ),
      )}
    </div>
  )
}
