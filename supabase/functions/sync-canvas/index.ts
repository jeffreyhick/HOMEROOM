// sync-canvas — pulls Canvas deadlines from the personal calendar feed (ICS) and
// upserts them into `assignments`. Runs hourly from pg_cron and on demand from the
// Settings page.
//
// Why ICS and not the Canvas API: CU Boulder disables self-issued Canvas access
// tokens. The calendar feed is a per-user, read-only URL that needs no token.
//
// The feed URL is a capability secret — it grants read access to the whole Canvas
// calendar — so it never leaves the server. The browser only ever invokes this
// function; it never talks to Canvas.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { looksLikeExam, parseIcs } from './ics.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// design.md §identity — class colours deliberately avoid the status hues, so a course
// glyph can never be misread as "on pace" / "behind".
const PALETTE = ['#4257B2', '#B5642E', '#2C8C7C', '#2E6E9E', '#8E4585', '#6B4FA0', '#8A6D3B', '#5B7085']
const ICON_CYCLE = ['zap', 'triangle', 'flame', 'wave', 'satellite', 'code', 'flask', 'book']

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/** Constant-time compare so a wrong cron secret can't be recovered byte by byte. */
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const cronSecret = Deno.env.get('CRON_SECRET')

  // --- Auth gate, before anything else touches data ---
  const headerSecret = req.headers.get('x-cron-secret')
  const viaCron = Boolean(cronSecret && headerSecret && secretsMatch(headerSecret, cronSecret))

  let callerId: string | null = null
  if (!viaCron) {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
    const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data, error } = await anon.auth.getUser(authHeader.slice(7))
    if (error || !data.user) return json({ error: 'unauthorized' }, 401)
    callerId = data.user.id
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: settings, error: settingsError } = await admin
    .from('settings')
    .select('user_id, canvas_ics_url')
    .limit(1)
    .maybeSingle()

  if (settingsError) return json({ error: settingsError.message }, 500)
  if (!settings) return json({ skipped: 'no settings row' })

  // A signed-in caller must be *the* user; any other valid JWT is not enough.
  if (!viaCron && callerId !== settings.user_id) return json({ error: 'unauthorized' }, 401)

  if (!settings.canvas_ics_url) return json({ skipped: 'no url' })

  // --- Fetch the feed. A failed fetch must never modify stored data. ---
  let icsText: string
  try {
    const res = await fetch(settings.canvas_ics_url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return json({ error: `canvas responded ${res.status}` }, 502)
    icsText = await res.text()
  } catch (err) {
    return json({ error: `canvas fetch failed: ${(err as Error).message}` }, 502)
  }

  const events = parseIcs(icsText)
  const nowIso = new Date().toISOString()
  const userId = settings.user_id as string

  if (events.length === 0) return json({ synced: 0, at: nowIso })

  const uids = events.map((e) => e.canvas_uid)

  // Which of these have we seen before? Only brand-new rows may have is_exam guessed.
  const { data: existing, error: existingError } = await admin
    .from('assignments')
    .select('canvas_uid')
    .eq('user_id', userId)
    .in('canvas_uid', uids)
  if (existingError) return json({ error: existingError.message }, 500)
  const known = new Set((existing ?? []).map((r) => r.canvas_uid as string))

  // The payload carries only the columns sync owns. Because `status`, `is_exam`,
  // `last_touched_at`, and `first_seen_at` are absent from it, PostgREST's
  // ON CONFLICT DO UPDATE leaves them alone — manual state survives re-sync
  // (schema.md sync rule 2). Nothing is ever deleted here (rule 3).
  const { error: upsertError } = await admin.from('assignments').upsert(
    events.map((e) => ({
      canvas_uid: e.canvas_uid,
      user_id: userId,
      course: e.course,
      title: e.title,
      due_at: e.due_at,
      last_synced_at: nowIso,
    })),
    { onConflict: 'canvas_uid' },
  )
  if (upsertError) return json({ error: upsertError.message }, 500)

  // Flag exams on first sight only, so a hand-set flag is never clobbered.
  const newExamUids = events
    .filter((e) => !known.has(e.canvas_uid) && looksLikeExam(e.title))
    .map((e) => e.canvas_uid)
  if (newExamUids.length > 0) {
    await admin.from('assignments').update({ is_exam: true }).eq('user_id', userId).in('canvas_uid', newExamUids)
  }

  // A course row per code, so assignments are scannable the moment they arrive.
  const codes = [...new Set(events.map((e) => e.course))]
  const { data: knownCourses } = await admin.from('courses').select('code').eq('user_id', userId)
  const haveCodes = new Set((knownCourses ?? []).map((c) => c.code as string))
  const missing = codes.filter((c) => !haveCodes.has(c))
  if (missing.length > 0) {
    const offset = haveCodes.size
    await admin.from('courses').insert(
      missing.map((code, i) => ({
        user_id: userId,
        code,
        color: PALETTE[(offset + i) % PALETTE.length],
        icon: ICON_CYCLE[(offset + i) % ICON_CYCLE.length],
      })),
    )
  }

  return json({ synced: events.length, at: nowIso })
})
