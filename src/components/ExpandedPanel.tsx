import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

const MORPH_MS = 220
const SHEET_MS = 200

interface ExpandedPanelProps {
  isOpen: boolean
  /** Pop one level — the ✕ button and Esc. */
  onClose: () => void
  /** Close the whole stack — the backdrop. Falls back to onClose when not given. */
  onCloseAll?: () => void
  sourceEl: HTMLElement | null
  ariaLabel: string
  /** How deep the detail stack is. A change while open cross-fades the inner content. */
  depth?: number
  children: ReactNode
}

function isPhone() {
  return window.matchMedia('(max-width:767px)').matches
}
function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Expand-in-place morph (desktop) / bottom sheet (phone), per design.md §expanded.
// FLIP: render at final position, measure, apply the inverse transform back over the
// source element's box, then transition to identity — never animate width/height directly.
export function ExpandedPanel({
  isOpen,
  onClose,
  onCloseAll,
  sourceEl,
  ariaLabel,
  depth = 1,
  children,
}: ExpandedPanelProps) {
  const [mounted, setMounted] = useState(isOpen)
  const panelRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const closingRef = useRef(false)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const lastDepth = useRef(depth)

  useLayoutEffect(() => {
    if (!isOpen) return
    closingRef.current = false
    returnFocusRef.current = sourceEl
    setMounted(true)
  }, [isOpen, sourceEl])

  useLayoutEffect(() => {
    if (!isOpen || !mounted) return
    const panel = panelRef.current
    if (!panel) return
    document.body.style.overflow = 'hidden'

    if (reducedMotion()) {
      closeRef.current?.focus()
      return
    }

    if (isPhone()) {
      panel.style.transform = 'translateY(100%)'
      requestAnimationFrame(() => {
        panel.style.transition = `transform ${SHEET_MS}ms var(--ease)`
        panel.style.transform = 'translateY(0)'
      })
    } else {
      const target = panel.getBoundingClientRect()
      const source = sourceEl ? sourceEl.getBoundingClientRect() : null
      const inner = innerRef.current
      panel.style.transform = source
        ? `translate(${source.left - target.left}px, ${source.top - target.top}px) scale(${source.width / target.width}, ${source.height / target.height})`
        : 'scale(.97)'
      panel.style.opacity = '.35'
      if (inner) inner.style.opacity = '0'
      requestAnimationFrame(() => {
        panel.style.transition = `transform ${MORPH_MS}ms var(--ease), opacity ${MORPH_MS}ms var(--ease)`
        panel.style.transform = 'none'
        panel.style.opacity = '1'
        if (inner) {
          inner.style.transition = `opacity 160ms var(--ease) 70ms`
          inner.style.opacity = '1'
        }
      })
    }
    const focusTimer = setTimeout(() => closeRef.current?.focus(), 40)
    return () => clearTimeout(focusTimer)
  }, [isOpen, mounted, sourceEl])

  useLayoutEffect(() => {
    if (!mounted || depth === lastDepth.current) return
    lastDepth.current = depth
    const inner = innerRef.current
    if (!inner || reducedMotion()) return
    inner.style.transition = 'none'
    inner.style.opacity = '0'
    requestAnimationFrame(() => {
      inner.style.transition = 'opacity 160ms var(--ease)'
      inner.style.opacity = '1'
    })
  }, [depth, mounted])

  function finish() {
    setMounted(false)
    document.body.style.overflow = ''
    const el = returnFocusRef.current
    if (el && document.body.contains(el)) el.focus()
  }

  function startClose() {
    if (closingRef.current) return
    closingRef.current = true
    const panel = panelRef.current

    if (!panel || reducedMotion()) {
      finish()
      return
    }
    if (isPhone()) {
      panel.style.transition = `transform ${SHEET_MS}ms var(--ease)`
      panel.style.transform = 'translateY(100%)'
    } else {
      const target = panel.getBoundingClientRect()
      const source =
        returnFocusRef.current && document.body.contains(returnFocusRef.current)
          ? returnFocusRef.current.getBoundingClientRect()
          : null
      const inner = innerRef.current
      if (inner) inner.style.opacity = '0'
      panel.style.transition = `transform ${MORPH_MS}ms var(--ease), opacity ${MORPH_MS}ms var(--ease)`
      panel.style.transform = source
        ? `translate(${source.left - target.left}px, ${source.top - target.top}px) scale(${source.width / target.width}, ${source.height / target.height})`
        : 'scale(.96)'
      panel.style.opacity = '0'
    }
    setTimeout(finish, isPhone() ? SHEET_MS : MORPH_MS)
  }

  useEffect(() => {
    // startClose reads live refs; it intentionally only re-runs when isOpen flips.
    if (!isOpen && mounted) startClose()
  }, [isOpen])

  useEffect(() => {
    if (!mounted) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mounted, onClose])

  if (!mounted) return null

  return (
    <>
      <div className="backdrop is-on" onClick={onCloseAll ?? onClose} />
      <div
        className="overlay"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => {
          if (e.target === e.currentTarget) (onCloseAll ?? onClose)()
        }}
      >
        <div className="xpanel" ref={panelRef}>
          <button type="button" className="xclose" aria-label="Close" ref={closeRef} onClick={onClose}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div className="xpanel-inner" ref={innerRef}>
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
