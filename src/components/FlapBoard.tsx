import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { buildFlaps, type FlapBoard as Board } from '@/lib/flaps'

export interface FlapHandle {
  roll: () => void
}

/**
 * The split-flap counter (design.md §hero).
 *
 * It **rolls exactly once, on mount** — the one sanctioned unprompted animation in the
 * whole app, a greeting rather than decoration — and updates silently after that. Replay
 * is the only way to see it again.
 *
 * The mount roll and the value sync are two separate effects on purpose. Rolling from a
 * `[target]` effect would re-roll every time the count changed, which is precisely the
 * "animates on every re-render" failure the design rules out.
 */
export const FlapBoard = forwardRef<FlapHandle, { target: number }>(function FlapBoard({ target }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<Board | null>(null)
  const targetRef = useRef(target)
  const isFirstSync = useRef(true)

  targetRef.current = target

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const board = buildFlaps(container, targetRef.current)
    boardRef.current = board
    board.roll()
    return () => {
      board.stop()
      boardRef.current = null
    }
  }, [])

  useEffect(() => {
    const board = boardRef.current
    const container = containerRef.current
    if (!board || !container) return
    // The mount effect already showed this value; syncing it again would be a no-op at
    // best and would fight the roll at worst.
    if (isFirstSync.current) {
      isFirstSync.current = false
      return
    }
    // A count that grew past the built width (9 → 10) needs more flap units.
    if (String(target).length > board.digits) {
      board.stop()
      const rebuilt = buildFlaps(container, target)
      boardRef.current = rebuilt
      rebuilt.setBoard(target)
      return
    }
    board.setBoard(target)
  }, [target])

  useImperativeHandle(ref, () => ({ roll: () => boardRef.current?.roll() }), [])

  return <div className="flaps" ref={containerRef} role="img" aria-label={`${target} finished this semester`} />
})
