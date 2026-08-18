import { useMemo, useRef, useState } from 'react'
import { TopBar } from '@/components/TopBar'
import { LeftOffCard } from '@/components/LeftOffCard'
import { ExpandedPanel } from '@/components/ExpandedPanel'
import { StatusBar } from '@/components/StatusBar'
import { NeedsAttentionList } from '@/features/attention/NeedsAttentionList'
import { AssignmentExpanded } from '@/features/assignments/AssignmentExpanded'
import { DeadlineList } from '@/features/assignments/DeadlineList'
import { useAssignments } from '@/features/assignments/useAssignments'
import { CommitmentCards } from '@/features/commitments/CommitmentCards'
import { CommitmentExpanded } from '@/features/commitments/CommitmentExpanded'
import { StalledLine } from '@/features/commitments/StalledLine'
import { useCommitments } from '@/features/commitments/useCommitments'
import { useCourses } from '@/features/courses/useCourses'
import { useSettings } from '@/features/settings/useSettings'
import { needsAttention } from '@/lib/attention'
import { denverYmd, shiftYmd } from '@/lib/format'
import type { Assignment, Commitment } from '@/types/domain'

const DEFAULT_STALE_DEADLINE_DAYS = 4
const DEADLINE_WINDOW_DAYS = 7

/** One detail view open at a time. Phase 4's Deadlines window view adds a real stack
 *  (design.md §expanded, "detail on top of detail"); until then a single slot is honest. */
type OpenDetail = { kind: 'commitment'; id: string } | { kind: 'assignment'; id: string } | null

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

  const [open, setOpen] = useState<OpenDetail>(null)
  const sourceRef = useRef<HTMLElement | null>(null)

  function openCommitment(commitment: Commitment, source: HTMLElement) {
    sourceRef.current = source
    setOpen({ kind: 'commitment', id: commitment.id })
  }
  function openAssignment(assignment: Assignment, source: HTMLElement) {
    sourceRef.current = source
    setOpen({ kind: 'assignment', id: assignment.id })
  }
  function closeDetail() {
    setOpen(null)
  }

  const staleDeadlineDays = settings?.stale_deadline_days ?? DEFAULT_STALE_DEADLINE_DAYS

  const openCommitmentObj =
    open?.kind === 'commitment' ? (commitmentsApi.commitments.find((c) => c.id === open.id) ?? null) : null
  const openAssignmentObj =
    open?.kind === 'assignment' ? (assignmentsApi.assignments.find((a) => a.id === open.id) ?? null) : null

  const attention = needsAttention(
    assignmentsApi.assignments,
    commitmentsApi.commitments,
    { stale_deadline_days: staleDeadlineDays },
    now,
  )

  // Zone 5 is titled "next 7 days", so the window is a real filter, not decoration.
  const windowEnd = shiftYmd(denverYmd(now), DEADLINE_WINDOW_DAYS)
  const deadlinesInWindow = assignmentsApi.assignments.filter((a) => denverYmd(new Date(a.due_at)) <= windowEnd)

  return (
    <div>
      <TopBar
        syncStatus={syncLabel(assignmentsApi.lastSyncedAt, assignmentsApi.syncFailed, now)}
        syncFailed={assignmentsApi.syncFailed}
      />
      <div className="max-w-[720px] mx-auto px-5 py-8 flex flex-col gap-5">
        <StatusBar assignments={assignmentsApi.assignments} now={now} identityFor={identityFor} />

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

        <section className="panel" aria-labelledby="dl-title">
          <div className="panel-head">
            <h2 className="panel-title" id="dl-title">
              Deadlines
            </h2>
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

        <StalledLine commitments={commitmentsApi.commitments} now={now} onOpen={openCommitment} />
      </div>

      <ExpandedPanel
        isOpen={open !== null}
        onClose={closeDetail}
        sourceEl={sourceRef.current}
        ariaLabel={openCommitmentObj?.name ?? openAssignmentObj?.title ?? 'Detail'}
      >
        {openCommitmentObj && (
          <CommitmentExpanded
            commitment={openCommitmentObj}
            now={now}
            onLogProgress={commitmentsApi.logProgress}
            onMarkStalled={commitmentsApi.markStalled}
            onResume={commitmentsApi.resume}
            onArchive={commitmentsApi.archive}
            onUpdate={commitmentsApi.update}
            onChanged={commitmentsApi.refresh}
            onClose={closeDetail}
          />
        )}
        {openAssignmentObj && (
          <AssignmentExpanded
            assignment={openAssignmentObj}
            now={now}
            identity={identityFor(openAssignmentObj.course)}
            onLogProgress={assignmentsApi.logProgress}
            onMarkDone={assignmentsApi.markDone}
            onDismiss={assignmentsApi.dismiss}
            onReopen={assignmentsApi.reopen}
            onClose={closeDetail}
          />
        )}
      </ExpandedPanel>
    </div>
  )
}
