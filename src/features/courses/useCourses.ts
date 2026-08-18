import { useCallback, useEffect, useMemo, useState } from 'react'
import { listCourses } from './courses.repo'
import type { Course } from '@/types/domain'

const FALLBACK = { color: '#5B7085', icon: 'book' }

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data } = await listCourses()
    setCourses(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Assignment rows carry a course *code*, so identity is looked up by code. A course
  // the sync has not created yet falls back to neutral slate rather than rendering blank.
  const identityFor = useMemo(() => {
    const byCode = new Map(courses.map((c) => [c.code, c]))
    return (code: string) => {
      const course = byCode.get(code)
      return course ? { color: course.color, icon: course.icon } : FALLBACK
    }
  }, [courses])

  return { courses, loading, refresh, identityFor }
}
