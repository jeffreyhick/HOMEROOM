import { useState, type FormEvent } from 'react'
import type { Commitment } from '@/types/domain'
import { ConfirmInline } from '@/components/ConfirmInline'
import { useToast } from '@/components/UndoToast'
import { burstFromRect, finaleOnPanel, prefersReducedMotion } from '@/lib/celebrate'
import { commitmentTier, weeklyStreak } from '@/lib/attention'
import { daysAgo, relativeDays } from '@/lib/format'
import { useCommitmentDetail } from './useCommitmentDetail'

const IMPORTANCE_LABEL: Record<number, string> = { 1: 'low', 2: 'medium', 3: 'high' }

type UndoResult = { undo: () => void }

interface CommitmentExpandedProps {
  commitment: Commitment
  now: Date
  onLogProgress: (id: string, note?: string) => Promise<UndoResult>
  onMarkStalled: (id: string) => Promise<UndoResult>
  onResume: (id: string) => Promise<UndoResult>
  onArchive: (id: string) => Promise<UndoResult>
  onUpdate: (id: string, patch: Partial<Pick<Commitment, 'cadence_days' | 'importance'>>) => Promise<unknown>
  onChanged: () => void
  onClose: () => void
}

// "A small project" — design.md §expanded. Header/meta/progress groove/context/
// subtasks/recent logs/actions, exactly the state-legal action table in §drawer-actions.
export function CommitmentExpanded({
  commitment: c,
  now,
  onLogProgress,
  onMarkStalled,
  onResume,
  onArchive,
  onUpdate,
  onChanged,
  onClose,
}: CommitmentExpandedProps) {
  const { subtasks, logs, addSubtask, toggleSubtask, deleteSubtask, updateContext } = useCommitmentDetail(c.id)
  const { showToast } = useToast()
  const [contextValue, setContextValue] = useState(c.context ?? '')
  const [newSubtask, setNewSubtask] = useState('')
  const [progressNote, setProgressNote] = useState('')
  const [editingCadence, setEditingCadence] = useState(false)
  const [cadenceDays, setCadenceDays] = useState(c.cadence_days)
  const [importance, setImportance] = useState(c.importance)

  const done = subtasks.filter((s) => s.done).length
  const total = subtasks.length
  const tier = commitmentTier(c, now)
  const streak = weeklyStreak(logs.map((l) => l.created_at), now)

  async function handleLogProgress() {
    const note = progressNote.trim()
    const { undo } = await onLogProgress(c.id, note || undefined)
    setProgressNote('')
    onClose()
    showToast(`Progress logged on ${c.name}`, undo)
  }

  async function handleMarkStalled() {
    const { undo } = await onMarkStalled(c.id)
    onClose()
    showToast(`${c.name} marked stalled`, undo)
  }

  async function handleResume() {
    const { undo } = await onResume(c.id)
    onClose()
    showToast(`${c.name} resumed`, undo)
  }

  async function handleArchive() {
    const { undo } = await onArchive(c.id)
    onClose()
    showToast(`${c.name} archived`, undo)
  }

  /**
   * Ticking a subtask is the app's main dopamine hit (design.md §celebration), so it
   * gets all three layers. Un-ticking gets none — undoing something is not an
   * achievement, and celebrating it would cheapen the real thing.
   */
  async function handleToggle(id: string, element?: HTMLElement) {
    const wasDone = subtasks.find((s) => s.id === id)?.done ?? false
    // Measure BEFORE the toggle: the re-render replaces this node, and a rect read
    // afterwards points at a box that no longer exists.
    const rect = element?.getBoundingClientRect() ?? null

    await toggleSubtask(id)
    onChanged()
    if (wasDone) return

    const nowAllDone = subtasks.length > 0 && subtasks.every((s) => s.done || s.id === id)

    if (!prefersReducedMotion() && element?.isConnected) {
      element.classList.remove('pop')
      void element.offsetWidth
      element.classList.add('pop')
    }
    if (rect) burstFromRect(rect)

    if (nowAllDone) {
      const panel = element?.closest('.xpanel') ?? document.querySelector('.xpanel')
      if (panel instanceof HTMLElement) finaleOnPanel(panel, 'All steps done!')
    }
  }

  async function handleDelete(id: string) {
    await deleteSubtask(id)
    onChanged()
  }

  function handleAddSubtask(e: FormEvent) {
    e.preventDefault()
    const title = newSubtask.trim()
    if (!title) return
    setNewSubtask('')
    addSubtask(title).then(onChanged)
  }

  async function handleContextBlur() {
    if (contextValue === (c.context ?? '')) return
    await updateContext(contextValue)
    onChanged()
    showToast('Context saved')
  }

  async function handleSaveCadence() {
    await onUpdate(c.id, { cadence_days: cadenceDays, importance })
    setEditingCadence(false)
    onChanged()
  }

  return (
    <>
      <div className="xhead">
        <h2 className="xtitle">{c.name}</h2>
        <div className="xsub">
          <span>
            {c.category} · {IMPORTANCE_LABEL[c.importance]} importance
          </span>
          <span className={`pill is-${tier}`}>{c.status}</span>
        </div>
      </div>

      <div className="xmeta">
        <span>last progress {relativeDays(daysAgo(c.last_progress_at ?? c.created_at, now))}</span>
        <span>cadence every {c.cadence_days}d</span>
        <span>streak {streak} wk</span>
      </div>

      <div className="xsection">
        <div className="xlabel">Progress</div>
        <div className="groove-wrap">
          <div className="groove">
            <div
              className="groove-fill"
              style={{ width: total ? `${(done / total) * 100}%` : '0%', backgroundColor: `var(--status-${tier})` }}
            />
          </div>
          <span className="groove-label num">
            {done}/{total}
          </span>
        </div>
      </div>

      <div className="xsection">
        <div className="xlabel">Context</div>
        <textarea
          className="field"
          value={contextValue}
          placeholder="What is this, and what is actually blocking it?"
          onChange={(e) => setContextValue(e.target.value)}
          onBlur={handleContextBlur}
        />
      </div>

      <div className="xsection">
        <div className="xlabel">Subtasks</div>
        <div className="checks">
          {subtasks.map((s) => (
            <div key={s.id} className={`check${s.done ? ' is-done' : ''}`}>
              <button
                type="button"
                className="check-box"
                aria-pressed={s.done}
                aria-label={(s.done ? 'Uncheck ' : 'Check ') + s.title}
                onClick={(e) => handleToggle(s.id, e.currentTarget)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </button>
              <button
                type="button"
                className="check-title"
                onClick={(e) => handleToggle(s.id, e.currentTarget.parentElement?.querySelector('.check-box') as HTMLElement)}
              >
                {s.title}
              </button>
              <button type="button" className="check-del" aria-label={`Delete ${s.title}`} onClick={() => handleDelete(s.id)}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <form className="addrow" onSubmit={handleAddSubtask}>
          <input
            type="text"
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            placeholder="+ add a next step"
            aria-label="Add a next step"
          />
        </form>
      </div>

      <div className="xsection">
        <div className="xlabel">Recent progress</div>
        <div className="logs">
          {logs.slice(0, 5).map((l) => (
            <div className="log" key={l.id}>
              <span className="log-when num">{relativeDays(daysAgo(l.created_at, now))}</span>
              <span className="log-note">{l.note ?? '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {editingCadence && (
        <div className="xsection">
          <div className="xlabel">Edit cadence</div>
          <div className="study-meta">
            <label className="study-goal">
              every
              <input
                type="number"
                min={1}
                className="goal-input"
                value={cadenceDays}
                onChange={(e) => setCadenceDays(Number(e.target.value))}
              />
              days
            </label>
            <select value={importance} onChange={(e) => setImportance(Number(e.target.value))} className="goal-input" style={{ width: 'auto' }}>
              <option value={1}>low importance</option>
              <option value={2}>medium importance</option>
              <option value={3}>high importance</option>
            </select>
            <button type="button" className="btn btn-hero" onClick={handleSaveCadence}>
              Save
            </button>
          </div>
        </div>
      )}

      {c.status === 'active' && (
        <div className="addrow" style={{ marginTop: 18 }}>
          <input
            type="text"
            value={progressNote}
            onChange={(e) => setProgressNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleLogProgress()
              }
            }}
            placeholder="Optional note — what did you actually do?"
            aria-label="Optional progress note"
          />
        </div>
      )}

      <div className="actions">
        {c.status === 'active' ? (
          <>
            <button type="button" className="btn btn-hero" onClick={handleLogProgress}>
              Log progress
            </button>
            <button type="button" className="btn" onClick={handleMarkStalled}>
              Mark stalled
            </button>
            <button type="button" className="btn" onClick={() => setEditingCadence((v) => !v)}>
              Edit cadence
            </button>
            <span className="spacer" />
            <ConfirmInline label="Archive" confirmLabel="Archive — sure?" onConfirm={handleArchive} />
          </>
        ) : (
          <>
            <button type="button" className="btn btn-hero" onClick={handleResume}>
              Resume
            </button>
            <span className="spacer" />
            <ConfirmInline label="Archive" confirmLabel="Archive — sure?" onConfirm={handleArchive} />
          </>
        )}
      </div>
    </>
  )
}
