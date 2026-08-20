import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'
import { TopBar } from '@/components/TopBar'
import { LeftOffCard } from '@/components/LeftOffCard'
import { ExpandedPanel } from '@/components/ExpandedPanel'
import { StatusBar } from '@/components/StatusBar'
import { NeedsAttentionList } from '@/features/attention/NeedsAttentionList'
import { AssignmentExpanded } from '@/features/assignments/AssignmentExpanded'
import { DeadlineList } from '@/features/assignments/DeadlineList'
import { DeadlinesExpanded } from '@/features/assignments/DeadlinesExpanded'
import { useAssignments } from '@/features/assignments/useAssignments'
import { CommitmentCards } from '@/features/commitments/CommitmentCards'
import { CommitmentExpanded } from '@/features/commitments/CommitmentExpanded'
import { StalledLine } from '@/features/commitments/StalledLine'
import { useCommitments } from '@/features/commitments/useCommitments'
import { useCourses } from '@/features/courses/useCourses'
import { GymStrip } from '@/features/gym/GymStrip'
import { useSettings } from '@/features/settings/useSettings'
import { HeroStrip } from '@/features/wins/HeroStrip'
import { WinsExpanded } from '@/features/wins/WinsExpanded'
import { useWins } from '@/features/wins/useWins'
import { needsAttention } from '@/lib/attention'
import { denverYmd, shiftYmd } from '@/lib/format'
import type { Assignment, Commitment } from '@/types/domain'

const DEFAULT_STALE_DEADLINE_DAYS = 4
const DEADLINE_WINDOW_DAYS = 7

/**
 * An explicit stack, not a single "current" slot (design.md §expanded). An assignment row
 * inside the Deadlines window pushes on top of it; closing pops back to the window rather
 * than dumping you on the dashboard.
 */
type Detail =
  | { kind: 'commitment'; id: string }
  | { kind: 'assignment'; id: string }
  | { kind: 'deadlines' }
  | { kind: 'wins' }

