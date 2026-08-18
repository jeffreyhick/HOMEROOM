import { supabase } from '@/lib/supabase'
import { PostgrestError } from '@supabase/supabase-js'
import type { Settings } from '@/types/domain'

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

export async function getSettings(): RepoResult<Settings> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase.from('settings').select('*').eq('user_id', userId).maybeSingle()
  return { data: data as Settings | null, error }
}

export async function upsertSettings(patch: Partial<Omit<Settings, 'id' | 'user_id'>>): RepoResult<Settings> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('settings')
    .upsert({ id: true, user_id: userId, ...patch }, { onConflict: 'id' })
    .select()
    .single()
  return { data: data as Settings | null, error }
}
