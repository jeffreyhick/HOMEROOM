import { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { semesterStartIso, semesterStartYmd } from '@/lib/semester'
import type { SemesterWins } from '@/types/domain'

type RepoResult<T> = Promise<{ data: T | null; error: PostgrestError | null }>

const NO_SESSION_ERROR = new PostgrestError({
  message: 'Not signed in',
  details: '',
  hint: 'Sign in before calling a repository function.',
  code: 'PGRST301',
})

/**
 * The split-flap counter's number (schema.md "semester wins count"): finished
 * assignments + checked subtasks + gym days this term.
 *
 * **Derived, never stored.** Every celebration in the app already writes one of these
 * three rows, so the number and the confetti can never disagree. Counted with
 * `head: true` so three counts cost three HEADs, not three row sets.
 */
export async function getSemesterWins(now: Date): RepoResult<SemesterWins> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: NO_SESSION_ERROR }

  const since = semesterStartIso(now)
  const sinceDate = semesterStartYmd(now)

  const [assignments, subtasks, gym] = await Promise.all([
    supabase
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'done')
      .gte('due_at', since),
    supabase
      .from('subtasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('done', true)
      .gte('done_at', since),
    supabase
      .from('gym_checkins')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('went_on', sinceDate),
  ])

  const error = assignments.error ?? subtasks.error ?? gym.error
  if (error) return { data: null, error }

  const counts = {
    assignments: assignments.count ?? 0,
    subtasks: subtasks.count ?? 0,
    gym: gym.count ?? 0,
  }
  return { data: { ...counts, total: counts.assignments + counts.subtasks + counts.gym }, error: null }
}
