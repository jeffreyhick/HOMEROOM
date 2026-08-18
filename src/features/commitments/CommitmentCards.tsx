import { useState, type FormEvent } from 'react'
import type { Commitment, CommitmentCategory, NewCommitment, Subtask } from '@/types/domain'
import { ClassTag } from '@/components/ClassTag'
import { StatusDot } from '@/components/StatusDot'
import { commitmentTier } from '@/lib/attention'
import { daysAgo } from '@/lib/format'

const CATEGORIES: CommitmentCategory[] = ['technical', 'career', 'personal', 'school']

interface CommitmentCardsProps {
  commitments: Commitment[]
  subtasks: Subtask[]
  now: Date
  onOpen: (commitment: Commitment, source: HTMLElement) => void
  onCreate: (input: NewCommitment) => Promise<unknown>
}

// Desktop: card grid (glyph + dot + name + Nd + done/total); phone: chips (index.css
// media query). design.md §zones — 2 per row inside the 720px column.
export function CommitmentCards({ commitments, subtasks, now, onOpen, onCreate }: CommitmentCardsProps) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<CommitmentCategory>('personal')
  const [cadenceDays, setCadenceDays] = useState(4)
  const [importance, setImportance] = useState(2)

  const active = commitments.filter((c) => c.status === 'active')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await onCreate({ name: trimmed, category, cadence_days: cadenceDays, importance })
    setName('')
    setAdding(false)
  }

  return (
    <>
      <div className="grid">
        {active.map((c) => {
          const own = subtasks.filter((s) => s.commitment_id === c.id)
          const done = own.filter((s) => s.done).length
          return (
            <button key={c.id} type="button" className="ccard" onClick={(e) => onOpen(c, e.currentTarget)}>
              <div className="ccard-top">
                <ClassTag color={c.color} icon={c.icon} size="sm" />
                <StatusDot status={commitmentTier(c, now)} />
                <span className="ccard-name">{c.name}</span>
              </div>
              <div className="ccard-foot">
                <span className="num">{daysAgo(c.last_progress_at ?? c.created_at, now)}d</span>
                <span className="ccard-sep">·</span>
                <span className="num">
                  {done}/{own.length}
                </span>
              </div>
            </button>
          )
        })}
        <button type="button" className="ccard" onClick={() => setAdding(true)}>
          <div className="ccard-top">
            <span className="ccard-name" style={{ color: 'var(--accent)' }}>
              + Add commitment
            </span>
          </div>
        </button>
      </div>

      {adding && (
        <form className="addrow" style={{ marginTop: 12, flexWrap: 'wrap' }} onSubmit={handleSubmit}>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Commitment name"
            aria-label="Commitment name"
            style={{ flex: '1 1 180px' }}
          />
          <select
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as CommitmentCategory)}
            className="qmins"
            style={{ width: 'auto' }}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={cadenceDays}
            onChange={(e) => setCadenceDays(Number(e.target.value))}
            aria-label="Cadence days"
            className="qmins"
            style={{ width: 64 }}
          />
          <select
            aria-label="Importance"
            value={importance}
            onChange={(e) => setImportance(Number(e.target.value))}
            className="qmins"
            style={{ width: 'auto' }}
          >
            <option value={1}>low importance</option>
            <option value={2}>medium importance</option>
            <option value={3}>high importance</option>
          </select>
          <button type="submit" className="btn btn-hero">
            Add
          </button>
          <button type="button" className="btn" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </form>
      )}
    </>
  )
}
