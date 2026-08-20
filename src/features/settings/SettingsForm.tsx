import { useEffect, useState, type FormEvent } from 'react'
import { useGym } from '@/features/gym/useGym'
import { useSettings } from './useSettings'

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/**
 * The Canvas feed field is **write-only** (implementation-plan.md 2.4): the stored URL is
 * never sent to the browser, so this shows only whether one is set. Typing a new one
 * overwrites; leaving it blank changes nothing.
 */
export function SettingsForm() {
  const { settings, loading, update, syncNow } = useSettings()
  const gym = useGym(new Date())

  const [notifyEmail, setNotifyEmail] = useState('')
  const [digestHour, setDigestHour] = useState(7)
  const [staleDays, setStaleDays] = useState(4)
  const [feedUrl, setFeedUrl] = useState('')
  const [saved, setSaved] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (!settings) return
    setNotifyEmail(settings.notify_email ?? '')
    setDigestHour(settings.digest_hour_local)
    setStaleDays(settings.stale_deadline_days)
  }, [settings])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedUrl = feedUrl.trim()
    await update({
      notify_email: notifyEmail.trim() || null,
      digest_hour_local: digestHour,
      stale_deadline_days: staleDays,
      // Only send the URL when one was actually typed, so saving other fields can
      // never blank out a feed that is already configured.
      ...(trimmedUrl ? { canvas_ics_url: trimmedUrl } : {}),
    })
    setFeedUrl('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  /**
   * Dropping a target day also clears any check recorded for it this week (design.md
   * §gym) — otherwise a green tick would sit on a day that is no longer a target, which
   * reads as a bug.
   */
  async function toggleGymDay(index: number) {
    const current = settings?.gym_days ?? []
    const isTarget = current.includes(index)
    const next = isTarget ? current.filter((d) => d !== index) : [...current, index].sort((a, b) => a - b)
    await update({ gym_days: next })
    if (isTarget && gym.done.has(gym.week[index])) await gym.toggle(gym.week[index])
  }

  async function handleSyncNow() {
    setSyncing(true)
    setSyncMessage(await syncNow())
    setSyncing(false)
  }

  if (loading) return null

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <div className="panel-head">
        <h2 className="panel-title">Settings</h2>
      </div>

      <div className="xsection">
        <label className="xlabel" htmlFor="notify-email">
          Notify email
        </label>
        <div className="addrow">
          <input
            id="notify-email"
            type="email"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div className="xsection">
        <div className="xlabel">Digest hour &amp; stale threshold</div>
        <div className="study-meta">
          <label className="study-goal">
            send at
            <input
              type="number"
              min={0}
              max={23}
              className="goal-input"
              value={digestHour}
              onChange={(e) => setDigestHour(Number(e.target.value))}
              aria-label="Digest hour, 0 to 23"
            />
            :00
          </label>
          <label className="study-goal">
            stale after
            <input
              type="number"
              min={1}
              className="goal-input"
              value={staleDays}
              onChange={(e) => setStaleDays(Number(e.target.value))}
              aria-label="Stale threshold in days"
            />
            days
          </label>
        </div>
      </div>

      <div className="xsection">
        <div className="xlabel">Gym days</div>
        <div className="gym-week" style={{ marginLeft: 0 }}>
          {DAY_LABELS.map((label, index) => {
            const isTarget = (settings?.gym_days ?? []).includes(index)
            return (
              <button
                key={label}
                type="button"
                className={`pip${isTarget ? '' : ' pip-off'}`}
                aria-pressed={isTarget}
                aria-label={`${label} ${isTarget ? 'is' : 'is not'} a gym day`}
                onClick={() => toggleGymDay(index)}
              >
                <span className="pip-day">{label}</span>
              </button>
            )
          })}
        </div>
        <p className="panel-hint" style={{ marginTop: 8 }}>
          Pick none to switch the habit off entirely — the strip disappears from the dashboard.
        </p>
      </div>

      <div className="xsection">
        {/* The status sits outside .xlabel, which uppercases everything inside it —
            "CANVAS FEED NOT SET" reads as one shouted phrase instead of a label
            plus its state. */}
        <div className="feed-label">
          <label className="xlabel" htmlFor="feed-url" style={{ marginBottom: 0 }}>
            Canvas feed
          </label>
          <span
            className="feed-state"
            style={{ color: settings?.canvas_ics_url_set ? 'var(--status-green)' : 'var(--text-secondary)' }}
          >
            {settings?.canvas_ics_url_set ? 'set ✓' : 'not set'}
          </span>
        </div>
        <div className="addrow">
          <input
            id="feed-url"
            type="url"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            placeholder={settings?.canvas_ics_url_set ? 'Paste a new URL to replace it' : 'https://…/feeds/calendars/….ics'}
          />
        </div>
        <p className="panel-hint" style={{ marginTop: 8 }}>
          Canvas → Calendar → Calendar Feed. Treat it like a password: anyone holding it can read
          your whole Canvas calendar. It is stored server-side and never shown here again.
        </p>
      </div>

      <div className="actions">
        <button type="submit" className="btn btn-hero">
          Save
        </button>
        <button type="button" className="btn" onClick={handleSyncNow} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
        <span className="panel-hint">{saved ? 'Saved' : (syncMessage ?? '')}</span>
      </div>
    </form>
  )
}
