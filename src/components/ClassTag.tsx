import type { CSSProperties } from 'react'
import { ICONS } from './icons'

interface ClassTagProps {
  color: string
  icon: string
  size?: 'sm' | 'md'
}

export function ClassTag({ color, icon, size = 'md' }: ClassTagProps) {
  const style = { '--tag-color': color } as CSSProperties

  return (
    <span className={`tag${size === 'sm' ? ' tag-sm' : ''}`} style={style} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: ICONS[icon] ?? ICONS.book }}
      />
    </span>
  )
}
