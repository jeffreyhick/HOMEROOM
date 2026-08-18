import { useCallback, useEffect, useState } from 'react'
import {
  addSubtask as addSubtaskRepo,
  deleteSubtask as deleteSubtaskRepo,
  listCommitmentLogs,
  listSubtasks,
  toggleSubtask as toggleSubtaskRepo,
  updateContext as updateContextRepo,
} from './commitments.repo'
import type { ProgressLog, Subtask } from '@/types/domain'

interface State {
  subtasks: Subtask[]
  logs: ProgressLog[]
  loading: boolean
}

// One commitment's subtasks + recent logs, for the expanded view (design.md §expanded).
export function useCommitmentDetail(commitmentId: string | null) {
  const [state, setState] = useState<State>({ subtasks: [], logs: [], loading: true })

  const refresh = useCallback(async () => {
    if (!commitmentId) {
      setState({ subtasks: [], logs: [], loading: false })
      return
    }
    const [{ data: subtasks }, { data: logs }] = await Promise.all([
      listSubtasks(commitmentId),
      listCommitmentLogs(commitmentId),
    ])
    setState({ subtasks: subtasks ?? [], logs: logs ?? [], loading: false })
  }, [commitmentId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addSubtask = useCallback(
    async (title: string) => {
      if (!commitmentId) return
      await addSubtaskRepo(commitmentId, title)
      await refresh()
    },
    [commitmentId, refresh],
  )

  const toggleSubtask = useCallback(
    async (id: string) => {
      await toggleSubtaskRepo(id)
      await refresh()
    },
    [refresh],
  )

  const deleteSubtask = useCallback(
    async (id: string) => {
      await deleteSubtaskRepo(id)
      await refresh()
    },
    [refresh],
  )

  const updateContext = useCallback(
    async (context: string) => {
      if (!commitmentId) return
      await updateContextRepo(commitmentId, context)
    },
    [commitmentId],
  )

  return { ...state, refresh, addSubtask, toggleSubtask, deleteSubtask, updateContext }
}
