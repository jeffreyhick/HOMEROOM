import { TopBar } from '@/components/TopBar'
import { signOut } from '@/lib/auth'

export function SettingsPage() {
  return (
    <div>
      <TopBar />
      <div className="max-w-[720px] mx-auto px-5 py-8">
        <button
          onClick={() => signOut()}
          className="rounded-[14px] px-4 py-2.5 text-[15px] font-medium"
          style={{ boxShadow: 'var(--raised-sm)', color: 'var(--accent)' }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
