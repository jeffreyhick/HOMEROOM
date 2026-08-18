import { useRef, useState } from 'react'
import { TopBar } from '@/components/TopBar'
import { LeftOffCard } from '@/components/LeftOffCard'
import { ExpandedPanel } from '@/components/ExpandedPanel'
import { NeedsAttentionList } from '@/features/attention/NeedsAttentionList'
import { CommitmentCards } from '@/features/commitments/CommitmentCards'
import { CommitmentExpanded } from '@/features/commitments/CommitmentExpanded'
import { StalledLine } from '@/features/commitments/StalledLine'
import { useCommitments } from '@/features/commitments/useCommitments'
import { needsAttention } from '@/lib/attention'
import type { Commitment } from '@/types/domain'

// schema.md default; assignments (and the real stale_deadline_days from settings)
// land in Phase 2 — an empty assignments array means this value is currently unused.
const DEFAULT_STALE_DEADLINE_DAYS = 4

export function DashboardPage() {
  const now = new Date()
  const commitmentsApi = useCommitments()
  const [openId, setOpenId] = useState<string | null>(null)
  const sourceRef = useRef<HTMLElement | null>(null)

  function openCommitment(commitment: Commitment, source: HTMLElement) {
    sourceRef.current = source
    setOpenId(commitment.id)
  }
  function closeCommitment() {
    setOpenId(null)
  }

  const openCommitmentObj = commitmentsApi.commitments.find((c) => c.id === openId) ?? null
  const attention = needsAttention(
    [],
    commitmentsApi.commitments,
    { stale_deadline_days: DEFAULT_STALE_DEADLINE_DAYS },
    now,
  )

  return (
    <div>
      <TopBar />
      <div className="max-w-[720px] mx-auto px-5 py-8 flex flex-col gap-5">
        <LeftOffCard now={now} />

        <section className="panel" aria-labelledby="na-title">
          <div className="panel-head">
            <h2 className="panel-title" id="na-title">
              Needs attention
            </h2>
          </div>
          <NeedsAttentionList items={attention} now={now} onOpenCommitment={openCommitment} />
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
        isOpen={openId !== null}
        onClose={closeCommitment}
        sourceEl={sourceRef.current}
        ariaLabel={openCommitmentObj ? openCommitmentObj.name : 'Detail'}
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
            onClose={closeCommitment}
          />
        )}
      </ExpandedPanel>
    </div>
  )
}
