import { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { GymCheckin } from '@/types/domain'

type RepoResult<T> = Promise<{ data: T | null; error: PostgrestError | null }>

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

export async function listCheckins(fromYmd: string, toYmd: string): RepoResult<GymCheckin[]> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('gym_checkins')
    .select('*')
    .eq('user_id', userId)
    .gte('went_on', fromYmd)
    .lte('went_on', toYmd)
    .order('went_on', { ascending: true })
  return { data: data as GymCheckin[] | null, error }
}

/** Idempotent: a double tap cannot create a second row (unique on user + day). */
export async function addCheckin(wentOn: string): RepoResult<GymCheckin> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('gym_checkins')
    .upsert({ user_id: userId, went_on: wentOn }, { onConflict: 'user_id,went_on' })
    .select()
    .single()
  return { data: data as GymCheckin | null, error }
}

export async function removeCheckin(wentOn: string): RepoResult<null> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { error } = await supabase.from('gym_checkins').delete().eq('user_id', userId).eq('went_on', wentOn)
  return { data: null, error }
}
