import { prefersReducedMotion } from './celebrate'

export interface FlapBoard {
  /** How many flap units were built. A target that outgrows them needs a rebuild. */
  digits: number
  /** Set the number with no animation beyond each changed digit's flip. */
  setBoard: (value: number) => void
  /** Ease-out count-up from zero. A roll already in flight is not restarted. */
  roll: (onDone?: () => void) => void
  /** Cancel a roll in flight — call on unmount so a timer never outlives the DOM. */
  stop: () => void
}

/**
 * A split-flap departure board (design.md §hero).
 *
 * Imperative rather than React state on purpose: the roll ticks every ~55ms and each
 * changed digit needs a forced reflow to restart its keyframe, which is exactly the kind
 * of DOM poking that does not belong in a render function.
 *
 * One implementation powers both the hero counter and the Wins board, so the two can
 * never show different numbers.
 */
export function buildFlaps(container: HTMLElement, target: number): FlapBoard {
  container.textContent = ''
  const digits = Math.max(2, String(target).length)
  const cells: HTMLElement[] = []

  for (let i = 0; i < digits; i++) {
    const flap = document.createElement('div')
    flap.className = 'flap'
    const digit = document.createElement('span')
    digit.className = 'flap-digit'
    digit.textContent = '0'
    flap.appendChild(digit)
    container.appendChild(flap)
    cells.push(digit)
  }

  function setBoard(value: number): void {
    const padded = String(value).padStart(digits, '0')
    for (let i = 0; i < digits; i++) {
      if (cells[i].textContent === padded.charAt(i)) continue
      cells[i].textContent = padded.charAt(i)
      const flap = cells[i].parentElement
      if (!flap) continue
      // Remove, force a reflow, re-add — otherwise the keyframe will not replay.
      flap.classList.remove('is-flipping')
      void flap.offsetWidth
      flap.classList.add('is-flipping')
    }
  }

  let timer: number | null = null

  function roll(onDone?: () => void): void {
    if (timer !== null) return
    if (prefersReducedMotion()) {
      setBoard(target)
      onDone?.()
      return
    }

    let current = 0
    const step = () => {
      const remaining = target - current
      // Ease-out: big jumps first, settling into the final number.
      const increment = Math.max(1, Math.round(remaining * 0.14))
      current = Math.min(target, current + increment)
      setBoard(current)
      if (current < target) {
        timer = window.setTimeout(step, 55 + (target - remaining) * 0.4)
      } else {
        timer = null
        onDone?.()
      }
    }
    step()
  }

  function stop(): void {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  return { digits, setBoard, roll, stop }
}
