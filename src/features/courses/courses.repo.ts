import { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Course } from '@/types/domain'

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

/**
 * Class identity (design.md §identity). Rows are created by `sync-canvas` as new course
 * codes appear in the feed, so the app only ever reads them here; colour and icon stay
 * editable data, never a hard-coded course→colour map in a component.
 */
export async function listCourses(): RepoResult<Course[]> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', userId)
    .order('code', { ascending: true })
  return { data: data as Course[] | null, error }
}

export async function updateCourseIdentity(
  id: string,
  patch: Partial<Pick<Course, 'color' | 'icon'>>,
): RepoResult<Course> {
  const userId = await currentUserId()
  if (!userId) return { data: null, error: NO_SESSION_ERROR }
  const { data, error } = await supabase
    .from('courses')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  return { data: data as Course | null, error }
}
