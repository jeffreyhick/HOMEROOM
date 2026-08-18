import { useEffect, useState, type KeyboardEvent } from 'react'
import { daysAgo } from '@/lib/format'
import type { SettingsPatch } from '@/types/domain'

interface LeftOffCardProps {
  now: Date
  note: string | null
  notedAt: string | null
  onSave: (patch: SettingsPatch) => Promise<unknown>
}

// Inset "where you stopped" note (design.md §leftoff) — one global note,
// autosaves on blur. Never a card; empty state is a single italic line.
// Presentational on purpose: the page owns the settings row so the dashboard
// fetches it once rather than once per component that reads it.
export function LeftOffCard({ now, note, notedAt, onSave }: LeftOffCardProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  useEffect(() => {
    setValue(note ?? '')
  }, [note])

  async function handleBlur() {
    const trimmed = value.trim()
    setEditing(false)
    if (trimmed === (note ?? '')) return
    await onSave({
      left_off_note: trimmed || null,
      left_off_at: trimmed ? new Date().toISOString() : null,
    })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      setValue(note ?? '')
      setEditing(false)
    }
  }

  const whenLabel = notedAt
    ? `noted ${daysAgo(notedAt, now) <= 0 ? 'today' : `${daysAgo(notedAt, now)}d ago`}`
    : null

  return (
    <div
      className="leftoff"
      role="button"
      tabIndex={0}
      aria-label="Where you left off. Click to edit."
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') setEditing(true)
      }}
    >
      <span className="leftoff-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3 8-8" />
          <path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11" />
        </svg>
      </span>
      <div className="leftoff-body">
        <div className="leftoff-label">Where you left off</div>
        {editing ? (
          <textarea
            className="leftoff-edit"
            autoFocus
            value={value}
            placeholder="What did you just do, and where do you pick up next?"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        ) : note ? (
          <>
            <div className="leftoff-text">{note}</div>
            {whenLabel && <div className="leftoff-when">{whenLabel}</div>}
          </>
        ) : (
          <div className="leftoff-text is-empty">Nothing noted. Click to jot where you stopped.</div>
        )}
      </div>
    </div>
  )
}
