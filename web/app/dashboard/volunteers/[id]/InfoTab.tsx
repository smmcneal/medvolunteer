'use client'

import { useState } from 'react'
import type { Location, OrgTag, Category } from '@/types/database'
import type { VolunteerDetail } from './page'
import TagsPanel from './TagsPanel'
import { updateVolunteerInfo, updateVolunteerLocations } from './actions'

const STATUS_LABELS: Record<string, string> = {
  applicant: 'Applicant',
  prospect:  'Prospect',
  volunteer: 'Volunteer',
  inactive:  'Inactive',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditState {
  first_name: string
  last_name: string
  email: string
  phone: string
  category: string
  volunteer_categories: string[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InfoTab({
  volunteer: initialVolunteer,
  appliedTags,
  orgTags,
  orgLocations = [],
  categories = [],
}: {
  volunteer: VolunteerDetail
  appliedTags: OrgTag[]
  orgTags: OrgTag[]
  orgLocations?: Pick<Location, 'id' | 'name'>[]
  categories?: Category[]
}) {
  // Local copy of mutable fields so saves reflect immediately
  const [v, setV] = useState(initialVolunteer)

  const [editing, setEditing]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [saved, setSaved]             = useState(false)
  const [form, setForm]               = useState<EditState>(makeForm(v))
  const [editLocationIds, setEditLocationIds] = useState<string[]>([])

  function makeForm(vol: VolunteerDetail): EditState {
    const cats: string[] = (vol as any).volunteer_categories?.length
      ? (vol as any).volunteer_categories as string[]
      : [vol.category]
    return {
      first_name:           vol.first_name,
      last_name:            vol.last_name,
      email:                vol.email,
      phone:                vol.phone ?? '',
      category:             cats[0],
      volunteer_categories: cats,
    }
  }

  function toggleCategory(slug: string) {
    setForm(prev => {
      const has = prev.volunteer_categories.includes(slug)
      if (has && prev.volunteer_categories.length === 1) return prev // require at least one
      const next = has
        ? prev.volunteer_categories.filter(c => c !== slug)
        : [...prev.volunteer_categories, slug]
      return { ...prev, volunteer_categories: next, category: next[0] }
    })
  }

  function startEdit() {
    setForm(makeForm(v))
    setEditLocationIds(v.locations.map(l => l.id))
    setError(null)
    setSaved(false)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setError(null)
  }

  function toggleLocation(id: string) {
    setEditLocationIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const [infoResult, locResult] = await Promise.all([
      updateVolunteerInfo(v.id, { ...form, volunteer_categories: form.volunteer_categories }),
      updateVolunteerLocations(v.id, editLocationIds),
    ])

    setSaving(false)
    if (infoResult.error) { setError(infoResult.error); return }
    if (locResult.error)  { setError(locResult.error);  return }

    // Optimistic update: rebuild location objects from orgLocations
    const newLocations = orgLocations
      .filter(l => editLocationIds.includes(l.id))
      .map(l => ({ ...l, org_id: '', address: null, lat: null, lng: null, geofence_radius_meters: 0, is_active: true, created_at: '' })) as Location[]

    setV(prev => ({
      ...prev,
      first_name: form.first_name.trim(),
      last_name:  form.last_name.trim(),
      email:      form.email.trim().toLowerCase(),
      phone:      form.phone.trim() || null,
      category:   form.volunteer_categories[0] ?? form.category,
      locations:  newLocations,
    }))
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function field(key: keyof EditState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Header row with Edit / Save / Cancel ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Volunteer Details
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {saved && !editing && (
            <span style={{ fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckIcon /> Saved
            </span>
          )}
          {editing ? (
            <>
              <button
                onClick={cancelEdit}
                style={{
                  padding: '6px 14px', borderRadius: '7px',
                  border: '1px solid #e5e7eb', background: 'white',
                  fontSize: '13px', color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '6px 14px', borderRadius: '7px', border: 'none',
                  background: saving ? '#9ca3af' : '#1B2A4A',
                  color: 'white', fontSize: '13px', fontWeight: 600,
                  cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                {saving ? <><MiniSpinner />Saving…</> : 'Save changes'}
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              style={{
                padding: '6px 14px', borderRadius: '7px',
                border: '1px solid #e5e7eb', background: 'white',
                fontSize: '13px', fontWeight: 600, color: '#374151',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: '5px',
              }}
            >
              <PencilIcon /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px',
          background: '#fef2f2', border: '1px solid #fecaca',
          fontSize: '13px', color: '#dc2626',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
        }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0, fontSize: '16px', lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* ── Fields grid ── */}
      {editing ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <EditField label="First Name" value={form.first_name} onChange={v => field('first_name', v)} required />
          <EditField label="Last Name"  value={form.last_name}  onChange={v => field('last_name', v)}  required />
          <EditField label="Email"      value={form.email}      onChange={v => field('email', v)}      type="email" required />
          <EditField label="Phone"      value={form.phone}      onChange={v => field('phone', v)}      type="tel" />
          {/* Category multi-select — spans full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>
              Category <span style={{ fontSize: '10px', fontWeight: 400, color: '#d1d5db' }}>(select all that apply)</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '2px' }}>
              {categories.map(o => {
                const checked = form.volunteer_categories.includes(o.slug)
                return (
                  <button
                    key={o.slug}
                    type="button"
                    onClick={() => toggleCategory(o.slug)}
                    style={{
                      padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
                      fontSize: '13px', fontWeight: 600, border: '1.5px solid',
                      borderColor: checked ? '#1B2A4A' : '#e5e7eb',
                      background: checked ? '#1B2A4A' : 'white',
                      color: checked ? 'white' : '#374151',
                      transition: 'all 0.15s',
                      fontFamily: 'inherit',
                    }}
                  >
                    {o.name}
                  </button>
                )
              })}
            </div>
          </div>
          {/* Status — read-only, controlled by pipeline */}
          <ReadonlyField label="Status" value={STATUS_LABELS[v.status] ?? v.status} hint="Managed via Pipeline tab" />
          <ReadonlyField label="Emergency Contact" value={v.emergency_contact_name ?? '—'}  hint="Set by volunteer" />
          <ReadonlyField label="Emergency Phone"   value={v.emergency_contact_phone ?? '—'} hint="Set by volunteer" />
          {/* Location multi-select — spans full width */}
          {orgLocations.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Location(s)</label>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '8px',
                padding: '10px 12px', borderRadius: '8px',
                border: '1.5px solid #e5e7eb', background: 'white', minHeight: '44px',
              }}>
                {orgLocations.map(loc => {
                  const checked = editLocationIds.includes(loc.id)
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => toggleLocation(loc.id)}
                      style={{
                        padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
                        fontSize: '13px', fontWeight: 500, border: '1.5px solid',
                        borderColor: checked ? '#1B2A4A' : '#e5e7eb',
                        background: checked ? '#1B2A4A' : 'white',
                        color: checked ? 'white' : '#6b7280',
                        transition: 'all 0.15s',
                        fontFamily: 'inherit',
                      }}
                    >
                      {loc.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {[
            { label: 'First Name',        value: v.first_name },
            { label: 'Last Name',         value: v.last_name },
            { label: 'Email',             value: v.email },
            { label: 'Phone',             value: v.phone ?? '—' },
            { label: 'Status',            value: STATUS_LABELS[v.status] ?? v.status },
            { label: 'Emergency Contact', value: v.emergency_contact_name ?? '—' },
            { label: 'Emergency Phone',   value: v.emergency_contact_phone ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              padding: '14px 16px', background: '#fafafa', borderRadius: '8px',
              border: '1px solid #f3f4f6',
            }}>
              <p style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {label}
              </p>
              <p style={{ fontSize: '14px', color: '#111827', fontWeight: 500 }}>{value}</p>
            </div>
          ))}
          {/* Categories — full width */}
          <div style={{ gridColumn: '1 / -1', padding: '14px 16px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
            <p style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {((v as any).volunteer_categories?.length ?? 0) > 1 ? 'Categories' : 'Category'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {((v as any).volunteer_categories?.length
                ? (v as any).volunteer_categories as string[]
                : [v.category]
              ).map((cat: string) => (
                <span key={cat} style={{ fontSize: '13px', fontWeight: 500, padding: '3px 10px', borderRadius: '6px', background: '#1B2A4A1a', color: '#1B2A4A', border: '1px solid #1B2A4A33' }}>
                  {categories.find(o => o.slug === cat)?.name ?? cat}
                </span>
              ))}
            </div>
          </div>
          {/* Locations — full-width row */}
          <div style={{
            gridColumn: '1 / -1',
            padding: '14px 16px', background: '#fafafa', borderRadius: '8px',
            border: '1px solid #f3f4f6',
          }}>
            <p style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Location(s)
            </p>
            {v.locations.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 500 }}>—</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {v.locations.map(loc => (
                  <span key={loc.id} style={{
                    fontSize: '13px', fontWeight: 500,
                    padding: '3px 10px', borderRadius: '20px',
                    background: '#1B2A4A1a', color: '#1B2A4A',
                    border: '1px solid #1B2A4A33',
                  }}>
                    {loc.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tags ── */}
      <div>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
          Tags
        </p>
        <TagsPanel volunteerId={v.id} appliedTags={appliedTags} orgTags={orgTags} />
      </div>

    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1.5px solid #e5e7eb',
  fontSize: '14px',
  color: '#111827',
  background: 'white',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
}

function EditField({
  label, value, onChange, type = 'text', required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label style={labelStyle}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
        onFocus={e => (e.currentTarget.style.borderColor = '#00897B')}
        onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
      />
    </div>
  )
}

function ReadonlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{
        padding: '10px 12px', borderRadius: '8px',
        border: '1.5px solid #f3f4f6', background: '#fafafa',
        fontSize: '14px', color: '#6b7280',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>{value}</span>
        {hint && <span style={{ fontSize: '11px', color: '#d1d5db', marginLeft: '8px' }}>{hint}</span>}
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function MiniSpinner() {
  return (
    <svg style={{ animation: 'spin 0.85s linear infinite' }} width="13" height="13" viewBox="0 0 24 24" fill="none">
      <style suppressHydrationWarning>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}
