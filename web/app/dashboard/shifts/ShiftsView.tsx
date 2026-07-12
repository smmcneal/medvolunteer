'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Plus, Calendar, List,
  MapPin, Clock, Users, Trash2, UserPlus, X,
  LogIn, LogOut, AlertCircle, Search, ArrowLeft, GraduationCap,
} from 'lucide-react'
import CalendarWeekView from './CalendarWeekView'
import CalendarDayView from './CalendarDayView'
import { useAdminT } from '@/lib/admin-lang'
import {
  createShift, deleteShift,
  createRecurringShifts, bulkUpdateRecurringShifts, bulkDeleteRecurringShifts,
  assignVolunteer, assignTraineeWithMentor, removeAssignment,
  manualClockIn, manualClockOut,
} from './actions'
import type { ShiftWithRoster } from './page'
import type { Location, Volunteer } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

const NAVY = '#1B2A4A'
const TEAL = '#00ACC1'
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const LOC_COLORS = ['#3B82F6','#00ACC1','#8B5CF6','#F59E0B','#EF4444','#EC4899','#06B6D4']

const CAT_COLORS: Record<string, string> = {
  medical_professional: '#00ACC1',
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
  start_date: string
  start_time: string
  end_date: string
  end_time: string
  required_count: string
  required_categories: string[]
  notes: string
}

const EMPTY_CREATE: CreateForm = {
  name: '', location_id: '',
  start_date: '', start_time: '',
  end_date: '', end_time: '',
  required_count: '1', required_categories: [], notes: '',
}

function buildISO(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString()
}

type VolunteerLike = Pick<Volunteer, 'id' | 'first_name' | 'last_name' | 'category' | 'status' | 'pipeline_phase'>

