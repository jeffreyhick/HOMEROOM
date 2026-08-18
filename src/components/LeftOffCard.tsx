import { useEffect, useState, type KeyboardEvent } from 'react'
import { useSettings } from '@/features/settings/useSettings'
import { daysAgo } from '@/lib/format'

// Inset "where you stopped" note (design.md §leftoff) — one global note,
// autosaves on blur. Never a card; empty state is a single italic line.
export function LeftOffCard({ now }: { now: Date }) {
  const { settings, update } = useSettings()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (settings) setValue(settings.left_off_note ?? '')
  }, [settings])

  async function handleBlur() {
    const trimmed = value.trim()
    setEditing(false)
    if (trimmed === (settings?.left_off_note ?? '')) return
    await update({
      left_off_note: trimmed || null,
      left_off_at: trimmed ? new Date().toISOString() : null,
    })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      setValue(settings?.left_off_note ?? '')
      setEditing(false)
    }
  }

  const note = settings?.left_off_note ?? null
  const whenLabel = settings?.left_off_at
    ? `noted ${daysAgo(settings.left_off_at, now) <= 0 ? 'today' : `${daysAgo(settings.left_off_at, now)}d ago`}`
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
