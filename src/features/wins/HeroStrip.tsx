import { useRef, type KeyboardEvent } from 'react'
import { FlapBoard, type FlapHandle } from '@/components/FlapBoard'
import type { SemesterWins } from '@/types/domain'

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

/**
 * The hero dial strip (design.md §hero) — the sanctioned exception to the no-stat-tiles
 * rule, and the app's one "here's your progress" moment.
 *
 * **In the MVP the strip is one panel, not two.** The cumulative study dial belongs to
 * Phase 5 and ships with `courses` + `study_sessions`; until then the win counter spans
 * the row. It is deliberately never an empty placeholder — a panel saying "study data
 * coming soon" would be worse than no panel.
 */
export function HeroStrip({ wins, onOpenWins }: { wins: SemesterWins; onOpenWins: (source: HTMLElement) => void }) {
  const flapRef = useRef<FlapHandle>(null)

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpenWins(e.currentTarget)
    }
  }

  return (
    <div className="hero hero-solo">
      <div
        className="hero-panel"
        role="button"
        tabIndex={0}
        aria-label="Wins this semester. Open the wins board."
        onClick={(e) => onOpenWins(e.currentTarget)}
        onKeyDown={handleKeyDown}
      >
        <div className="hero-cap">
          <span>Done this semester</span>
          <span className="chev" aria-hidden="true">
            ›
          </span>
        </div>
        <div className="hero-flip">
          <FlapBoard ref={flapRef} target={wins.total} />
          <button
            type="button"
            className="hero-replay"
            onClick={(e) => {
              // Without this the replay would also open the Wins panel.
              e.stopPropagation()
              flapRef.current?.roll()
            }}
          >
            <PlayIcon />
            Replay
          </button>
        </div>
      </div>
    </div>
  )
}
