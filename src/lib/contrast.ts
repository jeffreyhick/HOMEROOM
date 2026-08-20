/**
 * WCAG 2.1 relative luminance and contrast ratio.
 *
 * Exists so the design tokens can be *checked* rather than eyeballed — neumorphism runs
 * everything at low contrast by nature, which is exactly the condition under which a
 * palette drifts below legibility without anyone noticing.
 */
export function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value
  const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [light, dark] = la > lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

/**
 * Every custom-property declaration in a stylesheet, last value winning — which is what
 * the cascade would do anyway.
 *
 * Scans declarations rather than locating a `:root { … }` block on purpose: Tailwind v4
 * rewrites the selector to `:root, :host`, and a regex anchored on the block silently
 * returns nothing when that happens. Reading declarations survives whatever the build
 * does to the selector.
 */
export function readCssTokens(css: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  const declaration = /(--[\w-]+)\s*:\s*([^;{}]+)[;}]/g
  let match: RegExpExecArray | null
  while ((match = declaration.exec(css)) !== null) {
    tokens[match[1]] = match[2].trim()
  }
  return tokens
}
