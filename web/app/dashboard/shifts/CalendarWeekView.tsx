'use client'

import type { ShiftWithRoster } from './page'

const START_HOUR = 6
const END_HOUR = 22
const TOTAL_HOURS = END_HOUR - START_HOUR
const ROW_H = 56

function timeLabel(h: number) {
  if (h === 0) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const TEAL = '#00ACC1'
const STATUS_BG: Record<string, string> = {}

interface Props {
  weekStart: Date
  shifts: ShiftWithRoster[]
  onSelectShift: (id: string) => void
  holidays: { id: string; name: string; date: string; is_recurring: boolean }[]
}

const LOC_COLORS = ['#3B82F6', '#00ACC1', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899']

export default function CalendarWeekView({ weekStart, shifts, onSelectShift, holidays }: Props) {
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const todayKey = dateKey(new Date())
  const totalRows = TOTAL_HOURS * 2

  const holidayByDay = new Map<string, string>()
  for (const h of holidays) {
    if (h.is_recurring) {
      const [, mm, dd] = h.date.split('-')
      for (let y = weekStart.getFullYear() - 1; y <= weekStart.getFullYear() + 1; y++) {
        holidayByDay.set(`${y}-${mm}-${dd}`, h.name)
      }
    } else {
      holidayByDay.set(h.date, h.name)
    }
  }

  const shiftsByDay = new Map<string, ShiftWithRoster[]>()
  for (const s of shifts) {
    const k = dateKey(new Date(s.start_time))
    if (!shiftsByDay.has(k)) shiftsByDay.set(k, [])
    shiftsByDay.get(k)!.push(s)
  }

  function shiftRows(s: ShiftWithRoster): { rowStart: number; rowSpan: number } {
    const start = new Date(s.start_time)
    const end = new Date(s.end_time)
    const startHour = start.getHours() + start.getMinutes() / 60
    const endHour = end.getHours() + end.getMinutes() / 60
    const clampedStart = Math.max(START_HOUR, Math.min(END_HOUR, startHour))
    const clampedEnd = Math.max(START_HOUR, Math.min(END_HOUR, endHour))
    const span = Math.max(0.5, clampedEnd - clampedStart)
    const rowStart = Math.round((clampedStart - START_HOUR) * 2) + 1
    const rowSpan = Math.max(1, Math.round(span * 2))
    return { rowStart, rowSpan }
  }

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Header row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)',
        borderBottom: '1px solid var(--surface-border-sub)',
        position: 'sticky', top: 0, background: 'var(--surface-card)', zIndex: 10,
      }}>
        <div />
        {days.map((d, i) => {
          const k = dateKey(d)
          const isToday = k === todayKey
          const holidayName = holidayByDay.get(k)
          return (
            <div key={i} style={{
              padding: '8px 4px', textAlign: 'center',
              borderLeft: '1px solid var(--surface-border-sub)',
              background: holidayName ? '#fef9f0' : isToday ? 'rgba(0,172,193,0.05)' : 'transparent',
            }}>
              <div style={{
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: isToday ? TEAL : '#9ca3af',
              }}>
                {DAY_LABELS[d.getDay()]}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '26px', height: '26px', borderRadius: '50%', margin: '2px auto 0',
                fontSize: '13px', fontWeight: 700,
                background: isToday ? TEAL : 'transparent',
                color: isToday ? 'white' : 'var(--text-primary)',
              }}>
                {d.getDate()}
              </div>
              {holidayName && (
                <div style={{ fontSize: '9px', color: '#d97706', fontWeight: 600, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>
                  {holidayName}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', maxHeight: '620px', overflowY: 'auto' }}>
        {/* Time gutter */}
        <div style={{ display: 'grid', gridTemplateRows: `repeat(${totalRows}, ${ROW_H / 2}px)` }}>
          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
            <div key={i} style={{ gridRow: `${i * 2 + 1} / span 2`, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: '8px', paddingTop: '4px' }}>
              <span style={{ fontSize: '10px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                {timeLabel(START_HOUR + i)}
              </span>
            </div>
          ))}
        </div>

        {days.map((d, colIdx) => {
          const k = dateKey(d)
          const isToday = k === todayKey
          const holidayName = holidayByDay.get(k)
          const dayShifts = shiftsByDay.get(k) ?? []

          return (
            <div key={colIdx} style={{
              display: 'grid',
              gridTemplateRows: `repeat(${totalRows}, ${ROW_H / 2}px)`,
              borderLeft: '1px solid var(--surface-border-sub)',
              background: holidayName ? '#fefdf8' : isToday ? 'rgba(0,172,193,0.02)' : 'transparent',
              position: 'relative',
            }}>
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div key={i} style={{ gridRow: `${i * 2 + 1} / span 2`, borderTop: i > 0 ? '1px solid var(--surface-border-sub)' : 'none', pointerEvents: 'none' }} />
              ))}
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div key={`h${i}`} style={{ gridRow: `${i * 2 + 2} / span 1`, borderTop: '1px dashed rgba(0,0,0,0.05)', pointerEvents: 'none' }} />
              ))}

              {dayShifts.map(s => {
                const { rowStart, rowSpan } = shiftRows(s)
                const filled = s.assignments.length
                const isFull = filled >= s.required_count
                const bg = isFull ? '#fffbeb' : '#ecfdf5'
                const border = isFull ? '#fbbf24' : TEAL
                const text = isFull ? '#92400e' : '#065f46'
                return (
                  <button
                    key={s.id}
                    onClick={() => onSelectShift(s.id)}
                    style={{
                      gridRow: `${rowStart} / span ${rowSpan}`,
                      gridColumn: '1',
                      margin: '1px 3px',
                      padding: '3px 6px',
                      borderRadius: '5px',
                      borderLeft: `3px solid ${border}`,
                      background: bg,
                      fontSize: '11px', fontWeight: 600, color: text,
                      overflow: 'hidden', textAlign: 'left',
                      border: `1px solid ${bg}`,
                      borderLeftColor: border,
                      cursor: 'pointer', zIndex: 2,
                      display: 'flex', flexDirection: 'column',
                    }}
                  >
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name}
                    </span>
                    {rowSpan >= 2 && (
                      <span style={{ fontSize: '10px', opacity: 0.7 }}>
                        {timeFmt.format(new Date(s.start_time))}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
