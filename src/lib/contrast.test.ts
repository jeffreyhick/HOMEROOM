import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastRatio, readCssTokens, relativeLuminance } from './contrast'

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5)
    // The classic "smallest grey that passes AA on white".
    expect(contrastRatio('#767676', '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#777777', '#FFFFFF')).toBeLessThan(4.5)
  })

  it('is order-independent and handles shorthand hex', () => {
    expect(contrastRatio('#1D2530', '#EDF0F4')).toBeCloseTo(contrastRatio('#EDF0F4', '#1D2530'), 10)
    expect(relativeLuminance('#fff')).toBeCloseTo(relativeLuminance('#FFFFFF'), 10)
  })
})

/**
 * The real audit, run against the shipped stylesheet rather than a copy of the palette —
 * a test that duplicated the hex values could pass while the app failed.
 *
 * Neumorphism is low-contrast by nature, which is exactly the condition under which a
 * palette drifts below legibility without anyone noticing. Hence: measured, not eyeballed.
 */
describe('design tokens meet WCAG AA on the surface', () => {
  // Read from disk, not via Vite's `?raw`: the Tailwind plugin claims `.css` imports
  // and hands back an empty string under Vitest, which would make every assertion below
  // vacuously true. The length check further down is the guard against that class of bug.
  const tokens = readCssTokens(readFileSync(new URL('../index.css', import.meta.url), 'utf8'))
  const surface = tokens['--surface']

  it('parses the palette out of the shipped stylesheet', () => {
    expect(surface).toBe('#EDF0F4')
    // A regex that silently matched nothing would make every check below vacuous.
    expect(Object.keys(tokens).length).toBeGreaterThan(8)
  })

  // Every one of these is rendered as text somewhere: body copy, meta lines, the
  // interactive accent, and the countdown/status tiers.
  const TEXT_TOKENS = [
    '--text-primary',
    '--text-secondary',
    '--accent',
    '--status-red',
    '--status-amber',
    '--status-green',
  ]

  it.each(TEXT_TOKENS)('%s clears 4.5:1 against the surface', (token) => {
    expect(contrastRatio(tokens[token], surface)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the status tiers distinguishable from each other, not just from the background', () => {
    // Tiering only means something if red, amber, and green do not read as one another.
    const red = relativeLuminance(tokens['--status-red'])
    const amber = relativeLuminance(tokens['--status-amber'])
    const green = relativeLuminance(tokens['--status-green'])
    expect(new Set([red, amber, green]).size).toBe(3)
  })

  it('holds the class-identity palette clear of the status hues', () => {
    // design.md §identity: a teal wave icon must never be misread as "on pace".
    const identity = ['#2C8C7C', '#4257B2', '#B5642E', '#2E6E9E', '#8E4585', '#6B4FA0', '#8A6D3B', '#5B7085']
    const statuses = [tokens['--status-red'], tokens['--status-amber'], tokens['--status-green']]
    for (const color of identity) {
      for (const status of statuses) {
        expect(color.toUpperCase()).not.toBe(status.toUpperCase())
      }
    }
  })
})
