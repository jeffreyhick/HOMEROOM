import { useState } from 'react'
import { ClassTag } from '@/components/ClassTag'
import { Countdown } from '@/components/Countdown'
import { denverWeekBounds, denverYmd } from '@/lib/format'
import type { Assignment } from '@/types/domain'
import { DEFAULT_WINDOW, groupByDay, inWindow, sortByDue, WINDOWS } from './deadlineWindows'

// Module scope on purpose: the selection has to survive the panel unmounting and
// reopening, but not a page reload. That is exactly "persists within a session".
let rememberedWindow = DEFAULT_WINDOW

interface DeadlinesExpandedProps {
  assignments: Assignment[]
  now: Date
  identityFor: (course: string) => { color: string; icon: string }
  onOpenAssignment: (assignment: Assignment, source: HTMLElement) => void
}

export function DeadlinesExpanded({ assignments, now, identityFor, onOpenAssignment }: DeadlinesExpandedProps) {
  const [windowIndex, setWindowIndex] = useState(rememberedWindow)

  function chooseWindow(index: number) {
    rememberedWindow = index
    setWindowIndex(index)
  }

  const upcoming = sortByDue(assignments.filter((a) => a.status === 'upcoming'))

  const shown = upcoming.filter((a) => inWindow(a, WINDOWS[windowIndex], now))
  const everything = upcoming // 'All' is a superset of every window, so it is always the tallest

  const { monday, sunday } = denverWeekBounds(now)
  const doneThisWeek = assignments.filter((a) => {
    if (a.status !== 'done') return false
    const ymd = denverYmd(new Date(a.due_at))
    return ymd >= monday && ymd <= sunday
  }).length

  function renderGroups(rows: Assignment[], interactive: boolean) {
    if (rows.length === 0) {
      return <p className="empty">Nothing due in this window. Enjoy it.</p>
    }
    return groupByDay(rows, now).map((group, groupIndex) => (
      <div className="daygroup" key={`${group.label}-${groupIndex}`}>
        <div className={`dayhead${group.label === 'Overdue' ? ' is-overdue' : ''}`}>{group.label}</div>
        <div className="rows">
          {group.rows.map((a) => {
            const identity = identityFor(a.course)
            return (
              <button
                key={a.id}
                type="button"
                className="row"
                tabIndex={interactive ? undefined : -1}
                onClick={(e) => {
                  if (!interactive) return
                  e.stopPropagation()
                  onOpenAssignment(a, e.currentTarget)
                }}
              >
                <ClassTag color={identity.color} icon={identity.icon} />
                <div className="row-main">
                  <span className="row-kicker" style={{ color: identity.color }}>
                    {a.course}
                  </span>
                  <span className="row-text">{a.title}</span>
                  {a.is_exam && <span className="tag-exam">EXAM</span>}
                </div>
                <Countdown dueAt={a.due_at} now={now} />
              </button>
            )
          })}
        </div>
      </div>
    ))
  }

  return (
    <>
      <div className="xhead">
        <h2 className="xtitle">Deadlines</h2>
      </div>

      <div className="segmented" role="tablist" aria-label="Time window">
        {WINDOWS.map((w, i) => (
          <button
            key={w.label}
            type="button"
            role="tab"
            aria-selected={i === windowIndex}
            className={`seg${i === windowIndex ? ' is-on' : ''}`}
            onClick={() => chooseWindow(i)}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/*
        Both children share one grid cell, so the body is always as tall as the *widest*
        window's content and changing the window never resizes the panel. The snap-smaller
        when going from 2 weeks back to 24h was explicitly rejected in review; leftover
        whitespace is the intended "you're caught up" signal.

        The ghost measures rather than a hardcoded pixel height, so the lock tracks real
        data instead of drifting from it.
      */}
      <div className="dl-body">
        <div className="dl-ghost" aria-hidden="true">
          {renderGroups(everything, false)}
        </div>
        <div className="dl-live">{renderGroups(shown, true)}</div>
      </div>

      <div className="xfoot">
        {shown.length} deadline{shown.length === 1 ? '' : 's'} shown · {doneThisWeek} done this week
      </div>
    </>
  )
}
