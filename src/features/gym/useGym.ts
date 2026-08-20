import { useCallback, useEffect, useMemo, useState } from 'react'
import { addCheckin, listCheckins, removeCheckin } from './gym.repo'
import { denverGymWeek } from '@/lib/format'

export function useGym(now: Date) {
  const week = useMemo(() => denverGymWeek(now), [now])
  const [done, setDone] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data } = await listCheckins(week[0], week[6])
    setDone(new Set((data ?? []).map((row) => row.went_on)))
    setLoading(false)
  }, [week])

  useEffect(() => {
    refresh()
  }, [refresh])

  /** One tap on, one tap off. Returns the inverse so the toast can undo it. */
  const toggle = useCallback(
    async (ymd: string) => {
      const wasDone = done.has(ymd)
      if (wasDone) await removeCheckin(ymd)
      else await addCheckin(ymd)
      await refresh()
      return {
        wasDone,
        undo: async () => {
          if (wasDone) await addCheckin(ymd)
          else await removeCheckin(ymd)
          await refresh()
        },
      }
    },
    [done, refresh],
  )

  return { week, done, loading, refresh, toggle }
}
