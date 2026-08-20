import { useRef } from 'react'
import { FlapBoard, type FlapHandle } from '@/components/FlapBoard'
import type { SemesterWins } from '@/types/domain'

/**
 * The Wins screen (design.md §wins). A place you visit to feel good — deliberately never
 * a place with homework on it. The empty panel below the board is reserved, not
 * unfinished: future feel-good dials (how caught up am I, streak rings, a term-progress
 * arc) live there, and naming the room now keeps them out of the dashboard.
 *
 * Same `FlapBoard` as the hero counter, so the two can never disagree.
 */
export function WinsExpanded({ wins }: { wins: SemesterWins }) {
  const flapRef = useRef<FlapHandle>(null)

  return (
    <>
      <div className="xhead">
        <h2 className="xtitle">Done this semester</h2>
      </div>

      <FlapBoard ref={flapRef} target={wins.total} />

      <p className="flap-caption">
        {wins.assignments} assignment{wins.assignments === 1 ? '' : 's'} completed ·{' '}
        {wins.subtasks} step{wins.subtasks === 1 ? '' : 's'} checked off · {wins.gym} gym day
        {wins.gym === 1 ? '' : 's'}
      </p>

      <div className="actions" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn btn-hero" onClick={() => flapRef.current?.roll()}>
          Roll it up
        </button>
      </div>

      <div className="wins-grid">
        <div className="wins-future">More dials will live here — streaks, how caught up you are, term progress.</div>
      </div>
    </>
  )
}