export default function ShiftsView({
  shifts,
  locations,
  volunteers,
  holidays = [],
  categories = [],
}: {
  shifts: ShiftWithRoster[]
  locations: Pick<Location, 'id' | 'name'>[]
  volunteers: VolunteerLike[]
  holidays?: { id: string; name: string; date: string; is_recurring: boolean }[]
  categories?: { id: string; slug: string; name: string }[]
}) {
  const router = useRouter()
  const t = useAdminT()
  const [isPending, startTransition] = useTransition()

  const today = new Date()
  const [view, setView]         = useState<'calendar' | 'list' | 'week' | 'day'>('calendar')
  const [calYear, setCalYear]   = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    d.setDate(d.getDate() - d.getDay())
    return d
  })
  const [selectedDayView, setSelectedDayView] = useState<Date>(() =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate())
  )
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [showCreate, setShowCreate]     = useState(false)
  const [createForm, setCreateForm]     = useState<CreateForm>(EMPTY_CREATE)
  const [assignSearch, setAssignSearch] = useState('')
  const [showAssign, setShowAssign]     = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [listFilter, setListFilter]         = useState<'upcoming' | 'past'>('upcoming')
  const [listCategoryFilter, setListCategoryFilter] = useState<string>('')

  // New Shift modal volunteer picker state
  const [createVolunteerIds, setCreateVolunteerIds] = useState<Set<string>>(new Set())
  const [createVolSearch, setCreateVolSearch]       = useState('')

  // Mentor-pairing state: when a trainee is selected, wait for mentor pick
  const [pendingTrainee, setPendingTrainee] = useState<VolunteerLike | null>(null)
  const [mentorSearch, setMentorSearch]     = useState('')

  // Recurring shift creation state
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurFrequency, setRecurFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly')
  const [recurEndDate, setRecurEndDate] = useState('')


  const selected = shifts.find(s => s.id === selectedId) ?? null

  // Build a volunteer lookup map for mentor name display
  const volunteerById = useMemo(() => {
    const map: Record<string, VolunteerLike> = {}
    for (const v of volunteers) map[v.id] = v
    return map
  }, [volunteers])

  // Build a category lookup map (slug -> name) for displaying a shift's required categories
  const categoryBySlug = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of categories) map[c.slug] = c.name
    return map
  }, [categories])

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

  const holidayByDay = useMemo(() => {
    const map = new Map<string, string>()
    for (const h of holidays) {
      if (h.is_recurring) {
        const [, mm, dd] = h.date.split('-')
        for (let y = calYear - 1; y <= calYear + 1; y++) {
          map.set(`${y}-${mm}-${dd}`, h.name)
        }
      } else {
        map.set(h.date, h.name)
      }
    }
    return map
  }, [holidays, calYear])

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
    return shifts.filter(s => {
      if (listFilter === 'upcoming' ? s.start_time < now : s.start_time >= now) return false
      if (listCategoryFilter && !s.required_categories.includes(listCategoryFilter)) return false
      return true
    })
  }, [shifts, listFilter, listCategoryFilter])

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
    if (!createForm.name || !createForm.start_date || !createForm.start_time || !createForm.end_date || !createForm.end_time) return
    run(async () => {
      const shiftDate = new Date(buildISO(createForm.start_date, createForm.start_time))
      const shiftData = {
        name: createForm.name,
        location_id: createForm.location_id || null,
        start_time: buildISO(createForm.start_date, createForm.start_time),
        end_time: buildISO(createForm.end_date, createForm.end_time),
        required_count: parseInt(createForm.required_count) || 1,
        required_categories: createForm.required_categories,
        notes: createForm.notes,
      }

      if (isRecurring) {
        await createRecurringShifts(shiftData, recurFrequency, recurEndDate || null)
        setCreateForm(EMPTY_CREATE)
        setIsRecurring(false)
        setRecurFrequency('weekly')
        setRecurEndDate('')
        setCreateVolunteerIds(new Set())
        setCreateVolSearch('')
        setShowCreate(false)
        setCalYear(shiftDate.getFullYear())
        setCalMonth(shiftDate.getMonth())
        setView('calendar')
        return
      }

      const { shiftId } = await createShift({ ...shiftData, volunteer_ids: [...createVolunteerIds] })
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
    const s = shifts.find(x => x.id === id)
    if (s?.recurrence_group_id) {
      // For recurring shifts, show a two-option confirm
      const choice = window.confirm('Delete all future shifts in this series?\n\nOK = Delete this and all future shifts\nCancel = Delete only this shift')
      if (choice) {
        run(async () => { await bulkDeleteRecurringShifts(s.recurrence_group_id!, id); setSelectedId(null) })
      } else {
        run(async () => { await deleteShift(id); setSelectedId(null) })
      }
    } else {
      if (!confirm('Delete this shift?')) return
      run(async () => { await deleteShift(id); setSelectedId(null) })
    }
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
    setRemoveConfirmId(null)
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
    border: '1px solid var(--surface-border)', borderRadius: '7px',
    fontSize: '13px', color: 'var(--text-primary)', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box', background: 'white',
  }
  const btnPrimary: React.CSSProperties = {
    padding: '8px 16px', borderRadius: '7px', background: TEAL, color: 'white',
    border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, opacity: isPending ? 0.6 : 1,
  }
  const btnSecondary: React.CSSProperties = {
    padding: '8px 14px', borderRadius: '7px', background: 'white',
    color: 'var(--text-secondary)', border: '1px solid var(--surface-border)', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Header */}
      <div className="shift-header" style={{
        padding: '18px 28px', borderBottom: '1px solid var(--surface-border-sub)', background: 'var(--surface-card)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.3px' }}>
            {t('shifts_title')}
          </h1>
          <span style={{
            fontSize: '12px', fontWeight: 600, color: 'var(--teal)',
            padding: '1px 8px', borderRadius: '99px',
            border: '1px solid rgba(0,172,193,0.25)', background: 'rgba(0,172,193,0.06)',
            letterSpacing: '0.01em',
          }}>
            {shifts.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--surface-border)', borderRadius: '8px', overflow: 'hidden', background: 'white' }}>
            {([
              { key: 'calendar', label: t('month_view'), icon: <Calendar style={{ width: '13px', height: '13px' }} /> },
              { key: 'week',     label: t('week_view'),  icon: null },
              { key: 'day',      label: t('day_view'),   icon: null },
              { key: 'list',     label: t('list_view'),  icon: <List style={{ width: '13px', height: '13px' }} /> },
            ] as const).map(({ key, label, icon }) => (
              <button key={key} onClick={() => setView(key)} className="shift-view-toggle-btn" style={{
                padding: '7px 12px', border: 'none', cursor: 'pointer',
                background: view === key ? NAVY : 'transparent',
                color: view === key ? 'white' : 'var(--text-muted)',
                fontSize: '12px', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: '4px',
                borderLeft: key !== 'calendar' ? '1px solid var(--surface-border)' : 'none',
              }}>
                {icon}
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="shift-new-btn"
            style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus style={{ width: '14px', height: '14px' }} /> {t('new_shift')}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          margin: '12px 28px 0', padding: '10px 14px', borderRadius: '9px',
          background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
          fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 1px 4px rgba(220,38,38,0.1)',
        }}>
          <AlertCircle style={{ width: '14px', height: '14px', flexShrink: 0 }} />
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', opacity: 0.7 }}>
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
                <h2 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.2px' }}>
                  {MONTHS[calMonth]} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{calYear}</span>
                </h2>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={prevMonth} style={{ ...btnSecondary, padding: '6px 10px' }}>
                    <ChevronLeft style={{ width: '14px', height: '14px' }} />
                  </button>
                  <button
                    onClick={() => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()) }}
                    style={{ ...btnSecondary, fontSize: '12px', padding: '6px 10px', fontWeight: 600 }}
                  >{t('today')}</button>
                  <button onClick={nextMonth} style={{ ...btnSecondary, padding: '6px 10px' }}>
                    <ChevronRight style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              </div>

              {/* Location color legend */}
              {locations.length > 0 && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  {locations.map((l, i) => (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: LOC_COLORS[i % LOC_COLORS.length] }} />
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>{l.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', marginBottom: '8px' }}>
                {DAYS.map(d => (
                  <div key={d} style={{ padding: '6px 4px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: 'var(--surface-border)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
                {cells.map((cell, i) => {
                  if (!cell) return <div key={i} style={{ background: 'var(--surface-bg)', minHeight: '100px' }} />
                  const key = dateKey(cell)
                  const dayShifts = shiftsByDate[key] ?? []
                  const isToday = cell.toDateString() === today.toDateString()
                  const isPast = cell < today && !isToday
                  const holidayName = holidayByDay.get(key) ?? null

                  return (
                    <div key={i} className="shift-cal-cell" style={{
                      background: holidayName ? '#fef9f0' : isPast ? 'var(--surface-bg)' : 'var(--surface-card)',
                      minHeight: '100px', padding: '7px 6px',
                      position: 'relative',
                    }}>
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '3px',
                        background: isToday ? TEAL : 'transparent',
                        color: isToday ? 'white' : isPast ? 'var(--text-faint)' : 'var(--text-secondary)',
                        fontSize: '12px', fontWeight: isToday ? 700 : 500,
                        boxShadow: isToday ? '0 2px 8px rgba(0,172,193,0.3)' : 'none',
                      }}>
                        {cell.getDate()}
                      </div>

                      {holidayName && (
                        <div style={{
                          fontSize: '9.5px', fontWeight: 600, color: '#92400e',
                          background: '#fde68a', borderRadius: '3px',
                          padding: '1px 4px', marginBottom: '3px',
                          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                        }} title={holidayName}>
                          🏖 {holidayName}
                        </div>
                      )}

                      {dayShifts.slice(0, 2).map(s => {
                        const color = locationColor(s.location_id, locations)
                        const filled = s.assignments.length
                        const needed = s.required_count
                        const isSelected = selectedId === s.id
                        return (
                          <div
                            key={s.id}
                            onClick={() => setSelectedId(isSelected ? null : s.id)}
                            className="shift-chip"
                            style={{
                              marginBottom: '3px', padding: '3px 6px', borderRadius: '5px',
                              background: isSelected ? NAVY : `${color}15`,
                              borderLeft: `2.5px solid ${isSelected ? 'rgba(255,255,255,0.4)' : color}`,
                              cursor: 'pointer',
                            }}
                          >
                            <p style={{ fontSize: '11px', fontWeight: 600, color: isSelected ? 'white' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.name}
                            </p>
                            <p style={{ fontSize: '10px', color: isSelected ? 'rgba(255,255,255,0.65)' : 'var(--text-muted)' }}>
                              {fmtTime(s.start_time)} · {filled}/{needed}
                            </p>
                          </div>
                        )
                      })}
                      {dayShifts.length > 2 && (
                        <p style={{ fontSize: '10px', color: 'var(--teal)', fontWeight: 600, paddingLeft: '4px', opacity: 0.8 }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['upcoming', 'past'] as const).map(f => (
                    <button key={f} onClick={() => setListFilter(f)} className="shift-view-toggle-btn" style={{
                      padding: '6px 16px', borderRadius: '7px', cursor: 'pointer',
                      background: listFilter === f ? TEAL : 'var(--surface-card)',
                      color: listFilter === f ? 'white' : 'var(--text-secondary)',
                      border: listFilter === f ? 'none' : '1px solid var(--surface-border)',
                      fontSize: '13px', fontWeight: 600,
                      boxShadow: listFilter === f ? '0 2px 8px rgba(0,172,193,0.2)' : 'none',
                    }}>
                      {t(f)}
                    </button>
                  ))}
                </div>
                {categories.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setListCategoryFilter('')}
                      className="shift-view-toggle-btn"
                      style={{
                        padding: '6px 14px', borderRadius: '7px', cursor: 'pointer',
                        background: listCategoryFilter === '' ? NAVY : 'var(--surface-card)',
                        color: listCategoryFilter === '' ? 'white' : 'var(--text-secondary)',
                        border: listCategoryFilter === '' ? 'none' : '1px solid var(--surface-border)',
                        fontSize: '12px', fontWeight: 600,
                      }}
                    >
                      {t('all_categories')}
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat.slug}
                        onClick={() => setListCategoryFilter(listCategoryFilter === cat.slug ? '' : cat.slug)}
                        className="shift-view-toggle-btn"
                        style={{
                          padding: '6px 14px', borderRadius: '7px', cursor: 'pointer',
                          background: listCategoryFilter === cat.slug ? (CAT_COLORS[cat.slug] ?? NAVY) : 'var(--surface-card)',
                          color: listCategoryFilter === cat.slug ? 'white' : 'var(--text-secondary)',
                          border: listCategoryFilter === cat.slug ? 'none' : '1px solid var(--surface-border)',
                          fontSize: '12px', fontWeight: 600,
                        }}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {listShifts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px 0' }}>
                  <Calendar style={{ width: '32px', height: '32px', color: 'var(--surface-border)', margin: '0 auto 10px' }} />
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>{t('no_shifts')} ({t(listFilter)})</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-faint)', marginTop: '4px' }}>
                    {listFilter === 'upcoming' ? t('create_shift') : t('past')}
                  </p>
                </div>
              ) : (
                <div style={{ background: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--surface-border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-bg)' }}>
                        {[t('new_shift'), t('shift_date'), t('shift_time'), t('shift_location'), t('categories'), t('assign_volunteers'), ''].map(h => (
                          <th key={h} style={{
                            padding: '10px 20px', textAlign: 'left',
                            fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)',
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                            borderBottom: '1px solid var(--surface-border-sub)',
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
                            className="shift-list-row"
                            style={{
                              borderTop: i === 0 ? 'none' : '1px solid var(--surface-border-sub)',
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(0,172,193,0.04)' : 'var(--surface-card)',
                            }}
                          >
                            <td style={{ padding: '13px 20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '3px', height: '30px', borderRadius: '2px', background: color, flexShrink: 0 }} />
                                <div>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span>
                                  {s.recurrence_rule && (
                                    <span style={{
                                      marginLeft: '7px', fontSize: '10px', fontWeight: 700,
                                      padding: '1px 6px', borderRadius: '4px',
                                      background: '#ede9fe', color: '#6d28d9',
                                    }}>
                                      ↻ {s.recurrence_rule === 'biweekly' ? 'Biweekly' : s.recurrence_rule.charAt(0).toUpperCase() + s.recurrence_rule.slice(1)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '13px 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                              {fmtDate(s.start_time)}
                            </td>
                            <td style={{ padding: '13px 20px', fontSize: '13px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                              {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                            </td>
                            <td style={{ padding: '13px 20px' }}>
                              {s.location_name
                                ? <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '99px', background: `${color}15`, color, fontWeight: 600 }}>{s.location_name}</span>
                                : <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>—</span>
                              }
                            </td>
                            <td style={{ padding: '13px 20px' }}>
                              {s.required_categories.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '160px' }}>
                                  {s.required_categories.map(slug => (
                                    <span key={slug} style={{
                                      fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '99px',
                                      background: `${CAT_COLORS[slug] ?? '#6b7280'}18`, color: CAT_COLORS[slug] ?? '#6b7280',
                                    }}>
                                      {categoryBySlug[slug] ?? slug}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{t('all_categories')}</span>
                              )}
                            </td>
                            <td style={{ padding: '13px 20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                <div style={{ width: '56px', height: '4px', borderRadius: '99px', background: 'var(--surface-border)', overflow: 'hidden' }}>
                                  <div style={{
                                    height: '100%', borderRadius: '99px',
                                    background: filled >= s.required_count ? '#22c55e' : TEAL,
                                    width: `${Math.min(100, (filled / s.required_count) * 100)}%`,
                                    transition: 'width 0.3s',
                                  }} />
                                </div>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{filled}/{s.required_count}</span>
                              </div>
                            </td>
                            <td style={{ padding: '13px 12px', textAlign: 'right' }}>
                              <span className="shift-list-arrow" style={{ color: 'var(--text-faint)', fontSize: '15px' }}>→</span>
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

          {/* ── Week view ──────────────────────────────────────── */}
          {view === 'week' && (
            <div style={{ background: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--surface-border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderBottom: '1px solid var(--surface-border-sub)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', border: '1px solid var(--surface-border)', borderRadius: '6px', background: 'white', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <ChevronLeft style={{ width: '14px', height: '14px' }} />
                  </button>
                  <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', border: '1px solid var(--surface-border)', borderRadius: '6px', background: 'white', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <ChevronRight style={{ width: '14px', height: '14px' }} />
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(weekStart)}
                    {' – '}
                    {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(weekStart.getTime() + 6 * 86400000))}
                  </span>
                </div>
                <button onClick={() => { const now = new Date(); const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d.setDate(d.getDate() - d.getDay()); setWeekStart(d) }} style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px', border: '1px solid var(--surface-border)', borderRadius: '6px', background: 'white', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  {t('today')}
                </button>
              </div>
              <CalendarWeekView
                weekStart={weekStart}
                shifts={shifts}
                onSelectShift={id => setSelectedId(id)}
                holidays={holidays ?? []}
              />
            </div>
          )}

          {/* ── Day view ───────────────────────────────────────── */}
          {view === 'day' && (
            <div style={{ background: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--surface-border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderBottom: '1px solid var(--surface-border-sub)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <button onClick={() => { const d = new Date(selectedDayView); d.setDate(d.getDate() - 1); setSelectedDayView(d) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', border: '1px solid var(--surface-border)', borderRadius: '6px', background: 'white', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <ChevronLeft style={{ width: '14px', height: '14px' }} />
                  </button>
                  <button onClick={() => { const d = new Date(selectedDayView); d.setDate(d.getDate() + 1); setSelectedDayView(d) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', border: '1px solid var(--surface-border)', borderRadius: '6px', background: 'white', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <ChevronRight style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
                <button onClick={() => { const now = new Date(); setSelectedDayView(new Date(now.getFullYear(), now.getMonth(), now.getDate())) }} style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px', border: '1px solid var(--surface-border)', borderRadius: '6px', background: 'white', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  {t('today')}
                </button>
              </div>
              <CalendarDayView
                day={selectedDayView}
                shifts={shifts}
                onSelectShift={id => setSelectedId(id)}
                holidays={holidays ?? []}
              />
            </div>
          )}
        </div>

        {/* ── Right: Roster panel ───────────────────────────────── */}
        {selected && (
          <div style={{
            width: '368px', borderLeft: '1px solid var(--surface-border)',
            background: 'var(--surface-card)', overflowY: 'auto', flexShrink: 0,
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Panel header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--surface-border-sub)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ flex: 1, marginRight: '8px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.2px', lineHeight: 1.3 }}>{selected.name}</h3>
                  {selected.recurrence_rule && (
                    <span style={{
                      display: 'inline-block', marginTop: '4px',
                      fontSize: '10px', fontWeight: 700,
                      padding: '2px 7px', borderRadius: '4px',
                      background: '#ede9fe', color: '#6d28d9',
                    }}>
                      ↻ {selected.recurrence_rule === 'biweekly' ? 'Biweekly' : selected.recurrence_rule.charAt(0).toUpperCase() + selected.recurrence_rule.slice(1)} recurring
                    </span>
                  )}
                </div>
                <button onClick={() => { setSelectedId(null); setShowAssign(false); setPendingTrainee(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: '2px', borderRadius: '4px' }}>
                  <X style={{ width: '16px', height: '16px' }} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <Clock style={{ width: '12px', height: '12px', color: 'var(--teal)', flexShrink: 0 }} />
                  {fmtDate(selected.start_time)} · {fmtTime(selected.start_time)}–{fmtTime(selected.end_time)}
                </span>
                {selected.location_name && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <MapPin style={{ width: '12px', height: '12px', color: 'var(--teal)', flexShrink: 0 }} />
                    {selected.location_name}
                  </span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <Users style={{ width: '12px', height: '12px', color: 'var(--teal)', flexShrink: 0 }} />
                  {selected.assignments.length} / {selected.required_count} {t('spots_open')}
                </span>
                {selected.required_categories.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                    {selected.required_categories.map(slug => (
                      <span key={slug} style={{
                        fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '99px',
                        background: `${CAT_COLORS[slug] ?? '#6b7280'}18`, color: CAT_COLORS[slug] ?? '#6b7280',
                      }}>
                        {categoryBySlug[slug] ?? slug}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ marginTop: '12px', height: '4px', background: 'var(--surface-border)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '99px', transition: 'width 0.3s',
                  background: selected.assignments.length >= selected.required_count ? '#22c55e' : TEAL,
                  width: `${Math.min(100, (selected.assignments.length / selected.required_count) * 100)}%`,
                }} />
              </div>
            </div>

            {/* Roster list */}
            <div style={{ flex: 1, padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {t('assign_volunteers')}
                </span>
                {!pendingTrainee && (
                  <button
                    onClick={() => { setShowAssign(!showAssign); setAssignSearch('') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      background: showAssign ? 'rgba(0,172,193,0.08)' : 'none',
                      border: showAssign ? '1px solid rgba(0,172,193,0.2)' : '1px solid transparent',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px', color: TEAL, fontWeight: 600, padding: '3px 8px',
                      transition: 'background 0.1s',
                    }}
                  >
                    <UserPlus style={{ width: '12px', height: '12px' }} />
                    {t('assign_btn')}
                  </button>
                )}
              </div>

              {/* ── Step 1: Pick volunteer ── */}
              {showAssign && !pendingTrainee && (
                <div style={{ marginBottom: '12px', background: 'var(--surface-bg)', borderRadius: '8px', border: '1px solid var(--surface-border)', overflow: 'hidden' }}>
                  <div style={{ position: 'relative', padding: '8px' }}>
                    <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '13px', height: '13px', color: '#9ca3af' }} />
                    <input
                      style={{ ...inputStyle, paddingLeft: '28px' }}
                      placeholder={t('search_volunteers')}
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
                          className="shift-assign-item"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 12px', cursor: 'pointer',
                          }}
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
                                {t('select_mentor')} …
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {assignableVolunteers.length === 0 && (
                      <p style={{ fontSize: '12px', color: '#9ca3af', padding: '12px', textAlign: 'center' }}>
                        {assignSearch ? t('no_results') : t('assign_volunteers')}
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
                        {t('select_mentor')} {pendingTrainee.first_name} {pendingTrainee.last_name}
                      </p>
                      <p style={{ fontSize: '11px', color: '#b45309' }}>{t('trainee_label')}</p>
                    </div>
                  </div>
                  <div style={{ position: 'relative', padding: '8px' }}>
                    <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '13px', height: '13px', color: '#9ca3af' }} />
                    <input
                      style={{ ...inputStyle, paddingLeft: '28px' }}
                      placeholder={t('search_volunteers')}
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
                        {mentorSearch ? t('no_results') : t('no_eligible_mentors')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Assigned volunteers list */}
              {selected.assignments.length === 0 && !showAssign && !pendingTrainee ? (
                <div style={{ padding: '28px 0', textAlign: 'center' }}>
                  <Users style={{ width: '26px', height: '26px', color: 'var(--surface-border)', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>{t('no_shifts')}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '3px' }}>{t('assign_volunteers')}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {selected.assignments.map(a => {
                    const color = CAT_COLORS[a.volunteer.category] ?? '#6b7280'
                    const te = a.time_entry
                    const isClockedIn  = te && !te.clock_out
                    const isClockedOut = te && te.clock_out
                    const isTrainee    = a.volunteer.pipeline_phase === 'training'
                    const mentorVol    = a.mentor_id ? volunteerById[a.mentor_id] : null
                    return (
                      <div key={a.id} className="shift-roster-card" style={{
                        padding: '10px 12px', borderRadius: '9px',
                        border: `1px solid ${isClockedIn ? '#bbf7d0' : isTrainee ? '#fde68a' : 'var(--surface-border-sub)'}`,
                        background: isClockedIn ? '#f0fdf4' : isTrainee ? '#fffcf0' : 'var(--surface-card)',
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
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
                                <GraduationCap style={{ width: '10px', height: '10px' }} /> {t('trainee_label')}
                              </span>
                            )}
                          </div>
                          {/* Mentor line */}
                          {isTrainee && mentorVol && (
                            <p style={{ fontSize: '11px', color: '#92400e', marginTop: '2px' }}>
                              {t('select_mentor')} {mentorVol.first_name} {mentorVol.last_name}
                            </p>
                          )}
                          {isTrainee && !mentorVol && (
                            <p style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>
                              ⚠ {t('no_eligible_mentors')}
                            </p>
                          )}
                          {isClockedIn && (
                            <p style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>
                              {t('clocked_in')} {fmtTime(te.clock_in)}
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
                              className="shift-clock-btn"
                              style={{
                                padding: '5px 8px', borderRadius: '6px',
                                border: '1px solid #bbf7d0', background: '#f0fdf4',
                                cursor: 'pointer', color: '#16a34a',
                                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600,
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
                              className="shift-clock-btn"
                              style={{
                                padding: '5px 8px', borderRadius: '6px',
                                border: '1px solid #fecaca', background: '#fef2f2',
                                cursor: 'pointer', color: '#dc2626',
                                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600,
                              }}
                            >
                              <LogOut style={{ width: '11px', height: '11px' }} /> Out
                            </button>
                          )}
                          {removeConfirmId === a.id ? (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <button
                                onClick={() => handleRemoveAssignment(a.id)}
                                disabled={isPending}
                                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fef2f2', cursor: 'pointer', color: '#dc2626', fontSize: '11px', fontWeight: 600 }}
                              >
                                Remove
                              </button>
                              <button
                                onClick={() => setRemoveConfirmId(null)}
                                style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid var(--surface-border-sub)', background: 'transparent', cursor: 'pointer', color: 'var(--text-faint)' }}
                              >
                                <X style={{ width: '11px', height: '11px' }} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setRemoveConfirmId(a.id)}
                              title="Unassign volunteer"
                              style={{ padding: '5px 6px', borderRadius: '6px', border: '1px solid var(--surface-border-sub)', background: 'transparent', cursor: 'pointer', color: 'var(--text-faint)', transition: 'color 0.1s, border-color 0.1s' }}
                            >
                              <X style={{ width: '11px', height: '11px' }} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Open slots */}
                  {Array.from({ length: Math.max(0, selected.required_count - selected.assignments.length) }).map((_, i) => (
                    <div key={`open-${i}`} style={{
                      padding: '10px 12px', borderRadius: '9px',
                      border: '1.5px dashed var(--surface-border)',
                      background: 'var(--surface-bg)',
                      display: 'flex', alignItems: 'center', gap: '10px',
                    }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        border: '1.5px dashed var(--surface-border)', background: 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Plus style={{ width: '11px', height: '11px', color: 'var(--text-faint)' }} />
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-faint)', fontStyle: 'italic' }}>{t('spot_open')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--surface-border-sub)', display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleDelete(selected.id)}
                style={{
                  padding: '7px 12px', borderRadius: '7px',
                  border: '1px solid #fecaca', background: 'transparent', cursor: 'pointer',
                  color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <Trash2 style={{ width: '12px', height: '12px' }} /> {t('delete_shift')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Shift Modal ──────────────────────────────────── */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(10,15,30,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, backdropFilter: 'blur(2px)',
        }}>
          <div style={{
            background: 'var(--surface-card)', borderRadius: '16px',
            padding: '28px', width: '100%', maxWidth: '490px',
            boxShadow: '0 24px 64px rgba(10,15,30,0.2), 0 4px 16px rgba(10,15,30,0.1)',
            border: '1px solid var(--surface-border)',
            maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.2px' }}>{t('new_shift')}</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{t('create_shift')}</p>
              </div>
              <button onClick={() => { setShowCreate(false); setCreateForm(EMPTY_CREATE); setCreateVolunteerIds(new Set()); setCreateVolSearch(''); setIsRecurring(false); setRecurFrequency('weekly'); setRecurEndDate('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: '4px', borderRadius: '6px' }}>
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('shift_name')} *</label>
                <input style={inputStyle} value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Saturday Morning Clinic" autoFocus />
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('shift_location')}</label>
                <select style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }} value={createForm.location_id} onChange={e => setCreateForm(f => ({ ...f, location_id: e.target.value }))}>
                  <option value="">No location</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('start_date')} *</label>
                  <input style={inputStyle} type="date" value={createForm.start_date} onChange={e => setCreateForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('start_time')} *</label>
                  <input style={inputStyle} type="time" value={createForm.start_time} onChange={e => { if (e.target.value) setCreateForm(f => ({ ...f, start_time: e.target.value })) }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {isRecurring ? t('end_date_occurrence') : t('end_date')} *
                  </label>
                  <input style={inputStyle} type="date" value={createForm.end_date} onChange={e => setCreateForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {isRecurring ? t('end_time_occurrence') : t('end_time')} *
                  </label>
                  <input style={inputStyle} type="time" value={createForm.end_time} onChange={e => { if (e.target.value) setCreateForm(f => ({ ...f, end_time: e.target.value })) }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('required_volunteers')}</label>
                <input style={inputStyle} type="number" min="1" value={createForm.required_count} onChange={e => setCreateForm(f => ({ ...f, required_count: e.target.value }))} />
              </div>

              {categories.length > 0 && (
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {t('categories')} <span style={{ fontWeight: 400, textTransform: 'none' }}>(leave empty for all)</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {categories.map(c => {
                      const checked = createForm.required_categories.includes(c.slug)
                      return (
                        <button
                          key={c.slug}
                          type="button"
                          onClick={() => setCreateForm(f => ({
                            ...f,
                            required_categories: checked
                              ? f.required_categories.filter(s => s !== c.slug)
                              : [...f.required_categories, c.slug],
                          }))}
                          style={{
                            fontSize: '12px', fontWeight: 500,
                            padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                            border: `1.5px solid ${checked ? (CAT_COLORS[c.slug] ?? TEAL) : 'var(--surface-border)'}`,
                            background: checked ? `${(CAT_COLORS[c.slug] ?? TEAL)}22` : 'transparent',
                            color: checked ? (CAT_COLORS[c.slug] ?? TEAL) : 'var(--text-secondary)',
                          }}
                        >
                          {c.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('shift_notes')}</label>
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '56px', lineHeight: 1.5 }} value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('shift_notes')} />
              </div>

              {/* Repeat toggle */}
              <div style={{ borderTop: '1px solid var(--surface-border-sub)', paddingTop: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: isRecurring ? '10px' : 0 }}>
                  <div
                    onClick={() => setIsRecurring(p => !p)}
                    style={{
                      width: '36px', height: '20px', borderRadius: '10px',
                      background: isRecurring ? TEAL : '#d1d5db',
                      position: 'relative', flexShrink: 0, cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: '2px',
                      left: isRecurring ? '18px' : '2px',
                      width: '16px', height: '16px', borderRadius: '50%',
                      background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      transition: 'left 0.2s',
                    }} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {t('repeat_frequency')}
                  </span>
                </label>
                {isRecurring && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('recurring_shift')}</label>
                      <select
                        style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer' }}
                        value={recurFrequency}
                        onChange={e => setRecurFrequency(e.target.value as 'weekly' | 'biweekly' | 'monthly')}
                      >
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Every 2 weeks</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-faint)', display: 'block', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('end_date_optional')}</label>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '5px' }}>{t('series_end_date_hint')}</p>
                      <input type="date" style={inputStyle} value={recurEndDate} onChange={e => setRecurEndDate(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              {/* Volunteer picker */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {t('assign_volunteers')}
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
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#00ACC1' }}
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
                    placeholder={t('search_volunteers')}
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
                      <div style={{ padding: '10px 12px', fontSize: '12px', color: '#9ca3af' }}>{t('no_results')}</div>
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

            <div style={{ display: 'flex', gap: '8px', marginTop: '22px', paddingTop: '18px', borderTop: '1px solid var(--surface-border-sub)' }}>
              {(!createForm.name || !createForm.start_date || !createForm.start_time || !createForm.end_date || !createForm.end_time) && (
                <p style={{ fontSize: '11px', color: '#ef4444', marginBottom: '2px' }}>
                  {!createForm.name ? 'Shift name is required.' :
                   !createForm.start_date || !createForm.start_time ? 'Start date and time are required.' :
                   'End date and time are required.'}
                </p>
              )}
              <button className="shift-new-btn" style={btnPrimary} onClick={handleCreate} disabled={!createForm.name || !createForm.start_date || !createForm.start_time || !createForm.end_date || !createForm.end_time || isPending}>
                {isRecurring ? t('recurring_shift') : t('create_shift')}
              </button>
              <button style={btnSecondary} onClick={() => { setShowCreate(false); setCreateForm(EMPTY_CREATE); setCreateVolunteerIds(new Set()); setCreateVolSearch(''); setIsRecurring(false); setRecurFrequency('weekly'); setRecurEndDate('') }}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
