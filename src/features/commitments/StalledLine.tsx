import { useState } from 'react'
import type { Commitment } from '@/types/domain'
import { StatusDot } from '@/components/StatusDot'
import { daysAgo } from '@/lib/format'

interface StalledLineProps {
  commitments: Commitment[]
  now: Date
  onOpen: (commitment: Commitment, source: HTMLElement) => void
}

// Stalled commitments never appear in Needs Attention — a single collapsed
// line that expands in place to chips (design.md §zones).
export function StalledLine({ commitments, now, onOpen }: StalledLineProps) {
  const [open, setOpen] = useState(false)
  const stalled = commitments.filter((c) => c.status === 'stalled')

  if (!stalled.length) return null

  return (
    <div>
      <button type="button" className="qline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <strong>{stalled.length}</strong>
        <span>&nbsp;stalled</span>
        <span className="chev">{open ? '⌄' : '›'}</span>
      </button>
      {open && (
        <div className="chips">
          {stalled.map((c) => (
            <button key={c.id} type="button" className="chip" onClick={(e) => onOpen(c, e.currentTarget)}>
              <StatusDot status="red" />
              <span>{c.name}</span>
              <span className="num">{daysAgo(c.last_progress_at ?? c.created_at, now)}d</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
