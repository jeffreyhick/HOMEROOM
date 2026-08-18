import { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Assignment, ProgressLog } from '@/types/domain'

type RepoResult<T> = Promise<{ data: T | null; error: PostgrestError | null }>

const DAY_MS = 1000 * 60 * 60 * 24

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

/**
 * Everything still open, plus anything finished recently — the recently-finished rows
 * are what the "m done this week" footer counts. Older finished work ages out of the
 * query rather than being deleted (schema.md sync rule 3).
 */
export async function listAssignments(): RepoResult<Assignment[]> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const cutoff = new Date(Date.now() - 7 * DAY_MS).toISOString()
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('user_id', userId)
    .or(`status.eq.upcoming,and(status.in.(done,dismissed),due_at.gte.${cutoff})`)
    .order('due_at', { ascending: true })
  return { data: data as Assignment[] | null, error }
}

async function setStatus(id: string, status: Assignment['status']): RepoResult<Assignment> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('assignments')
    .update({ status })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  return { data: data as Assignment | null, error }
}

export function markDone(id: string): RepoResult<Assignment> {
  return setStatus(id, 'done')
}

export function dismiss(id: string): RepoResult<Assignment> {
  return setStatus(id, 'dismissed')
}

export function reopen(id: string): RepoResult<Assignment> {
  return setStatus(id, 'upcoming')
}

/** Backs the undo toast: restores the status a manual action changed. */
export function restoreAssignment(id: string, status: Assignment['status']): RepoResult<Assignment> {
  return setStatus(id, status)
}

/** One write path: the log row and the denormalized `last_touched_at` move together. */
export async function logAssignmentProgress(id: string, note?: string): RepoResult<ProgressLog> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }

  const { data, error } = await supabase
    .from('progress_logs')
    .insert({ assignment_id: id, user_id: userId, note: note ?? null })
    .select()
    .single()
  if (error) return { data: null, error }

  const { error: touchError } = await supabase
    .from('assignments')
    .update({ last_touched_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)

  return { data: data as ProgressLog, error: touchError }
}

export async function listAssignmentLogs(id: string): RepoResult<ProgressLog[]> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('progress_logs')
    .select('*')
    .eq('assignment_id', id)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return { data: data as ProgressLog[] | null, error }
}
