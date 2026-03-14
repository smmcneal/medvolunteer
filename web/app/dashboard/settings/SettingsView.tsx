'use client'

import { useState, useTransition } from 'react'
import type { Organization, Location } from '@/types/database'
import {
  updateOrgProfile,
  updateOrgSettings,
  createLocation,
  updateLocation,
  deleteLocation,
} from './actions'

type Tab = 'profile' | 'locations' | 'integrations'

interface OrgSettings {
  checkr_api_key?: string
  twilio_account_sid?: string
  twilio_auth_token?: string
  twilio_from_number?: string
  resend_api_key?: string
  docusign_client_id?: string
  docusign_account_id?: string
  vapid_public_key?: string
  vapid_private_key?: string
  vapid_subject?: string
}

interface Props {
  org: Organization | null
  locations: Location[]
}

export default function SettingsView({ org, locations: initialLocations }: Props) {
  const [tab, setTab] = useState<Tab>('profile')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #f0f0f0',
        background: 'white',
        padding: '0 32px',
        flexShrink: 0,
      }}>
        {([
          { key: 'profile', label: '🏢 Org Profile' },
          { key: 'locations', label: '📍 Locations' },
          { key: 'integrations', label: '🔗 Integrations' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '12px 20px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              borderBottom: tab === t.key ? '2px solid #1B2A4A' : '2px solid transparent',
              cursor: 'pointer',
              background: 'transparent',
              color: tab === t.key ? '#1B2A4A' : '#9ca3af',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px', maxWidth: '680px' }}>
        {tab === 'profile' && <ProfileTab org={org} />}
        {tab === 'locations' && <LocationsTab locations={initialLocations} />}
        {tab === 'integrations' && <IntegrationsTab settings={(org?.settings as OrgSettings) ?? {}} />}
      </div>
    </div>
  )
}

// ─── Org Profile Tab ──────────────────────────────────────────────────────────

function ProfileTab({ org }: { org: Organization | null }) {
  const [name, setName] = useState(org?.name ?? '')
  const [logoUrl, setLogoUrl] = useState(org?.logo_url ?? '')
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await updateOrgProfile({ name: name.trim(), logo_url: logoUrl.trim() || null })
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to save')
      }
    })
  }

  return (
    <div>
      <SectionHeader title="Organization Profile" desc="Your organization's name and branding" />

      {error && <ErrorBanner msg={error} />}
      {saved && <SuccessBanner msg="Profile saved successfully" />}

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', marginBottom: '20px' }}>
        {/* Logo preview */}
        <div style={{
          width: '80px', height: '80px',
          borderRadius: '12px',
          border: '2px solid #e5e7eb',
          overflow: 'hidden',
          flexShrink: 0,
          background: '#f9fafb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '28px',
        }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : '🏥'}
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Organization Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={fieldStyle}
            placeholder="e.g. City General Hospital"
          />
        </div>
      </div>

      <Field
        label="Logo URL"
        hint="Direct URL to your logo image (PNG, SVG, JPG)"
        value={logoUrl}
        onChange={setLogoUrl}
        placeholder="https://example.com/logo.png"
      />

      <SaveButton onClick={handleSave} isPending={isPending} />
    </div>
  )
}

// ─── Locations Tab ────────────────────────────────────────────────────────────

