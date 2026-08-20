import { ICONS } from '@/components/icons'

// design.md §celebration — green, accent, amber, plum, teal.
const CELEBRATE_COLORS = ['#3E9B6B', '#3D5A80', '#E09A2F', '#6B4FA0', '#2C8C7C']

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * A small burst of sparks at a point on screen. Imperative on purpose: the host is a
 * `position: fixed` element parked at viewport coordinates and removed when it finishes,
 * so it never participates in layout or survives a re-render.
 *
 * **Capture the source rect before the re-render that follows the click** — by the time
 * React has repainted, the node you measured is gone.
 */
export function burstAt(x: number, y: number, big = false): void {
  if (prefersReducedMotion()) return

  const host = document.createElement('div')
  host.className = 'burst'
  host.style.left = `${x}px`
  host.style.top = `${y}px`

  const count = big ? 22 : 12
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('span')
    spark.className = 'spark'
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
    const distance = (big ? 70 : 42) + Math.random() * (big ? 46 : 24)
    spark.style.setProperty('--dx', `${Math.cos(angle) * distance}px`)
    spark.style.setProperty('--dy', `${Math.sin(angle) * distance}px`)
    spark.style.setProperty('--rot', `${Math.floor(Math.random() * 360)}deg`)
    spark.style.background = CELEBRATE_COLORS[i % CELEBRATE_COLORS.length]
    spark.style.animationDelay = `${Math.random() * 40}ms`
    host.appendChild(spark)
  }

  document.body.appendChild(host)
  window.setTimeout(() => host.remove(), 800)
}

/** Convenience for the common case: burst from the centre of an element's box. */
export function burstFromRect(rect: DOMRect, big = false): void {
  burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, big)
}

/**
 * The 100% payoff: a green ring pulses around the whole expanded panel and a trophy
 * banner drops in. Reserved for finishing a *whole* small project — if this fired for
 * every subtask it would stop meaning anything.
 *
 * Under reduced motion the banner still appears (it is information), but the ring and
 * the burst do not.
 */
export function finaleOnPanel(panel: HTMLElement, message: string): void {
  if (!prefersReducedMotion()) {
    const ring = document.createElement('div')
    ring.className = 'finale'
    panel.appendChild(ring)
    window.setTimeout(() => ring.remove(), 950)

    const rect = panel.getBoundingClientRect()
    burstAt(rect.left + rect.width / 2, rect.top + Math.min(120, rect.height / 3), true)
  }

  const banner = document.createElement('div')
  banner.className = 'finale-banner'
  banner.innerHTML =
    `<span class="tag tag-sm" style="--tag-color:#3E9B6B;color:#3E9B6B">` +
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.trophy}</svg></span>`
  banner.appendChild(document.createTextNode(message))
  panel.appendChild(banner)
  window.setTimeout(() => banner.remove(), 1600)
}
