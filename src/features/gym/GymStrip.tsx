import { ClassTag } from '@/components/ClassTag'
import { useToast } from '@/components/UndoToast'
import { burstFromRect } from '@/lib/celebrate'
import { denverYmd } from '@/lib/format'
import { useGym } from './useGym'

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12l5 5L20 6" />
    </svg>
  )
}
function RingMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
      <circle cx="12" cy="12" r="7" />
    </svg>
  )
}
function MissedMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  )
}

/**
 * The one habit (design.md §gym), and the one dashboard element that carries a direct
 * action rather than opening a detail view. That exception is justified: a habit check
 * has to be a single tap or it will not happen. It is **not** a precedent for putting
 * buttons in list rows.
 */
export function GymStrip({ now, gymDays }: { now: Date; gymDays: number[] }) {
  const { week, done, toggle } = useGym(now)
  const { showToast } = useToast()

  // Empty target list means the habit is switched off entirely — render nothing rather
  // than an empty strip nagging about a habit that was never opted into.
  if (gymDays.length === 0) return null

  const today = denverYmd(now)
  const targets = new Set(gymDays)
  const targetCount = gymDays.length
  const doneCount = week.filter((ymd, i) => targets.has(i) && done.has(ymd)).length

  async function handleToggle(ymd: string, element: HTMLElement) {
    // Capture the rect before the refresh repaints this pip out from under us.
    const rect = element.getBoundingClientRect()
    const { wasDone, undo } = await toggle(ymd)
    if (!wasDone) burstFromRect(rect)
    showToast(wasDone ? 'Gym check-in removed' : 'Gym day logged', undo)
  }

  return (
    <div className="gym">
      <div className="gym-head">
        <ClassTag color="#2C8C7C" icon="dumbbell" size="sm" />
        <div>
          <div className="gym-title">Gym</div>
          <div className="gym-sub">
            {doneCount} of {targetCount} this week
          </div>
        </div>
      </div>

      <div className="gym-week">
        {week.map((ymd, index) => {
          const isTarget = targets.has(index)
          const isDone = done.has(ymd)
          const isToday = ymd === today
          const isMissed = isTarget && !isDone && ymd < today
          // A rest day is inert, not just unstyled — nothing to tap, nothing to feel bad about.
          const isInert = !isTarget && !isDone

          const classes = ['pip']
          if (isInert) classes.push('pip-off')
          if (isDone) classes.push('pip-done')
          if (isToday && !isDone) classes.push('pip-today')
          if (isMissed) classes.push('pip-missed')

          return (
            <button
              key={ymd}
              type="button"
              className={classes.join(' ')}
              disabled={isInert}
              aria-pressed={isDone}
              aria-label={`${DAY_LABELS[index]} ${isDone ? 'went to the gym' : 'not logged'}`}
              onClick={(e) => handleToggle(ymd, e.currentTarget)}
            >
              <span className="pip-day">{DAY_LABELS[index]}</span>
              <span className="pip-mark">
                {isDone ? <CheckMark /> : isMissed ? <MissedMark /> : <RingMark />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
