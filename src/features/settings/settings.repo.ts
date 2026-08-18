import { supabase } from '@/lib/supabase'
import { PostgrestError } from '@supabase/supabase-js'
import type { Settings, SettingsPatch } from '@/types/domain'

type RepoResult<T> = Promise<{ data: T | null; error: PostgrestError | null }>

// Repos are the only Supabase callers, so they are also the only place that can meet a
// missing session. Returning a checked error beats firing `user_id=eq.` with an empty
// string, which Postgres rejects as a malformed uuid.
const NO_SESSION_ERROR = new PostgrestError({
  message: 'Not signed in',
  details: '',
  hint: 'Sign in before calling a repository function.',
  code: 'PGRST301',
})

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// Explicit, and deliberately missing `canvas_ics_url`. Selecting `*` here would ship
// the feed secret to the browser on every dashboard load.
const READABLE_COLUMNS =
  'id, user_id, canvas_ics_url_set, notify_email, digest_hour_local, deadline_alert_hours, ' +
  'stale_deadline_days, gym_days, left_off_note, left_off_at'

export async function getSettings(): RepoResult<Settings> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('settings')
    .select(READABLE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()
  return { data: data as Settings | null, error }
}

export async function upsertSettings(patch: SettingsPatch): RepoResult<Settings> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('settings')
    .upsert({ id: true, user_id: userId, ...patch }, { onConflict: 'id' })
    .select(READABLE_COLUMNS)
    .single()
  return { data: data as Settings | null, error }
}

export interface SyncResult {
  synced?: number
  at?: string
  skipped?: string
  error?: string
}

/**
 * Invoking an Edge Function is a call across the data boundary, so it lives in a repo
 * like any other Supabase call (Rule 2). The browser never talks to Canvas itself —
 * the feed URL stays server-side.
 */
export async function triggerSync(): Promise<{ data: SyncResult | null; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke<SyncResult>('sync-canvas')
  return { data: data ?? null, error: error ?? null }
}
