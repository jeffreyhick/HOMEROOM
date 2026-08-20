// send-reminders — the half of Homeroom that works when its owner doesn't open it.
// Runs hourly from pg_cron at minute 10 (migration 0006).
//
// Two kinds of mail:
//   * a non-negotiable T-36h alert per deadline, one email each
//   * one daily digest at the configured Denver hour, with everything going stale
//
// **The ordering rule is the whole design.** A dedupe key is inserted *before* the email
// is sent, and a unique-constraint violation means "already handled, skip". That is what
// makes an hourly cron safe: run this function sixty times and each reminder still goes
// out exactly once. If the send itself fails, the dedupe row is deliberately left behind —
// one missed email beats an inbox full of retries.
import { adminClient, authorize, CORS, json } from '../_shared/http.ts'
import {
  type AssignmentRow,
  buildDigest,
  type CommitmentRow,
  denverHuman,
  type StallPing,
  stallPingCandidates,
} from '../_shared/digest.ts'

const DENVER = 'America/Denver'
const HOUR_MS = 1000 * 60 * 60

function denverDate(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DENVER }).format(at)
}

function denverHour(at: Date): number {
  return (
    Number(new Intl.DateTimeFormat('en-US', { timeZone: DENVER, hour: '2-digit', hour12: false }).format(at)) % 24
  )
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const caller = await authorize(req)
  if (!caller) return json({ error: 'unauthorized' }, 401)

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM') ?? 'Homeroom <onboarding@resend.dev>'
  const appUrl = Deno.env.get('APP_URL') ?? ''

  const admin = adminClient()

  const { data: settings, error: settingsError } = await admin
    .from('settings')
    .select('user_id, notify_email, digest_hour_local, deadline_alert_hours, stale_deadline_days')
    .limit(1)
    .maybeSingle()

  if (settingsError) return json({ error: settingsError.message }, 500)
  if (!settings) return json({ skipped: 'no settings row' })
  if (!caller.viaCron && caller.callerId !== settings.user_id) return json({ error: 'unauthorized' }, 401)
  if (!settings.notify_email) return json({ skipped: 'no notify email' })
  if (!resendKey) return json({ skipped: 'no resend key' })

  const userId = settings.user_id as string
  const notifyEmail = settings.notify_email as string
  const now = new Date()
  const today = denverDate(now)

  /**
   * Claim the right to send one specific email. Returns false when it was already sent —
   * the unique index on `dedupe_key` is doing the real work here, so two overlapping runs
   * cannot both win.
   */
  async function claim(kind: string, refId: string | null, dedupeKey: string): Promise<boolean> {
    const { error } = await admin
      .from('reminders_sent')
      .insert({ user_id: userId, kind, ref_id: refId, dedupe_key: dedupeKey })
    if (!error) return true
    if (error.code === '23505') return false // already sent; this is the normal path
    console.error('reminders_sent insert failed', dedupeKey, error.message)
    return false
  }

  async function release(dedupeKey: string): Promise<void> {
    await admin.from('reminders_sent').delete().eq('user_id', userId).eq('dedupe_key', dedupeKey)
  }

  async function sendEmail(subject: string, text: string): Promise<boolean> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: notifyEmail, subject, text }),
    })
    if (!res.ok) {
      // Leave the dedupe row in place on purpose (see the header note).
      console.error('resend failed', res.status, await res.text())
      return false
    }
    return true
  }

  const [{ data: assignmentRows }, { data: commitmentRows }] = await Promise.all([
    admin.from('assignments').select('*').eq('user_id', userId).eq('status', 'upcoming'),
    admin.from('commitments').select('*').eq('user_id', userId).in('status', ['active', 'stalled']),
  ])
  const assignments = (assignmentRows ?? []) as AssignmentRow[]
  const commitments = (commitmentRows ?? []) as CommitmentRow[]

  const alertHours = settings.deadline_alert_hours as number
  const staleDays = settings.stale_deadline_days as number

  // ---------------------------------------------------------------- T-36h alerts
  const horizon = now.getTime() + alertHours * HOUR_MS
  const dueSoon = assignments
    .filter((a) => {
      const due = new Date(a.due_at).getTime()
      return due > now.getTime() && due <= horizon
    })
    .sort((x, y) => new Date(x.due_at).getTime() - new Date(y.due_at).getTime())

  let alertsSent = 0
  for (const a of dueSoon) {
    if (!(await claim('deadline_36h', a.id, `36h:${a.id}`))) continue

    const due = new Date(a.due_at)
    const hoursLeft = Math.round((due.getTime() - now.getTime()) / HOUR_MS)
    const body = [
      a.title,
      a.course + (a.is_exam ? ' · EXAM' : ''),
      `Due ${denverHuman(due)} (Denver)`,
      '',
      appUrl,
    ]
      .filter(Boolean)
      .join('\n')

    if (await sendEmail(`Due in ~${hoursLeft}h: ${a.course} — ${a.title}`, body)) alertsSent++
  }

  // ---------------------------------------------------------------- daily digest
  let digestSent = false
  let stallPingsSent = 0

  if (denverHour(now) === settings.digest_hour_local) {
    const digestKey = `digest:${today}`
    if (await claim('digest', null, digestKey)) {
      // Claim each stall ping first; only the ones we won may appear in the email, so a
      // failed claim (already pinged this week) silently drops out.
      const wonPings: StallPing[] = []
      for (const candidate of stallPingCandidates(commitments, now)) {
        if (await claim('stall_ping', candidate.id, `stall:${candidate.id}:${candidate.weeks}`)) {
          wonPings.push(candidate)
        }
      }

      const digest = buildDigest({
        assignments,
        commitments,
        stallPings: wonPings,
        staleDeadlineDays: staleDays,
        now,
        appUrl,
      })

      if (!digest) {
        // Nothing to say. Give the key back so the ledger records only mail that was
        // actually sent — a row here would otherwise claim a digest went out today.
        await release(digestKey)
      } else if (await sendEmail(digest.subject, digest.body)) {
        digestSent = true
        stallPingsSent = wonPings.length
      }
    }
  }

  return json({ alerts: alertsSent, digest: digestSent, stallPings: stallPingsSent, at: now.toISOString() })
})
