import { useCallback, useEffect, useRef, useState } from 'react'
import {
  dismiss as dismissRepo,
  listAssignments,
  logAssignmentProgress,
  markDone as markDoneRepo,
  reopen as reopenRepo,
  restoreAssignment,
} from './assignments.repo'
import { triggerSync } from '@/features/settings/settings.repo'
import type { Assignment } from '@/types/domain'

interface State {
  assignments: Assignment[]
  loading: boolean
  error: string | null
  /** Newest `last_synced_at` across all rows — what the TopBar reports. */
  lastSyncedAt: string | null
  syncFailed: boolean
}

const EMPTY: State = { assignments: [], loading: true, error: null, lastSyncedAt: null, syncFailed: false }

export function useAssignments() {
  const [state, setState] = useState<State>(EMPTY)
  const syncedOnce = useRef(false)

  const refresh = useCallback(async () => {
    const { data, error } = await listAssignments()
    const rows = data ?? []
    setState((prev) => ({
      ...prev,
      assignments: rows,
      loading: false,
      error: error?.message ?? null,
      lastSyncedAt: rows.reduce<string | null>(
        (latest, a) => (latest === null || a.last_synced_at > latest ? a.last_synced_at : latest),
        null,
      ),
    }))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Render stored rows immediately, then refresh if the sync brought anything new.
  // A sync failure is quiet by design: stale data beats an error screen, and the
  // TopBar already carries the "sync failed" note.
  //
  // No cleanup flag here on purpose. StrictMode mounts, unmounts, and remounts in
  // development; a cleanup that cancelled the in-flight result would drop it on the
  // floor while `syncedOnce` blocked the retry, so the sync would silently never
  // land. The ref is the once-guard, and React ignores a setState after unmount.
  useEffect(() => {
    if (syncedOnce.current) return
    syncedOnce.current = true
    triggerSync().then(({ data, error }) => {
      const failed = Boolean(error) || Boolean(data?.error)
      setState((prev) => ({ ...prev, syncFailed: failed }))
      if (!failed && (data?.synced ?? 0) > 0) refresh()
    })
  }, [refresh])

  const undoableAction = useCallback(
    async (id: string, action: () => Promise<unknown>) => {
      const previous = state.assignments.find((a) => a.id === id) ?? null
      await action()
      await refresh()
      const undo = async () => {
        if (!previous) return
        await restoreAssignment(id, previous.status)
        await refresh()
      }
      return { undo }
    },
    [state.assignments, refresh],
  )

  const markDone = useCallback((id: string) => undoableAction(id, () => markDoneRepo(id)), [undoableAction])
  const dismiss = useCallback((id: string) => undoableAction(id, () => dismissRepo(id)), [undoableAction])
  const reopen = useCallback((id: string) => undoableAction(id, () => reopenRepo(id)), [undoableAction])
  const logProgress = useCallback(
    (id: string, note?: string) => undoableAction(id, () => logAssignmentProgress(id, note)),
    [undoableAction],
  )

  return { ...state, refresh, markDone, dismiss, reopen, logProgress }
}
