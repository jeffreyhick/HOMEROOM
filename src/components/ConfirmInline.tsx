import { useEffect, useRef, useState } from 'react'

const ARM_TIMEOUT_MS = 4000

interface ConfirmInlineProps {
  label: string
  confirmLabel: string
  onConfirm: () => void
}

// Destruction confirms inline (the same button relabels + inverts), never a dialog
// on top of a dialog (design.md §drawer-actions). Disarms itself after ~4s.
export function ConfirmInline({ label, confirmLabel, onConfirm }: ConfirmInlineProps) {
  const [armed, setArmed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  function handleClick() {
    if (!armed) {
      setArmed(true)
      timerRef.current = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS)
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    setArmed(false)
    onConfirm()
  }

  return (
    <button type="button" className={`btn btn-danger${armed ? ' is-confirming' : ''}`} onClick={handleClick}>
      {armed ? confirmLabel : label}
    </button>
  )
}
