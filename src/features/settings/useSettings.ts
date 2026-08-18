import { useCallback, useEffect, useState } from 'react'
import { getSettings, triggerSync, upsertSettings } from './settings.repo'
import type { Settings, SettingsPatch } from '@/types/domain'

interface State {
  settings: Settings | null
  loading: boolean
  error: string | null
}

export function useSettings() {
  const [state, setState] = useState<State>({ settings: null, loading: true, error: null })

  const refresh = useCallback(async () => {
    const { data, error } = await getSettings()
    setState({ settings: data, loading: false, error: error?.message ?? null })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const update = useCallback(
    async (patch: SettingsPatch) => {
      const result = await upsertSettings(patch)
      await refresh()
      return result
    },
    [refresh],
  )

  /** Manual sync from the Settings page. Returns a line to show beside the button. */
  const syncNow = useCallback(async () => {
    const { data, error } = await triggerSync()
    if (error) return `Sync failed: ${error.message}`
    if (data?.error) return `Sync failed: ${data.error}`
    if (data?.skipped) return `Nothing to sync (${data.skipped})`
    return `Synced ${data?.synced ?? 0} deadlines`
  }, [])

  return { ...state, refresh, update, syncNow }
}
