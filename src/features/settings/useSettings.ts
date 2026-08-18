import { useCallback, useEffect, useState } from 'react'
import { getSettings, upsertSettings } from './settings.repo'
import type { Settings } from '@/types/domain'

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
    async (patch: Partial<Omit<Settings, 'id' | 'user_id'>>) => {
      const result = await upsertSettings(patch)
      await refresh()
      return result
    },
    [refresh],
  )

  return { ...state, refresh, update }
}