function syncLabel(lastSyncedAt: string | null, failed: boolean, now: Date): string | undefined {
  if (failed) return 'sync failed'
  if (!lastSyncedAt) return undefined
  const minutes = Math.floor((now.getTime() - new Date(lastSyncedAt).getTime()) / 60000)
  if (minutes < 1) return 'synced just now'
  if (minutes < 60) return `synced ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `synced ${hours}h ago` : `synced ${Math.floor(hours / 24)}d ago`
}

export function DashboardPage() {
  const now = useMemo(() => new Date(), [])
  const commitmentsApi = useCommitments()
  const assignmentsApi = useAssignments()
  const { identityFor } = useCourses()
  const { settings, update: updateSettings } = useSettings()
  const { wins, refresh: refreshWins } = useWins(now)

  const [stack, setStack] = useState<Detail[]>([])
  const [source, setSource] = useState<HTMLElement | null>(null)

  const push = useCallback((detail: Detail, from: HTMLElement) => {
    // Only the bottom of the stack owns the morph origin, so closing always animates
    // back to the card that started it.
    setStack((prev) => {
      if (prev.length === 0) setSource(from)
      return [...prev, detail]
    })
  }, [])

  const pop = useCallback(() => setStack((prev) => prev.slice(0, -1)), [])
  const closeAll = useCallback(() => setStack([]), [])

  const openCommitment = useCallback(
    (c: Commitment, from: HTMLElement) => push({ kind: 'commitment', id: c.id }, from),
    [push],
  )
  const openAssignment = useCallback(
    (a: Assignment, from: HTMLElement) => push({ kind: 'assignment', id: a.id }, from),
    [push],
  )

  const staleDeadlineDays = settings?.stale_deadline_days ?? DEFAULT_STALE_DEADLINE_DAYS
  const top = stack[stack.length - 1] ?? null

  const openCommitmentObj =
    top?.kind === 'commitment' ? (commitmentsApi.commitments.find((c) => c.id === top.id) ?? null) : null
  const openAssignmentObj =
    top?.kind === 'assignment' ? (assignmentsApi.assignments.find((a) => a.id === top.id) ?? null) : null

  const attention = needsAttention(
    assignmentsApi.assignments,
    commitmentsApi.commitments,
    { stale_deadline_days: staleDeadlineDays },
    now,
  )

  // Zone 5 is titled "next 7 days", so the window is a real filter, not decoration.
  const windowEnd = shiftYmd(denverYmd(now), DEADLINE_WINDOW_DAYS)
  const deadlinesInWindow = assignmentsApi.assignments.filter((a) => denverYmd(new Date(a.due_at)) <= windowEnd)

  function openDeadlines(from: HTMLElement) {
    push({ kind: 'deadlines' }, from)
  }
  function panelKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openDeadlines(e.currentTarget)
    }
  }

  const ariaLabel =
    top?.kind === 'deadlines'
      ? 'Deadlines'
      : top?.kind === 'wins'
        ? 'Wins this semester'
        : (openCommitmentObj?.name ?? openAssignmentObj?.title ?? 'Detail')

  return (
    <div>
      <TopBar
        syncStatus={syncLabel(assignmentsApi.lastSyncedAt, assignmentsApi.syncFailed, now)}
        syncFailed={assignmentsApi.syncFailed}
      />
      <div className="max-w-[720px] mx-auto px-5 py-8 flex flex-col gap-5">
        <StatusBar assignments={assignmentsApi.assignments} now={now} identityFor={identityFor} />

        <HeroStrip wins={wins} onOpenWins={(from) => push({ kind: 'wins' }, from)} />

        <LeftOffCard
          now={now}
          note={settings?.left_off_note ?? null}
          notedAt={settings?.left_off_at ?? null}
          onSave={updateSettings}
        />

        <section className="panel" aria-labelledby="na-title">
          <div className="panel-head">
            <h2 className="panel-title" id="na-title">
              Needs attention
            </h2>
          </div>
          <NeedsAttentionList
            items={attention}
            now={now}
            staleDeadlineDays={staleDeadlineDays}
            identityFor={identityFor}
            onOpenCommitment={openCommitment}
            onOpenAssignment={openAssignment}
          />
        </section>

        {/* The panel opens the window view; an individual row opens that assignment.
            The row handler stops propagation so the two never fire together. */}
        <section
          className="panel panel-clickable"
          role="button"
          tabIndex={0}
          aria-label="Deadlines, next 7 days. Open the window view."
          onClick={(e) => openDeadlines(e.currentTarget)}
          onKeyDown={panelKeyDown}
        >
          <div className="panel-head">
            <h2 className="panel-title">Deadlines</h2>
            <span className="panel-hint">next 7 days</span>
          </div>
          <DeadlineList
            assignments={deadlinesInWindow}
            now={now}
            identityFor={identityFor}
            onOpen={openAssignment}
          />
        </section>

        <section className="panel" aria-labelledby="cm-title">
          <div className="panel-head">
            <h2 className="panel-title" id="cm-title">
              Commitments
            </h2>
          </div>
          <CommitmentCards
            commitments={commitmentsApi.commitments}
            subtasks={commitmentsApi.subtasks}
            now={now}
            onOpen={openCommitment}
            onCreate={commitmentsApi.create}
          />
        </section>

        <GymStrip now={now} gymDays={settings?.gym_days ?? []} />

        <StalledLine commitments={commitmentsApi.commitments} now={now} onOpen={openCommitment} />
      </div>

      <ExpandedPanel
        isOpen={stack.length > 0}
        onClose={pop}
        onCloseAll={closeAll}
        sourceEl={source}
        depth={stack.length}
        ariaLabel={ariaLabel}
      >
        {top?.kind === 'deadlines' && (
          <DeadlinesExpanded
            assignments={assignmentsApi.assignments}
            now={now}
            identityFor={identityFor}
            onOpenAssignment={openAssignment}
          />
        )}
        {top?.kind === 'wins' && <WinsExpanded wins={wins} />}
        {openCommitmentObj && (
          <CommitmentExpanded
            commitment={openCommitmentObj}
            now={now}
            onLogProgress={commitmentsApi.logProgress}
            onMarkStalled={commitmentsApi.markStalled}
            onResume={commitmentsApi.resume}
            onArchive={commitmentsApi.archive}
            onUpdate={commitmentsApi.update}
            onChanged={() => {
              commitmentsApi.refresh()
              refreshWins()
            }}
            onClose={pop}
          />
        )}
        {openAssignmentObj && (
          <AssignmentExpanded
            assignment={openAssignmentObj}
            now={now}
            identity={identityFor(openAssignmentObj.course)}
            onLogProgress={assignmentsApi.logProgress}
            onMarkDone={async (id) => {
              const result = await assignmentsApi.markDone(id)
              refreshWins()
              return result
            }}
            onDismiss={assignmentsApi.dismiss}
            onReopen={assignmentsApi.reopen}
            onClose={pop}
          />
        )}
      </ExpandedPanel>
    </div>
  )
}
