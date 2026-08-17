import { useState, type FormEvent } from 'react'
import { signInWithEmail } from '@/lib/auth'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await signInWithEmail(email)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-[20px] p-8" style={{ boxShadow: 'var(--raised)' }}>
        <p
          className="text-[17px] font-medium tracking-tight text-center mb-6"
          style={{ color: 'var(--text-primary)' }}
        >
          homeroom
        </p>

        {sent ? (
          <p className="text-center text-[15px]" style={{ color: 'var(--text-secondary)' }}>
            Check your email for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-[14px] px-4 py-3 text-[15px] outline-none"
              style={{ boxShadow: 'var(--inset)', color: 'var(--text-primary)' }}
            />
            <button
              type="submit"
              className="w-full rounded-[14px] px-4 py-3 text-[15px] font-medium text-center"
              style={{ boxShadow: 'var(--raised-sm)', color: 'var(--accent)' }}
            >
              Send link
            </button>
            {error && (
              <p className="text-[13px] text-center" style={{ color: 'var(--status-red)' }}>
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
