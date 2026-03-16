'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Plus, Calendar, List,
  MapPin, Clock, Users, Trash2, UserPlus, X,
  LogIn, LogOut, AlertCircle, Search, ArrowLeft, GraduationCap,
} from 'lucide-react'
import {
  createShift, deleteShift,
  assignVolunteer, assignTraineeWithMentor, removeAssignment,
  manualClockIn, manualClockOut,
} from './actions'
import type { ShiftWithRoster } from './page'
import type { Location, Volunteer } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVY = '#1B2A4A'
const TEAL = '#00897B'
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const LOC_COLORS = ['#3B82F6','#00897B','#8B5CF6','#F59E0B','#EF4444','#EC4899','#06B6D4']

const CAT_COLORS: Record<string, string> = {
  medical_professional: '#00897B',
  support_staff: '#3B82F6',
  admin: '#8B5CF6',
  trainee: '#F59E0B',
  other: '#6B7280',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCalendarCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const cells: (Date | null)[] = Array(first.getDay()).fill(null)
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function locationColor(locationId: string | null, locations: { id: string }[]) {
  if (!locationId) return '#9ca3af'
  const idx = locations.findIndex(l => l.id === locationId)
  return LOC_COLORS[idx % LOC_COLORS.length] ?? '#9ca3af'
}

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CreateForm {
  name: string
  location_id: string
  start_time: string
  end_time: string
  required_count: string
  notes: string
}

const EMPTY_CREATE: CreateForm = {
  name: '', location_id: '', start_time: '', end_time: '', required_count: '1', notes: '',
}

type VolunteerLike = Pick<Volunteer, 'id' | 'first_name' | 'last_name' | 'category' | 'status' | 'pipeline_phase'>

export default function ShiftsView({
  shifts,
  locations,
  volunteers,
}: {
  shifts: ShiftWithRoster[]
  locations: Pick<Location, 'id' | 'name'>[]
  volunteers: VolunteerLike[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const today = new Date()
  const [view, setView]         = useState<'calendar' | 'list'>('calendar')
  const [calYear, setCalYear]   = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [showCreate, setShowCreate]     = useState(false)
  const [createForm, setCreateForm]     = useState<CreateForm>(EMPTY_CREATE)
  const [assignSearch, setAssignSearch] = useState('')
  const [showAssign, setShowAssign]     = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [listFilter, setListFilter]     = useState<'upcoming' | 'past'>('upcoming')

  // New Shift modal volunteer picker state
  const [createVolunteerIds, setCreateVolunteerIds] = useState<Set<string>>(new Set())
  const [createVolSearch, setCreateVolSearch]       = useState('')

  // Mentor-pairing state: when a trainee is selected, wait for mentor pick
  const [pendingTrainee, setPendingTrainee] = useState<VolunteerLike | null>(null)
  const [mentorSearch, setMentorSearch]     = useState('')

  const selected = shifts.find(s => s.id === selectedId) ?? null

  // Build a volunteer lookup map for mentor name display
  const volunteerById = useMemo(() => {
    const map: Record<string, VolunteerLike> = {}
    for (const v of volunteers) map[v.id] = v
    return map
  }, [volunteers])

  // In React 18, startTransition doesn't track async work — so we await the mutation
  // first, then wrap router.refresh() in a fresh startTransition so isPending correctly
  // reflects the server re-fetch loading state.
  async function run(fn: () => Promise<void>) {
    setError(null)
    try {
      await fn()
      startTransition(() => { router.refresh() })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  // ── Calendar data ──────────────────────────────────────────────

  const cells = useMemo(() => getCalendarCells(calYear, calMonth), [calYear, calMonth])

  const shiftsByDate = useMemo(() => {
    const map: Record<string, ShiftWithRoster[]> = {}
    for (const s of shifts) {
      const k = dateKey(new Date(s.start_time))
      if (!map[k]) map[k] = []
      map[k].push(s)
    }
    return map
  }, [shifts])

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  // ── List data ──────────────────────────────────────────────────

  const listShifts = useMemo(() => {
    const now = new Date().toISOString()
    return shifts.filter(s => listFilter === 'upcoming' ? s.start_time >= now : s.start_time < now)
  }, [shifts, listFilter])

  // ── Assignable volunteers (exclude already assigned) ──────────

  const assignableVolunteers = useMemo(() => {
    if (!selected) return []
    const assignedIds = new Set(selected.assignments.map(a => a.volunteer_id))
    return volunteers.filter(v =>
      !assignedIds.has(v.id) &&
      (assignSearch === '' || `${v.first_name} ${v.last_name}`.toLowerCase().includes(assignSearch.toLowerCase()))
    )
  }, [selected, volunteers, assignSearch])

  // Volunteers available to assign during shift creation (exclude already selected)
  const createVolunteerOptions = useMemo(() => {
    return volunteers.filter(v =>
      !createVolunteerIds.has(v.id) &&
      (createVolSearch === '' || `${v.first_name} ${v.last_name}`.toLowerCase().includes(createVolSearch.toLowerCase()))
    )
  }, [volunteers, createVolunteerIds, createVolSearch])

  // Eligible mentors for a pending trainee: active volunteers (pipeline_phase === 'active' or status === 'volunteer')
  const eligibleMentors = useMemo(() => {
    if (!selected || !pendingTrainee) return []
    return volunteers.filter(v =>
      v.id !== pendingTrainee.id &&
      v.pipeline_phase === 'active' &&
      (mentorSearch === '' || `${v.first_name} ${v.last_name}`.toLowerCase().includes(mentorSearch.toLowerCase()))
    )
  }, [selected, pendingTrainee, volunteers, mentorSearch])

  // ── Actions ────────────────────────────────────────────────────

  function handleCreate() {
    if (!createForm.name || !createForm.start_time || !createForm.end_time) return
    run(async () => {
      const shiftDate = new Date(createForm.start_time)
      const { shiftId } = await createShift({
        name: createForm.name,
        location_id: createForm.location_id || null,
        start_time: shiftDate.toISOString(),
        end_time: new Date(createForm.end_time).toISOString(),
        required_count: parseInt(createForm.required_count) || 1,
        notes: createForm.notes,
        volunteer_ids: [...createVolunteerIds],
      })
      setCreateForm(EMPTY_CREATE)
      setCreateVolunteerIds(new Set())
      setCreateVolSearch('')
      setShowCreate(false)
      // Navigate calendar to the shift's month so it's visible immediately
      setCalYear(shiftDate.getFullYear())
      setCalMonth(shiftDate.getMonth())
      setView('calendar')
      setSelectedId(shiftId)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this shift?')) return
    run(async () => { await deleteShift(id); setSelectedId(null) })
  }

  function handlePickVolunteer(v: VolunteerLike) {
    if (!selected) return
    if (v.pipeline_phase === 'training') {
      // Two-step: select mentor first
      setPendingTrainee(v)
      setMentorSearch('')
    } else {
      run(async () => {
        await assignVolunteer(selected.id, v.id)
        setShowAssign(false)
        setAssignSearch('')
      })
    }
  }

  function handleAssignWithMentor(mentorId: string) {
    if (!selected || !pendingTrainee) return
    run(async () => {
      await assignTraineeWithMentor(selected.id, pendingTrainee.id, mentorId)
      setPendingTrainee(null)
      setShowAssign(false)
      setAssignSearch('')
      setMentorSearch('')
    })
  }

  function handleCancelTraineePick() {
    setPendingTrainee(null)
    setMentorSearch('')
  }

  function handleRemoveAssignment(assignmentId: string) {
    run(() => removeAssignment(assignmentId))
  }

  function handleClockIn(volunteerId: string) {
    if (!selected) return
    run(() => manualClockIn(volunteerId, selected.id, selected.location_id))
  }

  function handleClockOut(timeEntryId: string) {
    run(() => manualClockOut(timeEntryId))
  }

  // ── Styles ─────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px',
    border: '1px solid #e5e7eb', borderRadius: '7px',
    fontSize: '13px', color: '#374151', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box', background: 'white',
  }
  const btnPrimary: React.CSSProperties = {
    padding: '8px 14px', borderRadius: '7px', background: NAVY, color: 'white',
    border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, opacity: isPending ? 0.6 : 1,
  }
  const btnSecondary: React.CSSProperties = {
    padding: '8px 14px', borderRadius: '7px', background: 'white',
    color: '#374151', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        padding: '20px 28px 16px', borderBottom: '1px solid #f0f0f0', background: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>Shifts</h1>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>{shifts.length} shift{shifts.length !== 1 ? 's' : ''} in view</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            {(['calendar', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '7px 14px', border: 'none', cursor: 'pointer',
                background: view === v ? NAVY : 'white',
                color: view === v ? 'white' : '#6b7280',
                fontSize: '13px', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: '5px',
              }}>
                {v === 'calendar' ? <Calendar style={{ width: '13px', height: '13px' }} /> : <List style={{ width: '13px', height: '13px' }} />}
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus style={{ width: '14px', height: '14px' }} /> New Shift
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          margin: '12px 28px 0', padding: '10px 14px', borderRadius: '8px',
          background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
          fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <AlertCircle style={{ width: '14px', height: '14px', flexShrink: 0 }} />
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
            <X style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      )}

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left: Calendar or List ────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>

          {view === 'calendar' && (
            <div>
              {/* Month nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                  {MONTHS[calMonth]} {calYear}
                </h2>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={prevMonth} style={{ ...btnSecondary, padding: '6px 10px' }}>
                    <ChevronLeft style={{ width: '14px', height: '14px' }} />
                  </button>
                  <button
                    onClick={() => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()) }}
                    style={{ ...btnSecondary, fontSize: '12px', padding: '6px 10px' }}
                  >Today</button>
                  <button onClick={nextMonth} style={{ ...btnSecondary, padding: '6px 10px' }}>
                    <ChevronRight style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              </div>

              {/* Location color legend */}
              {locations.length > 0 && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  {locations.map((l, i) => (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: LOC_COLORS[i % LOC_COLORS.length] }} />
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>{l.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', marginBottom: '4px' }}>
                {DAYS.map(d => (
                  <div key={d} style={{ padding: '6px 4px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.04em' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: '#f3f4f6', borderRadius: '10px', overflow: 'hidden' }}>
                {cells.map((cell, i) => {
                  if (!cell) return <div key={i} style={{ background: '#fafafa', minHeight: '100px' }} />
                  const key = dateKey(cell)
                  const dayShifts = shiftsByDate[key] ?? []
                  const isToday = cell.toDateString() === today.toDateString()
                  const isPast = cell < today && !isToday

                  return (
                    <div key={i} style={{
                      background: isPast ? '#fafafa' : 'white',
                      minHeight: '100px', padding: '6px',
                      position: 'relative',
                    }}>
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '4px',
                        background: isToday ? NAVY : 'transparent',
                        color: isToday ? 'white' : isPast ? '#d1d5db' : '#374151',
                        fontSize: '12px', fontWeight: isToday ? 700 : 500,
                      }}>
                        {cell.getDate()}
                      </div>

                      {dayShifts.slice(0, 2).map(s => {
                        const color = locationColor(s.location_id, locations)
                        const filled = s.assignments.length
                        const needed = s.required_count
                        const isSelected = selectedId === s.id
                        return (
                          <div
                            key={s.id}
                            onClick={() => setSelectedId(isSelected ? null : s.id)}
                            style={{
                              marginBottom: '3px', padding: '3px 6px', borderRadius: '5px',
                              background: isSelected ? NAVY : `${color}18`,
                              borderLeft: `3px solid ${color}`,
                              cursor: 'pointer', transition: 'all 0.1s',
                            }}
                          >
                            <p style={{ fontSize: '11px', fontWeight: 600, color: isSelected ? 'white' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.name}
                            </p>
                            <p style={{ fontSize: '10px', color: isSelected ? 'rgba(255,255,255,0.7)' : '#9ca3af' }}>
                              {fmtTime(s.start_time)} · {filled}/{needed}
                            </p>
                          </div>
                        )
                      })}
                      {dayShifts.length > 2 && (
                        <p style={{ fontSize: '10px', color: '#9ca3af', paddingLeft: '4px' }}>
                          +{dayShifts.length - 2} more
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {view === 'list' && (
            <div>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
                {(['upcoming', 'past'] as const).map(f => (
                  <button key={f} onClick={() => setListFilter(f)} style={{
                    padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                    background: listFilter === f ? NAVY : '#f3f4f6',
                    color: listFilter === f ? 'white' : '#6b7280',
                    fontSize: '13px', fontWeight: 500,
                  }}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {listShifts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px 0' }}>
                  <Calendar style={{ width: '32px', height: '32px', color: '#e5e7eb', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '14px', color: '#9ca3af' }}>No {listFilter} shifts</p>
                </div>
              ) : (
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#fafafa' }}>
                        {['Shift', 'Date', 'Time', 'Location', 'Roster', ''].map(h => (
                          <th key={h} style={{
                            padding: '10px 20px', textAlign: 'left',
                            fontSize: '11px', fontWeight: 600, color: '#9ca3af',
                            letterSpacing: '0.06em', textTransform: 'uppercase',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {listShifts.map((s, i) => {
                        const color = locationColor(s.location_id, locations)
                        const filled = s.assignments.length
                        const isSelected = selectedId === s.id
                        return (
                          <tr
                            key={s.id}
                            onClick={() => setSelectedId(isSelected ? null : s.id)}
                            style={{
                              borderTop: i === 0 ? 'none' : '1px solid #f9f9f9',
                              cursor: 'pointer',
                              background: isSelected ? '#f8faff' : 'white',
                            }}
                          >
                            <td style={{ padding: '13px 20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '4px', height: '32px', borderRadius: '2px', background: color, flexShrink: 0 }} />
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{s.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '13px 20px', fontSize: '13px', color: '#374151' }}>
                              {fmtDate(s.start_time)}
                            </td>
                            <td style={{ padding: '13px 20px', fontSize: '13px', color: '#374151' }}>
                              {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                            </td>
                            <td style={{ padding: '13px 20px' }}>
                              {s.location_name
                                ? <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '5px', background: `${color}18`, color }}>{s.location_name}</span>
                                : <span style={{ fontSize: '12px', color: '#d1d5db' }}>—</span>
                              }
                            </td>
                            <td style={{ padding: '13px 20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '56px', height: '5px', borderRadius: '3px', background: '#f3f4f6', overflow: 'hidden' }}>
                                  <div style={{
                                    height: '100%', borderRadius: '3px',
                                    background: filled >= s.required_count ? '#22c55e' : NAVY,
                                    width: `${Math.min(100, (filled / s.required_count) * 100)}%`,
                                  }} />
                                </div>
                                <span style={{ fontSize: '12px', color: '#6b7280' }}>{filled}/{s.required_count}</span>
                              </div>
                            </td>
                            <td style={{ padding: '13px 12px', textAlign: 'right' }}>
                              <span style={{ color: '#d1d5db', fontSize: '16px' }}>→</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Roster panel ───────────────────────────────── */}
        {selected && (
          <div style={{
            width: '360px', borderLeft: '1px solid #f0f0f0',
            background: 'white', overflowY: 'auto', flexShrink: 0,
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Panel header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', flex: 1, marginRight: '8px' }}>{selected.name}</h3>
                <button onClick={() => { setSelectedId(null); setShowAssign(false); setPendingTrainee(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px' }}>
                  <X style={{ width: '16px', height: '16px' }} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#6b7280' }}>
                  <Clock style={{ width: '12px', height: '12px' }} />
                  {fmtDate(selected.start_time)} · {fmtTime(selected.start_time)}–{fmtTime(selected.end_time)}
                </span>
                {selected.location_name && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#6b7280' }}>
                    <MapPin style={{ width: '12px', height: '12px' }} />
                    {selected.location_name}
                  </span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#6b7280' }}>
                  <Users style={{ width: '12px', height: '12px' }} />
                  {selected.assignments.length} / {selected.required_count} filled
                </span>
              </div>
              <div style={{ marginTop: '10px', height: '5px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '3px', transition: 'width 0.3s',
                  background: selected.assignments.length >= selected.required_count ? '#22c55e' : NAVY,
                  width: `${Math.min(100, (selected.assignments.length / selected.required_count) * 100)}%`,
                }} />
              </div>
            </div>

            {/* Roster list */}
            <div style={{ flex: 1, padding: '12px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Assigned Volunteers
                </span>
                {!pendingTrainee && (
                  <button
                    onClick={() => { setShowAssign(!showAssign); setAssignSearch('') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '12px', color: TEAL, fontWeight: 500, padding: 0,
                    }}
                  >
                    <UserPlus style={{ width: '13px', height: '13px' }} />
                    Assign
                  </button>
                )}
              </div>

              {/* ── Step 1: Pick volunteer ── */}
              {showAssign && !pendingTrainee && (
                <div style={{ marginBottom: '12px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
                  <div style={{ position: 'relative', padding: '8px' }}>
                    <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '13px', height: '13px', color: '#9ca3af' }} />
                    <input
                      style={{ ...inputStyle, paddingLeft: '28px' }}
                      placeholder="Search volunteers…"
                      value={assignSearch}
                      onChange={e => setAssignSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {assignableVolunteers.slice(0, 20).map(v => {
                      const isTrainee = v.pipeline_phase === 'training'
                      return (
                        <div
                          key={v.id}
                          onClick={() => handlePickVolunteer(v)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 12px', cursor: 'pointer', transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                            background: `${CAT_COLORS[v.category] ?? '#6b7280'}18`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '10px', fontWeight: 700, color: CAT_COLORS[v.category] ?? '#6b7280',
                          }}>
                            {initials(v.first_name, v.last_name)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                              {v.first_name} {v.last_name}
                            </span>
                            {isTrainee && (
                              <span style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: '4px', marginLeft: '5px' }}>
                                needs mentor
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {assignableVolunteers.length === 0 && (
                      <p style={{ fontSize: '12px', color: '#9ca3af', padding: '12px', textAlign: 'center' }}>
                        {assignSearch ? 'No matches' : 'All volunteers assigned'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Step 2: Pick mentor for trainee ── */}
              {pendingTrainee && (
                <div style={{ marginBottom: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={handleCancelTraineePick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', padding: '0', display: 'flex' }}>
                      <ArrowLeft style={{ width: '13px', height: '13px' }} />
                    </button>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#92400e' }}>
                        Select mentor for {pendingTrainee.first_name} {pendingTrainee.last_name}
                      </p>
                      <p style={{ fontSize: '11px', color: '#b45309' }}>Training-phase volunteers require a mentor</p>
                    </div>
                  </div>
                  <div style={{ position: 'relative', padding: '8px' }}>
                    <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '13px', height: '13px', color: '#9ca3af' }} />
                    <input
                      style={{ ...inputStyle, paddingLeft: '28px' }}
                      placeholder="Search mentors…"
                      value={mentorSearch}
                      onChange={e => setMentorSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    {eligibleMentors.slice(0, 20).map(v => (
                      <div
                        key={v.id}
                        onClick={() => handleAssignWithMentor(v.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '8px 12px', cursor: 'pointer', transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fef3c7')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                          background: `${CAT_COLORS[v.category] ?? '#6b7280'}18`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: 700, color: CAT_COLORS[v.category] ?? '#6b7280',
                        }}>
                          {initials(v.first_name, v.last_name)}
                        </div>
                        <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>
                          {v.first_name} {v.last_name}
                        </span>
                      </div>
                    ))}
                    {eligibleMentors.length === 0 && (
                      <p style={{ fontSize: '12px', color: '#9ca3af', padding: '12px', textAlign: 'center' }}>
                        {mentorSearch ? 'No matches' : 'No active volunteers available as mentors'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Assigned volunteers list */}
              {selected.assignments.length === 0 && !showAssign && !pendingTrainee ? (
                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                  <Users style={{ width: '24px', height: '24px', color: '#e5e7eb', margin: '0 auto 6px' }} />
                  <p style={{ fontSize: '13px', color: '#9ca3af' }}>No volunteers assigned yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selected.assignments.map(a => {
                    const color = CAT_COLORS[a.volunteer.category] ?? '#6b7280'
                    const te = a.time_entry
                    const isClockedIn  = te && !te.clock_out
                    const isClockedOut = te && te.clock_out
                    const isTrainee    = a.volunteer.pipeline_phase === 'training'
                    const mentorVol    = a.mentor_id ? volunteerById[a.mentor_id] : null
                    return (
                      <div key={a.id} style={{
                        padding: '10px 12px', borderRadius: '8px',
                        border: `1px solid ${isClockedIn ? '#d1fae5' : isTrainee ? '#fde68a' : '#f3f4f6'}`,
                        background: isClockedIn ? '#f0fdf4' : isTrainee ? '#fffbeb' : 'white',
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                      }}>
                        {/* Avatar */}
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                          background: `${color}18`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 700, color,
                        }}>
                          {initials(a.volunteer.first_name, a.volunteer.last_name)}
                        </div>

                        {/* Name + status + mentor info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                              {a.volunteer.first_name} {a.volunteer.last_name}
                            </p>
                            {isTrainee && (
                              <span style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <GraduationCap style={{ width: '10px', height: '10px' }} /> Trainee
                              </span>
                            )}
                          </div>
                          {/* Mentor line */}
                          {isTrainee && mentorVol && (
                            <p style={{ fontSize: '11px', color: '#92400e', marginTop: '2px' }}>
                              Mentor: {mentorVol.first_name} {mentorVol.last_name}
                            </p>
                          )}
                          {isTrainee && !mentorVol && (
                            <p style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>
                              ⚠ No mentor assigned
                            </p>
                          )}
                          {isClockedIn && (
                            <p style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>
                              Clocked in {fmtTime(te.clock_in)}
                            </p>
                          )}
                          {isClockedOut && (
                            <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                              {fmtTime(te.clock_in)} – {fmtTime(te.clock_out!)}
                              {te.duration_minutes ? ` · ${Math.floor(te.duration_minutes / 60)}h ${te.duration_minutes % 60}m` : ''}
                            </p>
                          )}
                        </div>

                        {/* Clock actions */}
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          {!te && (
                            <button
                              onClick={() => handleClockIn(a.volunteer_id)}
                              disabled={isPending}
                              title="Clock in"
                              style={{
                                padding: '5px 8px', borderRadius: '6px',
                                border: '1px solid #d1fae5', background: '#f0fdf4',
                                cursor: 'pointer', color: '#16a34a',
                                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 500,
                              }}
                            >
                              <LogIn style={{ width: '11px', height: '11px' }} /> In
                            </button>
                          )}
                          {isClockedIn && (
                            <button
                              onClick={() => handleClockOut(te.id)}
                              disabled={isPending}
                              title="Clock out"
                              style={{
                                padding: '5px 8px', borderRadius: '6px',
                                border: '1px solid #fecaca', background: '#fef2f2',
                                cursor: 'pointer', color: '#dc2626',
                                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 500,
                              }}
                            >
                              <LogOut style={{ width: '11px', height: '11px' }} /> Out
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveAssignment(a.id)}
                            title="Remove"
                            style={{ padding: '5px 6px', borderRadius: '6px', border: '1px solid #f3f4f6', background: 'white', cursor: 'pointer', color: '#9ca3af' }}
                          >
                            <X style={{ width: '11px', height: '11px' }} />
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {/* Open slots */}
                  {Array.from({ length: Math.max(0, selected.required_count - selected.assignments.length) }).map((_, i) => (
                    <div key={`open-${i}`} style={{
                      padding: '10px 12px', borderRadius: '8px',
                      border: '1px dashed #e5e7eb', background: '#fafafa',
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        border: '1.5px dashed #d1d5db', background: 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Plus style={{ width: '12px', height: '12px', color: '#d1d5db' }} />
                      </div>
                      <span style={{ fontSize: '12px', color: '#d1d5db' }}>Open slot</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleDelete(selected.id)}
                style={{
                  padding: '7px 10px', borderRadius: '7px',
                  border: '1px solid #fecaca', background: 'white', cursor: 'pointer',
                  color: '#dc2626', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px',
                }}
              >
                <Trash2 style={{ width: '12px', height: '12px' }} /> Delete shift
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Shift Modal ──────────────────────────────────── */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            background: 'white', borderRadius: '14px',
            padding: '28px', width: '100%', maxWidth: '480px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#111827' }}>New Shift</h2>
              <button onClick={() => { setShowCreate(false); setCreateForm(EMPTY_CREATE); setCreateVolunteerIds(new Set()); setCreateVolSearch('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Shift Name *</label>
                <input style={inputStyle} value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Saturday Morning Clinic" autoFocus />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Location</label>
                <select style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }} value={createForm.location_id} onChange={e => setCreateForm(f => ({ ...f, location_id: e.target.value }))}>
                  <option value="">No location</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Start *</label>
                  <input style={inputStyle} type="datetime-local" value={createForm.start_time} onChange={e => setCreateForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>End *</label>
                  <input style={inputStyle} type="datetime-local" value={createForm.end_time} onChange={e => setCreateForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Volunteers Needed</label>
                <input style={inputStyle} type="number" min="1" value={createForm.required_count} onChange={e => setCreateForm(f => ({ ...f, required_count: e.target.value }))} />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes</label>
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '56px', lineHeight: 1.5 }} value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
              </div>

              {/* Volunteer picker */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Assign Volunteers
                </label>

                {/* Selected volunteer chips */}
                {createVolunteerIds.size > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                    {[...createVolunteerIds].map(vid => {
                      const v = volunteers.find(x => x.id === vid)
                      if (!v) return null
                      return (
                        <span key={vid} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          background: '#e0f2f1', color: '#00695c', fontSize: '12px',
                          fontWeight: 500, padding: '3px 8px', borderRadius: '99px',
                        }}>
                          {v.first_name} {v.last_name}
                          {v.pipeline_phase === 'training' && (
                            <span style={{ fontSize: '10px', color: '#F59E0B', fontWeight: 700 }} title="Training phase — mentor must be assigned after creation"> ★</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setCreateVolunteerIds(prev => { const next = new Set(prev); next.delete(vid); return next })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#00897B' }}
                          >
                            <X style={{ width: '11px', height: '11px' }} />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Search input */}
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', width: '13px', height: '13px', color: '#9ca3af', pointerEvents: 'none' }} />
                  <input
                    style={{ ...inputStyle, paddingLeft: '28px' }}
                    placeholder="Search volunteers to add…"
                    value={createVolSearch}
                    onChange={e => setCreateVolSearch(e.target.value)}
                  />
                </div>

                {/* Dropdown list */}
                {createVolSearch !== '' && (
                  <div style={{
                    marginTop: '4px', border: '1px solid #e5e7eb', borderRadius: '7px',
                    background: 'white', maxHeight: '160px', overflowY: 'auto',
                  }}>
                    {createVolunteerOptions.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: '12px', color: '#9ca3af' }}>No volunteers found</div>
                    ) : createVolunteerOptions.slice(0, 10).map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setCreateVolunteerIds(prev => new Set([...prev, v.id]))
                          setCreateVolSearch('')
                        }}
                        style={{
                          width: '100%', textAlign: 'left', background: 'none', border: 'none',
                          cursor: 'pointer', padding: '8px 12px', fontSize: '13px', display: 'flex',
                          alignItems: 'center', gap: '8px',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                      >
                        <span style={{
                          width: '26px', height: '26px', borderRadius: '50%',
                          background: CAT_COLORS[v.category] + '22',
                          color: CAT_COLORS[v.category] ?? '#6b7280',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: 700, flexShrink: 0,
                        }}>
                          {initials(v.first_name, v.last_name)}
                        </span>
                        <span style={{ flex: 1 }}>
                          {v.first_name} {v.last_name}
                          {v.pipeline_phase === 'training' && (
                            <span style={{ marginLeft: '6px', fontSize: '10px', color: '#F59E0B', fontWeight: 600 }}>training</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button style={btnPrimary} onClick={handleCreate} disabled={!createForm.name || !createForm.start_time || !createForm.end_time || isPending}>
                Create Shift
              </button>
              <button style={btnSecondary} onClick={() => { setShowCreate(false); setCreateForm(EMPTY_CREATE); setCreateVolunteerIds(new Set()); setCreateVolSearch('') }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
