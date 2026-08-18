import { useState, type FormEvent } from 'react'
import { ClassTag } from '@/components/ClassTag'
import { ConfirmInline } from '@/components/ConfirmInline'
import { Countdown } from '@/components/Countdown'
import { useToast } from '@/components/UndoToast'
import { daysAgo, denverLongDate, denverTime, relativeDays } from '@/lib/format'
import type { Assignment } from '@/types/domain'

type UndoResult = { undo: () => void }

interface AssignmentExpandedProps {
  assignment: Assignment
  now: Date
  identity: { color: string; icon: string }
  onLogProgress: (id: string, note?: string) => Promise<UndoResult>
  onMarkDone: (id: string) => Promise<UndoResult>
  onDismiss: (id: string) => Promise<UndoResult>
  onReopen: (id: string) => Promise<UndoResult>
  onClose: () => void
}

// The state-legal action table in design.md §drawer-actions: an `upcoming` assignment
// offers Log progress / Mark done / Dismiss; a finished one offers only Reopen.
export function AssignmentExpanded({
  assignment: a,
  now,
  identity,
  onLogProgress,
  onMarkDone,
  onDismiss,
  onReopen,
  onClose,
}: AssignmentExpandedProps) {
  const { showToast } = useToast()
  const [note, setNote] = useState('')

  const due = new Date(a.due_at)

  async function run(action: () => Promise<UndoResult>, message: string) {
    const { undo } = await action()
    onClose()
    showToast(message, undo)
  }

  function handleLogProgress(e?: FormEvent) {
    e?.preventDefault()
    const trimmed = note.trim()
    setNote('')
    return run(() => onLogProgress(a.id, trimmed || undefined), `Progress logged on ${a.title}`)
  }

  return (
    <>
      <div className="xhead">
        <h2 className="xtitle">{a.title}</h2>
        <div className="xsub">
          <ClassTag color={identity.color} icon={identity.icon} size="sm" />
          <span style={{ color: identity.color, fontWeight: 600 }}>{a.course}</span>
          {a.is_exam && <span className="tag-exam">EXAM</span>}
          <Countdown dueAt={a.due_at} now={now} />
        </div>
      </div>

      <div className="xmeta">
        <span>
          due {denverLongDate(due)} · {denverTime(due)}
        </span>
        <span>
          {a.last_touched_at ? `touched ${relativeDays(daysAgo(a.last_touched_at, now))}` : 'not started'}
        </span>
        {a.canvas_uid === null && <span>added by hand</span>}
      </div>

      {a.status === 'upcoming' && (
        <form className="addrow" style={{ marginTop: 18 }} onSubmit={handleLogProgress}>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note — what did you actually do?"
            aria-label="Optional progress note"
          />
        </form>
      )}

      <div className="actions">
        {a.status === 'upcoming' ? (
          <>
            <button type="button" className="btn btn-hero" onClick={() => handleLogProgress()}>
              Log progress
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => run(() => onMarkDone(a.id), `${a.title} marked done`)}
            >
              Mark done
            </button>
            <span className="spacer" />
            <ConfirmInline
              label="Dismiss"
              confirmLabel="Dismiss — sure?"
              onConfirm={() => run(() => onDismiss(a.id), `${a.title} dismissed`)}
            />
          </>
        ) : (
          <button
            type="button"
            className="btn btn-hero"
            onClick={() => run(() => onReopen(a.id), `${a.title} reopened`)}
          >
            Reopen
          </button>
        )}
      </div>
    </>
  )
}