function LocationsTab({ locations: initial }: { locations: Location[] }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(fn: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try { await fn() } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error') }
    })
  }

  return (
    <div>
      <SectionHeader
        title="Locations"
        desc="Physical sites where volunteers work. Coordinates are used for geofence-based auto clock-in/out."
        action={<button onClick={() => setShowAdd(true)} style={primaryBtn}>+ Add Location</button>}
      />

      {error && <ErrorBanner msg={error} />}

      {showAdd && (
        <LocationForm
          onSave={(data) => {
            run(() => createLocation(data))
            setShowAdd(false)
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {initial.length === 0 && !showAdd && (
        <EmptyState icon="📍" msg="No locations yet. Add your first location above." />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {initial.map(loc => (
          <div key={loc.id} style={{
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            overflow: 'hidden',
            background: 'white',
          }}>
            {editingId === loc.id ? (
              <div style={{ padding: '16px' }}>
                <LocationForm
                  location={loc}
                  onSave={(data) => {
                    run(() => updateLocation(loc.id, data))
                    setEditingId(null)
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <div style={{
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: loc.is_active ? '#dcfce7' : '#f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', flexShrink: 0,
                }}>📍</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{loc.name}</p>
                    <span style={{
                      padding: '1px 7px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
                      background: loc.is_active ? '#dcfce7' : '#f3f4f6',
                      color: loc.is_active ? '#15803d' : '#6b7280',
                    }}>{loc.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  {loc.address && (
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>{loc.address}</p>
                  )}
                  {(loc.lat !== null && loc.lng !== null) && (
                    <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} · {loc.geofence_radius_meters}m geofence
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button
                    onClick={() => run(() => updateLocation(loc.id, { is_active: !loc.is_active }))}
                    style={ghostBtnSm}
                  >{loc.is_active ? 'Deactivate' : 'Activate'}</button>
                  <button onClick={() => setEditingId(loc.id)} style={ghostBtnSm}>Edit</button>
                  <button
                    onClick={() => {
                      if (!confirm(`Delete "${loc.name}"?`)) return
                      run(() => deleteLocation(loc.id))
                    }}
                    style={{ ...ghostBtnSm, color: '#dc2626', borderColor: '#fca5a5' }}
                  >✕</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function LocationForm({
  location,
  onSave,
  onCancel,
}: {
  location?: Location
  onSave: (data: {
    name: string
    address: string | null
    lat: number | null
    lng: number | null
    geofence_radius_meters: number
  }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(location?.name ?? '')
  const [address, setAddress] = useState(location?.address ?? '')
  const [lat, setLat] = useState(location?.lat?.toString() ?? '')
  const [lng, setLng] = useState(location?.lng?.toString() ?? '')
  const [radius, setRadius] = useState(location?.geofence_radius_meters?.toString() ?? '100')

  return (
    <div style={{
      background: location ? 'transparent' : '#f9fafb',
      border: location ? 'none' : '1px solid #e5e7eb',
      borderRadius: '10px',
      padding: location ? '0' : '16px',
      marginBottom: '12px',
    }}>
      {!location && (
        <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
          New Location
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Location Name *</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Main Hospital" style={fieldStyle} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Address</label>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, City, State 00000" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Latitude</label>
          <input value={lat} onChange={e => setLat(e.target.value)} placeholder="40.71280" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Longitude</label>
          <input value={lng} onChange={e => setLng(e.target.value)} placeholder="-74.00600" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Geofence Radius (meters)</label>
          <input value={radius} onChange={e => setRadius(e.target.value.replace(/\D/g, ''))} placeholder="100" style={fieldStyle} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <button
            onClick={() => {
              if (!name.trim()) return
              onSave({
                name: name.trim(),
                address: address.trim() || null,
                lat: lat ? parseFloat(lat) : null,
                lng: lng ? parseFloat(lng) : null,
                geofence_radius_meters: parseInt(radius) || 100,
              })
            }}
            disabled={!name.trim()}
            style={primaryBtn}
          >{location ? 'Save Changes' : 'Add Location'}</button>
          <button onClick={onCancel} style={ghostBtnSm}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────

function IntegrationsTab({ settings: initialSettings }: { settings: OrgSettings }) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function saveSection(key: string, data: Record<string, unknown>) {
    setError(null)
    setSaved(null)
    startTransition(async () => {
      try {
        await updateOrgSettings(data)
        setSaved(key)
        setTimeout(() => setSaved(null), 3000)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to save')
      }
    })
  }

  return (
    <div>
      <SectionHeader title="Integrations" desc="API keys are stored encrypted in your organization settings" />

      {error && <ErrorBanner msg={error} />}

      {/* Resend */}
      <IntegrationCard
        name="Resend"
        description="Email delivery for volunteer communications"
        icon="✉"
        color="#000000"
        saved={saved === 'resend'}
        isPending={isPending}
        fields={[
          { label: 'API Key', key: 'resend_api_key', placeholder: 're_xxxxxxxxxxxx', value: initialSettings.resend_api_key ?? '', secret: true },
        ]}
        onSave={(vals) => saveSection('resend', vals)}
        docsUrl="https://resend.com"
      />

      {/* Twilio */}
      <IntegrationCard
        name="Twilio"
        description="SMS messaging for volunteers"
        icon="💬"
        color="#F22F46"
        saved={saved === 'twilio'}
        isPending={isPending}
        fields={[
          { label: 'Account SID', key: 'twilio_account_sid', placeholder: 'ACxxxxxxxxxxxxxxxx', value: initialSettings.twilio_account_sid ?? '' },
          { label: 'Auth Token', key: 'twilio_auth_token', placeholder: 'xxxxxxxxxxxxxxxx', value: initialSettings.twilio_auth_token ?? '', secret: true },
          { label: 'From Number', key: 'twilio_from_number', placeholder: '+15551234567', value: initialSettings.twilio_from_number ?? '' },
        ]}
        onSave={(vals) => saveSection('twilio', vals)}
        docsUrl="https://twilio.com"
      />

      {/* Checkr */}
      <IntegrationCard
        name="Checkr"
        description="Background check provider for volunteer screening"
        icon="🔍"
        color="#1F6AF6"
        saved={saved === 'checkr'}
        isPending={isPending}
        fields={[
          { label: 'API Key', key: 'checkr_api_key', placeholder: 'test_xxxxxxxxxxxx', value: initialSettings.checkr_api_key ?? '', secret: true },
        ]}
        onSave={(vals) => saveSection('checkr', vals)}
        docsUrl="https://checkr.com"
      />

      {/* DocuSign */}
      <IntegrationCard
        name="DocuSign"
        description="E-signature for volunteer documents and agreements"
        icon="✍"
        color="#1A1A2E"
        saved={saved === 'docusign'}
        isPending={isPending}
        fields={[
          { label: 'Client ID (Integration Key)', key: 'docusign_client_id', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', value: initialSettings.docusign_client_id ?? '' },
          { label: 'Account ID', key: 'docusign_account_id', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', value: initialSettings.docusign_account_id ?? '' },
        ]}
        onSave={(vals) => saveSection('docusign', vals)}
        docsUrl="https://developers.docusign.com"
      />

      {/* Web Push / VAPID */}
      <IntegrationCard
        name="Web Push (VAPID)"
        description="Push notifications for the volunteer PWA — required for clock-in alerts and shift reminders"
        icon="🔔"
        color="#6366f1"
        saved={saved === 'vapid'}
        isPending={isPending}
        fields={[
          { label: 'VAPID Public Key', key: 'vapid_public_key', placeholder: 'BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxA==', value: initialSettings.vapid_public_key ?? '' },
          { label: 'VAPID Private Key', key: 'vapid_private_key', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', value: initialSettings.vapid_private_key ?? '', secret: true },
          { label: 'VAPID Subject (mailto: or https:)', key: 'vapid_subject', placeholder: 'mailto:admin@yourdomain.com', value: initialSettings.vapid_subject ?? '' },
        ]}
        onSave={(vals) => saveSection('vapid', vals)}
        docsUrl="https://web.dev/push-notifications-web-push-protocol"
      />
    </div>
  )
}

function IntegrationCard({
  name,
  description,
  icon,
  color,
  fields,
  onSave,
  isPending,
  saved,
  docsUrl,
}: {
  name: string
  description: string
  icon: string
  color: string
  fields: { label: string; key: string; placeholder: string; value: string; secret?: boolean }[]
  onSave: (vals: Record<string, unknown>) => void
  isPending: boolean
  saved: boolean
  docsUrl: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.key, f.value]))
  )
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})

  const isConfigured = fields.some(f => f.value?.length > 0)

  return (
    <div style={{
      border: '1px solid',
      borderColor: expanded ? '#1B2A4A' : '#e5e7eb',
      borderRadius: '10px',
      overflow: 'hidden',
      marginBottom: '12px',
      background: 'white',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(p => !p)}
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          background: expanded ? '#f8f9fc' : 'white',
        }}
      >
        <div style={{
          width: '36px', height: '36px', borderRadius: '8px',
          background: color + '12',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', flexShrink: 0,
        }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{name}</p>
            {isConfigured && (
              <span style={{ padding: '1px 7px', borderRadius: '99px', fontSize: '10px', fontWeight: 700, background: '#dcfce7', color: '#15803d' }}>
                ✓ CONFIGURED
              </span>
            )}
          </div>
          <p style={{ fontSize: '12px', color: '#6b7280' }}>{description}</p>
        </div>
        <span style={{ fontSize: '18px', color: '#9ca3af', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>⌄</span>
      </div>

      {/* Fields */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ paddingTop: '14px' }}>
            {fields.map(f => (
              <div key={f.key} style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>{f.label}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={f.secret && !revealed[f.key] ? 'password' : 'text'}
                    value={vals[f.key]}
                    onChange={e => setVals(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ ...fieldStyle, paddingRight: f.secret ? '70px' : '12px' }}
                  />
                  {f.secret && (
                    <button
                      type="button"
                      onClick={() => setRevealed(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                      style={{
                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                        fontSize: '11px', fontWeight: 600, color: '#6b7280',
                        background: 'none', border: 'none', cursor: 'pointer',
                      }}
                    >{revealed[f.key] ? 'Hide' : 'Show'}</button>
                  )}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => onSave(vals)}
                disabled={isPending}
                style={primaryBtn}
              >{isPending ? 'Saving…' : 'Save Credentials'}</button>
              {saved && (
                <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 600 }}>✓ Saved</span>
              )}
              <a
                href={docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '12px', color: '#6b7280', marginLeft: 'auto' }}
              >
                View docs ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionHeader({ title, desc, action }: { title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '3px' }}>{title}</h2>
        <p style={{ fontSize: '13px', color: '#6b7280' }}>{desc}</p>
      </div>
      {action}
    </div>
  )
}

function Field({ label, hint, value, onChange, placeholder }: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={labelStyle}>{label}</label>
      {hint && <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>{hint}</p>}
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={fieldStyle} />
    </div>
  )
}

function SaveButton({ onClick, isPending }: { onClick: () => void; isPending: boolean }) {
  return (
    <button onClick={onClick} disabled={isPending} style={primaryBtn}>
      {isPending ? 'Saving…' : 'Save Changes'}
    </button>
  )
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#dc2626', marginBottom: '16px' }}>
      {msg}
    </div>
  )
}

function SuccessBanner({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '13px', color: '#15803d', marginBottom: '16px' }}>
      ✓ {msg}
    </div>
  )
}

function EmptyState({ icon, msg }: { icon: string; msg: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '40px 20px', fontSize: '13px', color: '#9ca3af',
      border: '2px dashed #e5e7eb', borderRadius: '10px', marginBottom: '12px',
    }}>
      <div style={{ fontSize: '32px', marginBottom: '8px' }}>{icon}</div>
      {msg}
    </div>
  )
}

// ─── Style atoms ───────────────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
  color: '#111827',
  background: 'white',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '5px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: '7px',
  fontSize: '13px',
  fontWeight: 600,
  border: '1px solid #1B2A4A',
  cursor: 'pointer',
  background: '#1B2A4A',
  color: 'white',
}

const ghostBtnSm: React.CSSProperties = {
  padding: '5px 10px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 500,
  border: '1px solid #e5e7eb',
  cursor: 'pointer',
  background: 'white',
  color: '#374151',
}
