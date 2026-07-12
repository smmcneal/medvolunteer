'use client'

import { filledSpots, type ShiftWithRoster } from './page'

const START_HOUR = 6
const END_HOUR = 22
const TOTAL_HOURS = END_HOUR - START_HOUR
const ROW_H = 64

const TEAL = '#00ACC1'

function timeLabel(h: number) {
  if (h === 0) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  day: Date
  shifts: ShiftWithRoster[]
  onSelectShift: (id: string) => void
  holidays: { id: string; name: string; date: string; is_recurring: boolean }[]
}

export default function CalendarDayView({ day, shifts, onSelectShift, holidays }: Props) {
  const totalRows = TOTAL_HOURS * 2
  const k = dateKey(day)
  const todayKey = dateKey(new Date())
  const isToday = k === todayKey

  const holidayByDay = new Map<string, string>()
  for (const h of holidays) {
    if (h.is_recurring) {
      const [, mm, dd] = h.date.split('-')
      for (let y = day.getFullYear() - 1; y <= day.getFullYear() + 1; y++) {
        holidayByDay.set(`${y}-${mm}-${dd}`, h.name)
      }
    } else {
      holidayByDay.set(h.date, h.name)
    }
  }
  const holidayName = holidayByDay.get(k)

  const dayShifts = shifts.filter(s => dateKey(new Date(s.start_time)) === k)

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

  const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div>
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--surface-border-sub)',
        display: 'flex', alignItems: 'center', gap: '12px',
        background: holidayName ? '#fef9f0' : isToday ? 'rgba(0,172,193,0.04)' : 'var(--surface-card)',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
          background: isToday ? TEAL : 'var(--surface-border-sub)',
          color: isToday ? 'white' : 'var(--text-primary)',
          fontSize: '15px', fontWeight: 700,
        }}>
          {day.getDate()}
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.2px' }}>
            {dayFmt.format(day)}
          </div>
          {holidayName && (
            <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 600 }}>{holidayName}</div>
          )}
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {dayShifts.length} {dayShifts.length === 1 ? 'shift' : 'shifts'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', maxHeight: '620px', overflowY: 'auto' }}>
        {/* Time gutter */}
        <div style={{ display: 'grid', gridTemplateRows: `repeat(${totalRows}, ${ROW_H / 2}px)` }}>
          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
            <div key={i} style={{ gridRow: `${i * 2 + 1} / span 2`, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: '10px', paddingTop: '5px' }}>
              <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                {timeLabel(START_HOUR + i)}
              </span>
            </div>
          ))}
        </div>

        {/* Event column */}
        <div style={{
          display: 'grid',
          gridTemplateRows: `repeat(${totalRows}, ${ROW_H / 2}px)`,
          borderLeft: '1px solid var(--surface-border-sub)',
          background: holidayName ? '#fefdf8' : 'transparent',
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
            const filled = filledSpots(s.assignments)
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
                  margin: '2px 16px 2px 4px',
                  padding: '6px 10px',
                  borderRadius: '7px',
                  borderLeft: `4px solid ${border}`,
                  background: bg,
                  border: `1px solid ${bg}`,
                  borderLeftColor: border,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex', flexDirection: 'column', gap: '2px',
                  zIndex: 2, overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.name}
                </span>
                <span style={{ fontSize: '11px', color: text, opacity: 0.7 }}>
                  {timeFmt.format(new Date(s.start_time))} – {timeFmt.format(new Date(s.end_time))}
                </span>
                {rowSpan >= 3 && (
                  <span style={{ fontSize: '11px', color: text, opacity: 0.6 }}>
                    {filled}/{s.required_count} filled
                  </span>
                )}
              </button>
            )
          })}

          {dayShifts.length === 0 && (
            <div style={{
              gridRow: `${Math.round((10 - START_HOUR) * 2) + 1} / span 4`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-faint)', fontSize: '13px',
            }}>
              No shifts scheduled
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
