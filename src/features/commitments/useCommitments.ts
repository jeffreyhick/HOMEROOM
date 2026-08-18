import { useCallback, useEffect, useState } from 'react'
import {
  archive as archiveRepo,
  createCommitment,
  listAllSubtasks,
  listCommitments,
  logProgress as logProgressRepo,
  markDone as markDoneRepo,
  markStalled as markStalledRepo,
  restoreCommitment,
  updateCommitment,
} from './commitments.repo'
import type { Commitment, NewCommitment, Subtask } from '@/types/domain'

const UNDO_WINDOW_MS = 5000

interface State {
  commitments: Commitment[]
  subtasks: Subtask[]
  loading: boolean
  error: string | null
}

export function useCommitments() {
  const [state, setState] = useState<State>({ commitments: [], subtasks: [], loading: true, error: null })

  const refresh = useCallback(async () => {
    const [{ data: commitments, error: commitmentsError }, { data: subtasks, error: subtasksError }] =
      await Promise.all([listCommitments(), listAllSubtasks()])
    setState({
      commitments: commitments ?? [],
      subtasks: subtasks ?? [],
      loading: false,
      error: commitmentsError?.message ?? subtasksError?.message ?? null,
    })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const undoableAction = useCallback(
    async (id: string, action: () => Promise<unknown>) => {
      const previous = state.commitments.find((c) => c.id === id) ?? null
      await action()
      await refresh()

      let expired = false
      const timer = setTimeout(() => {
        expired = true
      }, UNDO_WINDOW_MS)

      const undo = async () => {
        if (expired || !previous) return
        expired = true
        clearTimeout(timer)
        await restoreCommitment(id, {
          status: previous.status,
          stalled_at: previous.stalled_at,
          last_progress_at: previous.last_progress_at,
        })
        await refresh()
      }

      return { undo }
    },
    [state.commitments, refresh],
  )

  const create = useCallback(
    async (input: NewCommitment) => {
      const result = await createCommitment(input)
      await refresh()
      return result
    },
    [refresh],
  )

  const update = useCallback(
    async (
      id: string,
      patch: Partial<Pick<Commitment, 'name' | 'category' | 'cadence_days' | 'importance'>>,
    ) => {
      const result = await updateCommitment(id, patch)
      await refresh()
      return result
    },
    [refresh],
  )

  const logProgress = useCallback(
    (id: string, note?: string) => undoableAction(id, () => logProgressRepo(id, note)),
    [undoableAction],
  )

  const resume = useCallback((id: string) => logProgress(id, 'resumed'), [logProgress])

  const markStalled = useCallback(
    (id: string) => undoableAction(id, () => markStalledRepo(id)),
    [undoableAction],
  )

  const markDone = useCallback(
    (id: string) => undoableAction(id, () => markDoneRepo(id)),
    [undoableAction],
  )

  const archive = useCallback((id: string) => undoableAction(id, () => archiveRepo(id)), [undoableAction])

  return {
    ...state,
    refresh,
    create,
    update,
    logProgress,
    markStalled,
    resume,
    archive,
    markDone,
    undoableAction,
  }
}
