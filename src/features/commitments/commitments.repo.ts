import { supabase } from '@/lib/supabase'
import { PostgrestError } from '@supabase/supabase-js'
import type { Commitment, NewCommitment, ProgressLog, Subtask } from '@/types/domain'

type RepoResult<T> = Promise<{ data: T | null; error: PostgrestError | null }>

// Round-robin identity color for new commitments (design.md §identity); icon keeps the
// column default ('book') until a future UI lets Jeffrey pick one.
const IDENTITY_PALETTE = [
  '#2C8C7C',
  '#4257B2',
  '#B5642E',
  '#2E6E9E',
  '#8E4585',
  '#6B4FA0',
  '#8A6D3B',
  '#5B7085',
]

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

export async function listCommitments(includeArchived = false): RepoResult<Commitment[]> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const query = supabase.from('commitments').select('*').eq('user_id', userId)
  const filtered = includeArchived ? query : query.neq('status', 'archived')
  const { data, error } = await filtered.order('name', { ascending: true })
  return { data: data as Commitment[] | null, error }
}

export async function createCommitment(input: NewCommitment): RepoResult<Commitment> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { count } = await supabase
    .from('commitments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  const color = IDENTITY_PALETTE[(count ?? 0) % IDENTITY_PALETTE.length]

  const { data, error } = await supabase
    .from('commitments')
    .insert({ ...input, user_id: userId, color })
    .select()
    .single()
  return { data: data as Commitment | null, error }
}

export async function updateCommitment(
  id: string,
  patch: Partial<Pick<Commitment, 'name' | 'category' | 'cadence_days' | 'importance'>>,
): RepoResult<Commitment> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('commitments')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  return { data: data as Commitment | null, error }
}

export async function logProgress(commitmentId: string, note?: string): RepoResult<ProgressLog> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('progress_logs')
    .insert({ commitment_id: commitmentId, user_id: userId, note: note ?? null })
    .select()
    .single()
  if (error) return { data: null, error }

  const { error: touchError } = await supabase
    .from('commitments')
    .update({ last_progress_at: nowIso })
    .eq('id', commitmentId)
    .eq('user_id', userId)

  const { error: resumeError } = await supabase
    .from('commitments')
    .update({ status: 'active' })
    .eq('id', commitmentId)
    .eq('user_id', userId)
    .eq('status', 'stalled')

  return { data: data as ProgressLog, error: touchError ?? resumeError ?? null }
}

export async function markStalled(id: string): RepoResult<Commitment> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('commitments')
    .update({ status: 'stalled', stalled_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  return { data: data as Commitment | null, error }
}

export async function archive(id: string): RepoResult<Commitment> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('commitments')
    .update({ status: 'archived' })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  return { data: data as Commitment | null, error }
}

export async function markDone(id: string): RepoResult<Commitment> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('commitments')
    .update({ status: 'done' })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  return { data: data as Commitment | null, error }
}

// The one write path for the undo toast (useCommitments): restores the fields that
// logProgress/markStalled/markDone/archive can change, back to a caller-held snapshot.
export async function restoreCommitment(
  id: string,
  snapshot: Pick<Commitment, 'status' | 'stalled_at' | 'last_progress_at'>,
): RepoResult<Commitment> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('commitments')
    .update(snapshot)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  return { data: data as Commitment | null, error }
}

export async function listAllSubtasks(): RepoResult<Subtask[]> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('subtasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  return { data: data as Subtask[] | null, error }
}

export async function listCommitmentLogs(commitmentId: string): RepoResult<ProgressLog[]> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('progress_logs')
    .select('*')
    .eq('commitment_id', commitmentId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return { data: data as ProgressLog[] | null, error }
}

export async function listLogs(sinceIso: string): RepoResult<ProgressLog[]> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('progress_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true })
  return { data: data as ProgressLog[] | null, error }
}

export async function updateContext(id: string, context: string): RepoResult<Commitment> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('commitments')
    .update({ context })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  return { data: data as Commitment | null, error }
}

export async function listSubtasks(commitmentId: string): RepoResult<Subtask[]> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('subtasks')
    .select('*')
    .eq('commitment_id', commitmentId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  return { data: data as Subtask[] | null, error }
}

export async function addSubtask(commitmentId: string, title: string): RepoResult<Subtask> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('subtasks')
    .insert({ commitment_id: commitmentId, user_id: userId, title })
    .select()
    .single()
  return { data: data as Subtask | null, error }
}

export async function toggleSubtask(id: string): RepoResult<Subtask> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }

  const { data: subtask, error: fetchError } = await supabase
    .from('subtasks')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (fetchError || !subtask) return { data: null, error: fetchError }

  const nowIso = new Date().toISOString()
  const nextDone = !subtask.done

  const { data, error } = await supabase
    .from('subtasks')
    .update({ done: nextDone, done_at: nextDone ? nowIso : null })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) return { data: null, error }

  if (nextDone) {
    await supabase
      .from('progress_logs')
      .insert({ commitment_id: subtask.commitment_id, user_id: userId, note: subtask.title })
    await supabase
      .from('commitments')
      .update({ last_progress_at: nowIso })
      .eq('id', subtask.commitment_id)
      .eq('user_id', userId)
  }

  return { data: data as Subtask, error: null }
}

export async function deleteSubtask(id: string): RepoResult<Subtask> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('subtasks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  return { data: data as Subtask | null, error }
}
