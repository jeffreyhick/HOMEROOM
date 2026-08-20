import { useCallback, useEffect, useState } from 'react'
import { getSemesterWins } from './wins.repo'
import type { SemesterWins } from '@/types/domain'

const EMPTY: SemesterWins = { assignments: 0, subtasks: 0, gym: 0, total: 0 }

export function useWins(now: Date) {
  const [wins, setWins] = useState<SemesterWins>(EMPTY)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data } = await getSemesterWins(now)
    setWins(data ?? EMPTY)
    setLoading(false)
  }, [now])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { wins, loading, refresh }
}
