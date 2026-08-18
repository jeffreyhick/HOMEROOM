export type DotStatus = 'red' | 'amber' | 'green' | null

export function StatusDot({ status }: { status: DotStatus }) {
  return <span className={`dot ${status ? `dot-${status}` : 'dot-none'}`} aria-hidden="true" />
}
