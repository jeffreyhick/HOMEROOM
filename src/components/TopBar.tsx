import { Link } from 'react-router-dom'

export function TopBar({ syncStatus, syncFailed = false }: { syncStatus?: string; syncFailed?: boolean }) {
  return (
    <div className="h-14 flex items-center justify-between gap-4 max-w-[720px] mx-auto px-5">
      <Link to="/" className="text-[17px] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
        homeroom
      </Link>
      <div className="flex items-center gap-3.5">
        {syncStatus && (
          <span
            className="text-[13px]"
            style={{ color: syncFailed ? 'var(--status-amber)' : 'var(--text-secondary)' }}
          >
            {syncStatus}
          </span>
        )}
        <Link
          to="/settings"
          aria-label="Settings"
          className="w-9 h-9 rounded-full grid place-items-center transition-shadow"
          style={{ boxShadow: 'var(--raised-sm)', color: 'var(--text-secondary)' }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
