import { countdownParts } from '@/lib/countdown'

/**
 * The bold right-aligned urgency label on every deadline row (design.md §countdown).
 * Because the countdown carries urgency, the class glyph beside it is free to be pure
 * identity — that split is the whole point of the v3 colour system.
 */
export function Countdown({ dueAt, now }: { dueAt: string; now: Date }) {
  const { label, sub, className } = countdownParts(dueAt, now)
  return (
    <span className={className}>
      {label}
      <span className="count-sub">{sub}</span>
    </span>
  )
}
