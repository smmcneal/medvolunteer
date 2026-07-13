'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Organization, Location, OrgTag, OrgFlag, OrgHoliday, FormAutomationRule, AutoMessageRule, MessageTemplate, CategoryRequirement, CategoryCoordinator, DocumentAutomationRule, Category, AdminUserRow, AdminRole } from '@/types/database'
import {
  updateOrgProfile,
  updateOrgSettings,
  createLocation,
  updateLocation,
  deleteLocation,
  updateCategoryDescriptions,
  addHoliday,
  deleteHoliday,
  bulkAddHolidays,
  saveFormAutomationRule,
  deleteFormAutomationRule,
  saveAutoMessageRule,
  deleteAutoMessageRule,
  toggleAutoMessageRule,
  addCategoryRequirement,
  deleteCategoryRequirement,
  assignCategoryCoordinator,
  removeCategoryCoordinator,
  saveDocumentAutomationRule,
  deleteDocumentAutomationRule,
  addCategory,
  updateCategoryName,
  archiveCategory,
  restoreCategory,
} from './actions'
import TagsManager from './TagsManager'
import FlagsManager from './FlagsManager'
import UsersManager from './UsersManager'
import { useAdminT } from '@/lib/admin-lang'

type Tab = 'profile' | 'locations' | 'integrations' | 'categories' | 'holidays' | 'automation' | 'tags' | 'flags' | 'users'


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
  category_descriptions?: Record<string, string>
  jotform_api_key?: string
  require_hour_approval?: boolean
}

interface Props {
  org: Organization | null
  locations: Location[]
  initialTags: OrgTag[]
  initialFlags: OrgFlag[]
  initialHolidays: OrgHoliday[]
  initialAutomationRules: FormAutomationRule[]
  initialAutoMessageRules: AutoMessageRule[]
  messageTemplates: Pick<MessageTemplate, 'id' | 'name' | 'subject' | 'channel'>[]
  initialCategoryRequirements: CategoryRequirement[]
  initialCoordinators: CategoryCoordinator[]
  activeVolunteers: { id: string; first_name: string; last_name: string }[]
  initialDocRules: DocumentAutomationRule[]
  categories: Category[]
  initialAdminUsers: AdminUserRow[]
  currentUserId: string
  myRole: AdminRole | null
}

export default function SettingsView({ org, locations: initialLocations, initialTags, initialFlags, initialHolidays, initialAutomationRules, initialAutoMessageRules, messageTemplates, initialCategoryRequirements, initialCoordinators, activeVolunteers, initialDocRules, categories, initialAdminUsers, currentUserId, myRole }: Props) {
  const t = useAdminT()
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
          { key: 'profile',      labelKey: 'org_profile' },
          { key: 'locations',    labelKey: 'locations_tab' },
          { key: 'integrations', labelKey: 'integrations_tab' },
          { key: 'categories',   labelKey: 'categories_tab' },
          { key: 'holidays',     labelKey: 'holidays_tab' },
          { key: 'automation',   labelKey: 'automation_tab' },
          { key: 'tags',         labelKey: 'tags_tab' },
          { key: 'flags',        labelKey: 'flags_tab' },
          { key: 'users',        labelKey: 'users_tab' },
        ] as { key: Tab; labelKey: string }[]).map(tabItem => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            style={{
              padding: '12px 20px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              borderBottom: tab === tabItem.key ? '2px solid #1B2A4A' : '2px solid transparent',
              cursor: 'pointer',
              background: 'transparent',
              color: tab === tabItem.key ? '#1B2A4A' : '#9ca3af',
            }}
          >{t(tabItem.labelKey)}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px', maxWidth: '680px' }}>
        {tab === 'profile'      && <ProfileTab org={org} />}
        {tab === 'locations'    && <LocationsTab locations={initialLocations} />}
        {tab === 'integrations' && <IntegrationsTab settings={(org?.settings as OrgSettings) ?? {}} />}
        {tab === 'categories'   && <CategoriesTab descriptions={((org?.settings as OrgSettings)?.category_descriptions) ?? {}} requirements={initialCategoryRequirements} coordinators={initialCoordinators} activeVolunteers={activeVolunteers} categories={categories} />}
        {tab === 'holidays'    && <HolidaysTab initialHolidays={initialHolidays} />}
        {tab === 'automation'  && <AutomationTab initialRules={initialAutomationRules} orgTags={initialTags} orgFlags={initialFlags} initialAutoMessageRules={initialAutoMessageRules} messageTemplates={messageTemplates} initialDocRules={initialDocRules} activeVolunteers={activeVolunteers} categories={categories} />}
        {tab === 'tags'        && <TagsManager initialTags={initialTags} />}
        {tab === 'flags'        && <FlagsManager initialFlags={initialFlags} />}
        {tab === 'users'        && <UsersManager initialAdminUsers={initialAdminUsers} currentUserId={currentUserId} myRole={myRole} />}
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

      {/* Jotform */}
      <IntegrationCard
        name="Jotform"
        description="Send forms to volunteers for signatures and document collection"
        icon="📋"
        color="#FF6100"
        saved={saved === 'jotform'}
        isPending={isPending}
        fields={[
          { label: 'API Key', key: 'jotform_api_key', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', value: initialSettings.jotform_api_key ?? '', secret: true },
        ]}
        onSave={(vals) => saveSection('jotform', vals)}
        docsUrl="https://api.jotform.com"
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

      {/* Hour approval toggle */}
      <div style={{ marginTop: 24, padding: '16px 20px', background: '#f9fafb', borderRadius: 10, border: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 3 }}>Require manual hour approval</p>
            <p style={{ fontSize: 12, color: '#6b7280' }}>
              When enabled, hours clocked out by volunteers appear as &quot;pending&quot; in Reports until an admin approves them.
            </p>
          </div>
          <button
            disabled={isPending}
            onClick={() => saveSection('hour_approval', { require_hour_approval: !initialSettings.require_hour_approval })}
            style={{
              padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
              border: '1px solid #e5e7eb', cursor: 'pointer', flexShrink: 0,
              background: initialSettings.require_hour_approval ? '#1B2A4A' : '#fff',
              color: initialSettings.require_hour_approval ? '#fff' : '#374151',
            }}
          >
            {initialSettings.require_hour_approval ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Automation Tab ───────────────────────────────────────────────────────────

function AutomationTab({
  initialRules,
  orgTags,
  orgFlags,
  initialAutoMessageRules,
  messageTemplates,
  initialDocRules,
  activeVolunteers,
  categories,
}: {
  initialRules: FormAutomationRule[]
  orgTags: OrgTag[]
  orgFlags: OrgFlag[]
  initialAutoMessageRules: AutoMessageRule[]
  messageTemplates: Pick<MessageTemplate, 'id' | 'name' | 'subject' | 'channel'>[]
  initialDocRules: DocumentAutomationRule[]
  activeVolunteers: { id: string; first_name: string; last_name: string }[]
  categories: Category[]
}) {
  const router = useRouter()
  const [rules, setRules] = useState(initialRules)
  const [fieldKey, setFieldKey] = useState('category')
  const [fieldValue, setFieldValue] = useState('')
  const [actionType, setActionType] = useState<FormAutomationRule['action_type']>('assign_category')
  const [actionValue, setActionValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Document automation
  const [docRules, setDocRules] = useState<DocumentAutomationRule[]>(initialDocRules)
  const [docType, setDocType] = useState('')
  const [docMessage, setDocMessage] = useState('')
  const [docAssignedTo, setDocAssignedTo] = useState('')
  const [docError, setDocError] = useState<string | null>(null)
  const [docPending, startDocTransition] = useTransition()

  function handleAddDocRule(e: React.FormEvent) {
    e.preventDefault()
    setDocError(null)
    startDocTransition(async () => {
      try {
        const newRule = await saveDocumentAutomationRule({ trigger_document_type: docType, alert_message: docMessage, assigned_to: docAssignedTo || null })
        setDocRules(prev => [...prev, newRule as DocumentAutomationRule])
        setDocType('')
        setDocMessage('')
        setDocAssignedTo('')
      } catch (err: unknown) {
        setDocError(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  function handleDeleteDocRule(ruleId: string) {
    const prev = docRules
    setDocRules(p => p.filter(r => r.id !== ruleId))
    startDocTransition(async () => {
      try {
        await deleteDocumentAutomationRule(ruleId)
      } catch {
        setDocRules(prev)
        setDocError('Failed to delete rule')
      }
    })
  }

  // Auto Message Rules state
  const [msgRules, setMsgRules] = useState(initialAutoMessageRules)
  const [msgName, setMsgName] = useState('')
  const [msgTrigger, setMsgTrigger] = useState('shift_reminder')
  const [msgTemplateId, setMsgTemplateId] = useState(messageTemplates[0]?.id ?? '')
  const [msgDaysBefore, setMsgDaysBefore] = useState(1)
  const [msgChannel, setMsgChannel] = useState('email')
  const [msgError, setMsgError] = useState<string | null>(null)
  const [msgPending, startMsgTransition] = useTransition()

  function handleAddMsg(e: React.FormEvent) {
    e.preventDefault()
    setMsgError(null)
    startMsgTransition(async () => {
      try {
        const newRule = await saveAutoMessageRule({ name: msgName, triggerType: msgTrigger, templateId: msgTemplateId, daysBefore: msgDaysBefore, channel: msgChannel })
        setMsgRules(prev => [...prev, newRule as AutoMessageRule])
        setMsgName('')
        setMsgTrigger('shift_reminder')
        setMsgTemplateId(messageTemplates[0]?.id ?? '')
        setMsgDaysBefore(1)
        setMsgChannel('email')
      } catch (err: unknown) {
        setMsgError(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  function handleDeleteMsg(ruleId: string) {
    const prev = msgRules
    setMsgRules(p => p.filter(r => r.id !== ruleId))
    startMsgTransition(async () => {
      try {
        await deleteAutoMessageRule(ruleId)
      } catch {
        setMsgRules(prev)
        setMsgError('Failed to delete rule')
      }
    })
  }

  function handleToggleMsg(ruleId: string, current: boolean) {
    setMsgRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: !current } : r))
    startMsgTransition(async () => {
      try {
        await toggleAutoMessageRule(ruleId, !current)
      } catch {
        setMsgRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: current } : r))
        setMsgError('Failed to update rule')
      }
    })
  }

  const MSG_TRIGGER_LABELS: Record<string, string> = {
    shift_reminder: 'Shift Reminder',
    cert_expiry: 'Credential Expiry',
    open_shift: 'Open Shift Broadcast',
  }

  const ACTION_TYPE_LABELS: Record<FormAutomationRule['action_type'], string> = {
    assign_category: 'Assign Category',
    assign_flag: 'Raise Flag',
    assign_tag: 'Add Tag',
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const newRule = await saveFormAutomationRule({ fieldKey, fieldValue, actionType, actionValue })
        setRules(prev => [...prev, newRule as FormAutomationRule])
        setFieldValue('')
        setActionValue('')
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  function handleDelete(ruleId: string) {
    startTransition(async () => {
      await deleteFormAutomationRule(ruleId)
      setRules(prev => prev.filter(r => r.id !== ruleId))
    })
  }

  function actionValueOptions() {
    if (actionType === 'assign_category') return categories.map(c => c.slug)
    if (actionType === 'assign_flag') return orgFlags.map(f => f.id)
    if (actionType === 'assign_tag') return orgTags.map(t => t.id)
    return []
  }

  function actionValueLabel(val: string) {
    if (actionType === 'assign_category') return categories.find(c => c.slug === val)?.name ?? val
    if (actionType === 'assign_flag') return orgFlags.find(f => f.id === val)?.name ?? val
    if (actionType === 'assign_tag') return orgTags.find(t => t.id === val)?.name ?? val
    return val
  }

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', fontSize: '13px',
    border: '1px solid #e5e7eb', borderRadius: '7px',
    fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  }

  return (
    <div>
      <SectionHeader title="Form Automation" desc="Auto-assign categories, flags, or tags when an applicant's field matches a value." />

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px' }}>
        <div style={{ flex: '1 1 110px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Field</label>
          <select value={fieldKey} onChange={e => setFieldKey(e.target.value)} style={inputStyle}>
            <option value="category">Category</option>
          </select>
        </div>
        <div style={{ flex: '1 1 130px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Equals</label>
          <input required value={fieldValue} onChange={e => setFieldValue(e.target.value)} placeholder="Value" style={inputStyle} />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Action</label>
          <select value={actionType} onChange={e => { setActionType(e.target.value as FormAutomationRule['action_type']); setActionValue('') }} style={inputStyle}>
            <option value="assign_category">Assign Category</option>
            <option value="assign_flag">Raise Flag</option>
            <option value="assign_tag">Add Tag</option>
          </select>
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Value</label>
          {actionType === 'assign_category' ? (
            <select value={actionValue} onChange={e => setActionValue(e.target.value)} required style={inputStyle}>
              <option value="">— select —</option>
              {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          ) : (
            <select value={actionValue} onChange={e => setActionValue(e.target.value)} required style={inputStyle}>
              <option value="">— select —</option>
              {actionValueOptions().map(v => <option key={v} value={v}>{actionValueLabel(v)}</option>)}
            </select>
          )}
        </div>
        <button type="submit" disabled={isPending}
          style={{
            padding: '7px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
            border: 'none', background: '#1B2A4A', color: 'white',
            cursor: isPending ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            opacity: isPending ? 0.7 : 1, flexShrink: 0,
          }}
        >
          + Add Rule
        </button>
        {error && <p style={{ width: '100%', fontSize: '12px', color: '#dc2626', margin: 0 }}>{error}</p>}
      </form>

      {rules.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>No automation rules yet</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rules.map(rule => (
            <div key={rule.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: '8px',
              border: '1px solid #f3f4f6', background: 'white', gap: '12px',
            }}>
              <span style={{ fontSize: '13px', color: '#374151' }}>
                If <strong>{rule.field_key}</strong> = &ldquo;<strong>{rule.field_value}</strong>&rdquo;
                &nbsp;→ <strong>{ACTION_TYPE_LABELS[rule.action_type]}</strong>{' '}
                <em>{actionValueLabel(rule.action_value)}</em>
              </span>
              <button onClick={() => handleDelete(rule.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: '2px', display: 'flex', flexShrink: 0 }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#d1d5db')}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Auto Messages ── */}
      <div style={{ marginTop: '32px' }}>
        <SectionHeader title="Auto Messages" desc="Send automated messages to volunteers based on shift reminders, expiring credentials, or open shifts." />

        <form onSubmit={handleAddMsg} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px' }}>
          <div style={{ flex: '1 1 130px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Rule Name</label>
            <input required value={msgName} onChange={e => setMsgName(e.target.value)} placeholder="e.g. Shift reminder 2d" style={inputStyle} />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Trigger</label>
            <select value={msgTrigger} onChange={e => setMsgTrigger(e.target.value)} style={inputStyle}>
              <option value="shift_reminder">Shift Reminder</option>
              <option value="cert_expiry">Credential Expiry</option>
              <option value="open_shift">Open Shift Broadcast</option>
            </select>
          </div>
          {msgTrigger !== 'open_shift' && (
            <div style={{ flex: '0 0 70px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Days Before</label>
              <input type="number" min={0} max={90} value={msgDaysBefore} onChange={e => setMsgDaysBefore(Number(e.target.value))} style={{ ...inputStyle, width: '70px' }} />
            </div>
          )}
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Template</label>
            {messageTemplates.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>No templates — create one in Messages.</p>
            ) : (
              <select value={msgTemplateId} onChange={e => setMsgTemplateId(e.target.value)} required style={inputStyle}>
                {messageTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Channel</label>
            <select value={msgChannel} onChange={e => setMsgChannel(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="push">Push</option>
            </select>
          </div>
          <button type="submit" disabled={msgPending || messageTemplates.length === 0}
            style={{
              padding: '7px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
              border: 'none', background: '#1B2A4A', color: 'white',
              cursor: (msgPending || messageTemplates.length === 0) ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', opacity: (msgPending || messageTemplates.length === 0) ? 0.7 : 1, flexShrink: 0,
            }}
          >
            + Add Rule
          </button>
          {msgError && <p style={{ width: '100%', fontSize: '12px', color: '#dc2626', margin: 0 }}>{msgError}</p>}
        </form>

        {msgRules.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>No auto message rules yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {msgRules.map(rule => {
              const tpl = messageTemplates.find(t => t.id === rule.template_id)
              return (
                <div key={rule.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid #f3f4f6', background: 'white',
                }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                    background: rule.is_active ? '#ecfdf5' : '#f3f4f6',
                    color: rule.is_active ? '#065f46' : '#9ca3af',
                    flexShrink: 0,
                  }}>
                    {rule.is_active ? 'Active' : 'Paused'}
                  </span>
                  <span style={{ fontSize: '13px', color: '#374151', flex: 1 }}>
                    <strong>{rule.name}</strong>
                    <span style={{ color: '#9ca3af' }}> · {MSG_TRIGGER_LABELS[rule.trigger_type] ?? rule.trigger_type}, {rule.days_before}d before · {tpl?.name ?? rule.template_id} · {rule.channel}</span>
                  </span>
                  <button
                    onClick={() => handleToggleMsg(rule.id, rule.is_active)}
                    disabled={msgPending}
                    style={{
                      padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                      border: '1px solid #e5e7eb', background: 'white', color: '#374151',
                      cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                    }}
                  >
                    {rule.is_active ? 'Pause' : 'Resume'}
                  </button>
                  <button onClick={() => handleDeleteMsg(rule.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: '2px', display: 'flex', flexShrink: 0 }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#d1d5db')}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Document Automation Rules ── */}
      <div style={{ marginTop: '24px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Document Alerts</p>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px' }}>
          When a document of a specific type is added, send an internal alert to a staff member for follow-up.
        </p>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', background: 'white', marginBottom: '10px' }}>
          {docRules.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#9ca3af', padding: '12px 16px' }}>No rules yet.</p>
          ) : (
            docRules.map((rule, idx) => {
              const assignedVol = activeVolunteers.find(v => v.id === rule.assigned_to)
              return (
                <div key={rule.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '10px 16px',
                  borderBottom: idx < docRules.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>When: <span style={{ color: '#1B2A4A' }}>{rule.trigger_document_type}</span> added</p>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Alert: {rule.alert_message}</p>
                    {assignedVol && <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>→ {assignedVol.first_name} {assignedVol.last_name}</p>}
                  </div>
                  <button onClick={() => handleDeleteDocRule(rule.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: '2px' }}>✕</button>
                </div>
              )
            })
          )}
        </div>

        <form onSubmit={handleAddDocRule} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              value={docType}
              onChange={e => setDocType(e.target.value)}
              placeholder="Document type (e.g. Background Check)"
              style={{ flex: '1 1 180px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', fontFamily: 'inherit' }}
            />
            <input
              value={docMessage}
              onChange={e => setDocMessage(e.target.value)}
              placeholder="Alert message"
              style={{ flex: '2 1 200px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', fontFamily: 'inherit' }}
            />
            <select
              value={docAssignedTo}
              onChange={e => setDocAssignedTo(e.target.value)}
              style={{ flex: '1 1 150px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', fontFamily: 'inherit', background: 'white' }}
            >
              <option value="">— Assign to (optional) —</option>
              {activeVolunteers.map(v => (
                <option key={v.id} value={v.id}>{v.first_name} {v.last_name}</option>
              ))}
            </select>
          </div>
          {docError && <p style={{ fontSize: '12px', color: '#dc2626' }}>{docError}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={!docType.trim() || !docMessage.trim() || docPending}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                background: '#1B2A4A', color: 'white', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', opacity: !docType.trim() || !docMessage.trim() ? 0.5 : 1,
              }}
            >
              + Add Alert Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Holidays Tab ─────────────────────────────────────────────────────────────

const PRESET_HOLIDAYS: { name: string; date: string; is_recurring: boolean; group: string }[] = [
  // US Federal — fixed-date (recurring)
  { name: 'New Year\'s Day',    date: '2026-01-01', is_recurring: true,  group: 'Federal' },
  { name: 'Juneteenth',         date: '2026-06-19', is_recurring: true,  group: 'Federal' },
  { name: 'Independence Day',   date: '2026-07-04', is_recurring: true,  group: 'Federal' },
  { name: 'Veterans Day',       date: '2026-11-11', is_recurring: true,  group: 'Federal' },
  { name: 'Christmas Day',      date: '2026-12-25', is_recurring: true,  group: 'Federal' },
  // US Federal — floating (year-specific, not recurring)
  { name: 'MLK Jr. Day',        date: '2026-01-19', is_recurring: false, group: 'Federal' },
  { name: 'Presidents\' Day',   date: '2026-02-16', is_recurring: false, group: 'Federal' },
  { name: 'Memorial Day',       date: '2026-05-25', is_recurring: false, group: 'Federal' },
  { name: 'Labor Day',          date: '2026-09-07', is_recurring: false, group: 'Federal' },
  { name: 'Columbus Day',       date: '2026-10-12', is_recurring: false, group: 'Federal' },
  { name: 'Thanksgiving',       date: '2026-11-26', is_recurring: false, group: 'Federal' },
  // Religious / widely observed
  { name: 'Ash Wednesday',      date: '2026-02-18', is_recurring: false, group: 'Religious' },
  { name: 'Good Friday',        date: '2026-04-03', is_recurring: false, group: 'Religious' },
  { name: 'Easter Sunday',      date: '2026-04-05', is_recurring: false, group: 'Religious' },
  { name: 'Christmas Eve',      date: '2026-12-24', is_recurring: true,  group: 'Religious' },
  { name: 'New Year\'s Eve',    date: '2026-12-31', is_recurring: true,  group: 'Religious' },
]

function HolidaysTab({ initialHolidays }: { initialHolidays: OrgHoliday[] }) {
  const [holidays, setHolidays] = useState<OrgHoliday[]>(initialHolidays)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showPresets, setShowPresets] = useState(false)
  const [selectedPresets, setSelectedPresets] = useState<Set<number>>(() => new Set(PRESET_HOLIDAYS.map((_, i) => i)))

  function handleAdd() {
    if (!name.trim() || !date) return
    setError(null)
    startTransition(async () => {
      try {
        await addHoliday({ name: name.trim(), date, is_recurring: isRecurring })
        setName('')
        setDate('')
        setIsRecurring(false)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to add holiday')
      }
    })
  }

  function handleBulkAdd() {
    const selected = PRESET_HOLIDAYS.filter((_, i) => selectedPresets.has(i))
    if (selected.length === 0) return
    setError(null)
    startTransition(async () => {
      try {
        await bulkAddHolidays(selected)
        setShowPresets(false)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to add holidays')
      }
    })
  }

  function togglePreset(i: number) {
    setSelectedPresets(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function toggleGroup(group: string, indices: number[]) {
    const allSelected = indices.every(i => selectedPresets.has(i))
    setSelectedPresets(prev => {
      const next = new Set(prev)
      indices.forEach(i => allSelected ? next.delete(i) : next.add(i))
      return next
    })
  }

  function handleDelete(id: string) {
    setError(null)
    startTransition(async () => {
      try {
        await deleteHoliday(id)
        setHolidays(prev => prev.filter(h => h.id !== id))
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to delete holiday')
      }
    })
  }

  function formatDate(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div>
      <SectionHeader
        title="Holidays & Closures"
        desc="Holidays are shown on the shift calendar. Recurring holidays repeat on the same month and day every year."
      />

      {error && <ErrorBanner msg={error} />}

      {/* Common holidays preset panel */}
      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={() => setShowPresets(v => !v)}
          style={{ ...ghostBtnSm, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span>{showPresets ? '▾' : '▸'}</span>
          Add Common Holidays
        </button>
        {showPresets && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', background: '#f9fafb', marginTop: '8px' }}>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '14px' }}>
              Select holidays to add. Fixed-date holidays (New Year&apos;s Day, July 4th, etc.) are marked recurring. Floating holidays (MLK Day, Thanksgiving, etc.) are added for 2026 only — update dates each year.
            </p>
            {(['Federal', 'Religious'] as const).map(group => {
              const groupItems = PRESET_HOLIDAYS.map((h, i) => ({ h, i })).filter(({ h }) => h.group === group)
              const groupIndices = groupItems.map(({ i }) => i)
              const allChecked = groupIndices.every(i => selectedPresets.has(i))
              return (
                <div key={group} style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={allChecked} onChange={() => toggleGroup(group, groupIndices)} />
                    {group} Holidays
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '6px', paddingLeft: '4px' }}>
                    {groupItems.map(({ h, i }) => (
                      <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
                        <input type="checkbox" checked={selectedPresets.has(i)} onChange={() => togglePreset(i)} />
                        <span style={{ flex: 1 }}>{h.name}</span>
                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>{h.is_recurring ? 'recurring' : h.date.slice(5).replace('-', '/')}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={handleBulkAdd}
                disabled={selectedPresets.size === 0 || isPending}
                style={{ ...primaryBtn, opacity: selectedPresets.size === 0 ? 0.5 : 1, cursor: selectedPresets.size === 0 ? 'not-allowed' : 'pointer' }}
              >
                Add Selected ({selectedPresets.size})
              </button>
              <button onClick={() => setShowPresets(false)} style={ghostBtnSm}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Add form */}
      <div style={{
        border: '1px solid #e5e7eb', borderRadius: '10px',
        padding: '16px', background: '#f9fafb', marginBottom: '16px',
      }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
          Add Holiday
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Holiday Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Thanksgiving"
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ ...fieldStyle, width: 'auto' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />
            Repeat every year (recurring)
          </label>
          <button
            onClick={handleAdd}
            disabled={!name.trim() || !date || isPending}
            style={{ ...primaryBtn, opacity: !name.trim() || !date ? 0.5 : 1, cursor: !name.trim() || !date ? 'not-allowed' : 'pointer' }}
          >
            + Add Holiday
          </button>
        </div>
      </div>

      {/* Holiday list */}
      {holidays.length === 0 ? (
        <EmptyState icon="📅" msg="No holidays configured yet." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[...holidays].sort((a, b) => a.date.localeCompare(b.date)).map(h => (
            <div key={h.id} style={{
              border: '1px solid #e5e7eb', borderRadius: '10px', background: 'white',
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <span style={{ fontSize: '20px' }}>📅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{h.name}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {formatDate(h.date)}
                  {h.is_recurring && ' · Recurring yearly'}
                </div>
              </div>
              <button
                onClick={() => handleDelete(h.id)}
                disabled={isPending}
                style={{ ...ghostBtnSm, color: '#dc2626', borderColor: '#fca5a5' }}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab({ descriptions: initial, requirements: initialRequirements, coordinators: initialCoordinators, activeVolunteers, categories: initialCategories }: { descriptions: Record<string, string>; requirements: CategoryRequirement[]; coordinators: CategoryCoordinator[]; activeVolunteers: { id: string; first_name: string; last_name: string }[]; categories: Category[] }) {
  const router = useRouter()
  const [descriptions, setDescriptions] = useState<Record<string, string>>(initial)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add / archive / restore category
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')
  const [catPending, setCatPending] = useState(false)
  const [, startCatTransition] = useTransition()

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault()
    setCatPending(true)
    const result = await addCategory(newCatName, newCatDesc)
    setCatPending(false)
    if (result.error) { alert(result.error); return }
    setShowAddCategory(false)
    setNewCatName('')
    setNewCatDesc('')
    router.refresh()
  }

  // Inline name editing
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState('')

  async function handleSaveCatName(id: string) {
    const trimmed = editingCatName.trim()
    if (!trimmed) return
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name: trimmed } : c))
    setEditingCatId(null)
    await updateCategoryName(id, trimmed)
  }

  // Coordinators
  const [coordinators, setCoordinators] = useState<CategoryCoordinator[]>(initialCoordinators)
  const [coordPending, startCoordTransition] = useTransition()

  function handleAssignCoordinator(category: string, volId: string) {
    if (!volId) {
      handleRemoveCoordinator(category)
      return
    }
    const existing = coordinators.find(c => c.category === category)
    if (existing) {
      setCoordinators(cs => cs.map(c => c.category === category ? { ...c, coordinator_volunteer_id: volId } : c))
    } else {
      const temp: CategoryCoordinator = { id: crypto.randomUUID(), category, coordinator_volunteer_id: volId, created_at: new Date().toISOString() }
      setCoordinators(cs => [...cs, temp])
    }
    startCoordTransition(async () => {
      try { await assignCategoryCoordinator(category, volId) } catch { /* ignore */ }
    })
  }

  function handleRemoveCoordinator(category: string) {
    setCoordinators(cs => cs.filter(c => c.category !== category))
    startCoordTransition(async () => {
      try { await removeCategoryCoordinator(category) } catch { /* ignore */ }
    })
  }

  // Requirements
  const [requirements, setRequirements] = useState<CategoryRequirement[]>(initialRequirements)
  const [expandedReqCat, setExpandedReqCat] = useState<string | null>(null)
  const [reqTitle, setReqTitle] = useState('')
  const [reqDesc, setReqDesc] = useState('')
  const [reqBlocking, setReqBlocking] = useState(false)
  const [reqPending, startReqTransition] = useTransition()
  const [reqError, setReqError] = useState<string | null>(null)

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await updateCategoryDescriptions(descriptions)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to save')
      }
    })
  }

  function handleAddRequirement(categoryName: string) {
    if (!reqTitle.trim()) return
    setReqError(null)
    startReqTransition(async () => {
      try {
        const newReq = await addCategoryRequirement({ category_name: categoryName, title: reqTitle.trim(), description: reqDesc.trim() || undefined, is_blocking: reqBlocking })
        setRequirements(prev => [...prev, newReq])
        setReqTitle('')
        setReqDesc('')
        setReqBlocking(false)
      } catch (e: unknown) {
        setReqError(e instanceof Error ? e.message : 'Failed to add requirement')
      }
    })
  }

  function handleDeleteRequirement(reqId: string) {
    startReqTransition(async () => {
      try {
        await deleteCategoryRequirement(reqId)
        setRequirements(prev => prev.filter(r => r.id !== reqId))
      } catch {}
    })
  }

  return (
    <div>
      <SectionHeader
        title="Volunteer Categories"
        desc="Add descriptions to each role to help volunteers and admins understand what each category means."
      />

      {error && <ErrorBanner msg={error} />}
      {saved && <SuccessBanner msg="Category descriptions saved" />}

      {/* ── Add new category ── */}
      {showAddCategory ? (
        <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Name</label>
            <input
              value={newCatName} onChange={e => setNewCatName(e.target.value)}
              placeholder="e.g. Community Engagement"
              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
            />
          </div>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Description (optional)</label>
            <input
              value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)}
              placeholder="What does this role involve?"
              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
            />
          </div>
          <button type="submit" disabled={catPending} style={{ padding: '8px 16px', background: '#1B2A4A', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
            Save
          </button>
          <button type="button" onClick={() => setShowAddCategory(false)} style={{ padding: '8px 12px', background: '#f3f4f6', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
            Cancel
          </button>
        </form>
      ) : (
        <button onClick={() => setShowAddCategory(true)} style={{ marginBottom: '16px', padding: '8px 14px', background: '#f0f4ff', color: '#1B2A4A', border: '1.5px solid #c7d2fe', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          + New Category
        </button>
      )}

      {/* Active categories */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        {categories.filter(cat => !cat.is_archived).map(cat => (
          <div key={cat.id} style={{
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            padding: '14px 16px',
            background: 'white',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {editingCatId === cat.id ? (
                <>
                  <input
                    autoFocus
                    value={editingCatName}
                    onChange={e => setEditingCatName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void handleSaveCatName(cat.id); if (e.key === 'Escape') setEditingCatId(null) }}
                    style={{ padding: '3px 10px', borderRadius: '6px', border: '1.5px solid #6366f1', fontSize: '12px', fontWeight: 700, outline: 'none', width: '160px' }}
                  />
                  <button onClick={() => void handleSaveCatName(cat.id)} style={{ fontSize: '12px', fontWeight: 600, color: '#fff', background: '#1B2A4A', border: 'none', borderRadius: '5px', padding: '3px 10px', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditingCatId(null)} style={{ fontSize: '12px', color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer' }}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ padding: '2px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 700, background: '#f3f4f6', color: '#374151' }}>{cat.name}</span>
                  <button
                    onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name) }}
                    style={{ fontSize: '11px', color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: '5px', padding: '2px 8px', cursor: 'pointer' }}>
                    Rename
                  </button>
                  <code style={{ fontSize: '11px', color: '#9ca3af' }}>{cat.slug}</code>
                </>
              )}
              <button
                onClick={() => { if (confirm(`Archive "${cat.name}"? Existing volunteers keep this category but it won't appear in the assignment list.`)) startCatTransition(() => { void archiveCategory(cat.id).then(() => setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_archived: true } : c))) }) }}
                style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
                Archive
              </button>
            </div>
            <input
              value={descriptions[cat.slug] ?? ''}
              onChange={e => setDescriptions(prev => ({ ...prev, [cat.slug]: e.target.value }))}
              placeholder={`Describe the ${cat.name} role…`}
              style={fieldStyle}
            />
          </div>
        ))}
      </div>

      <SaveButton onClick={handleSave} isPending={isPending} />

      {/* Archived categories */}
      {categories.some(cat => cat.is_archived) && (
        <div style={{ marginTop: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af', marginBottom: '8px' }}>Archived</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {categories.filter(cat => cat.is_archived).map(cat => (
              <div key={cat.id} style={{
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                padding: '12px 16px',
                background: '#f9fafb',
                opacity: 0.7,
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span style={{ padding: '2px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 700, background: '#e5e7eb', color: '#6b7280' }}>{cat.name}</span>
                <code style={{ fontSize: '11px', color: '#9ca3af' }}>{cat.slug}</code>
                <button
                  onClick={() => startCatTransition(() => { void restoreCategory(cat.id).then(() => setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_archived: false } : c))) })}
                  style={{ marginLeft: 'auto', fontSize: '12px', color: '#059669', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Requirements ── */}
      <div style={{ marginTop: '28px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Category Requirements</p>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px', lineHeight: 1.5 }}>
          Define prerequisites volunteers must satisfy. Blocking requirements prevent shift sign-up until met.
        </p>
        {categories.filter(cat => !cat.is_archived).map(cat => {
          const catReqs = requirements.filter(r => r.category_name === cat.slug)
          const isExpanded = expandedReqCat === cat.slug
          return (
            <div key={cat.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', background: 'white', marginBottom: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => setExpandedReqCat(isExpanded ? null : cat.slug)}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{cat.name}</span>
                  {catReqs.length > 0 && (
                    <span style={{ fontSize: '11px', background: '#f3f4f6', color: '#6b7280', borderRadius: '10px', padding: '1px 7px', fontWeight: 600 }}>{catReqs.length}</span>
                  )}
                  {catReqs.some(r => r.is_blocking) && (
                    <span style={{ fontSize: '10px', background: '#fef2f2', color: '#dc2626', borderRadius: '6px', padding: '1px 6px', fontWeight: 700 }}>BLOCKING</span>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>{isExpanded ? '▲' : '▼'}</span>
              </button>
              {isExpanded && (
                <div style={{ borderTop: '1px solid #f3f4f6', padding: '14px 16px' }}>
                  {catReqs.length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>No requirements yet.</p>
                  ) : (
                    <div style={{ marginBottom: '14px' }}>
                      {catReqs.map(req => (
                        <div key={req.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderBottom: '1px solid #f9fafb' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{req.title}</span>
                              {req.is_blocking && (
                                <span style={{ fontSize: '10px', background: '#fef2f2', color: '#dc2626', borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>Blocking</span>
                              )}
                            </div>
                            {req.description && <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{req.description}</p>}
                          </div>
                          <button onClick={() => handleDeleteRequirement(req.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: '2px', flexShrink: 0, fontSize: '16px' }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input value={reqTitle} onChange={e => setReqTitle(e.target.value)} placeholder="Requirement title (e.g. Valid CPR Certification)" style={fieldStyle} />
                    <input value={reqDesc} onChange={e => setReqDesc(e.target.value)} placeholder="Description (optional)" style={{ ...fieldStyle, fontSize: '12px' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#374151', cursor: 'pointer' }}>
                        <input type="checkbox" checked={reqBlocking} onChange={e => setReqBlocking(e.target.checked)} />
                        Blocking
                      </label>
                      <button
                        onClick={() => handleAddRequirement(cat.slug)}
                        disabled={!reqTitle.trim() || reqPending}
                        style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: 600, background: '#1B2A4A', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', opacity: !reqTitle.trim() ? 0.5 : 1 }}
                      >
                        + Add
                      </button>
                    </div>
                    {reqError && <p style={{ fontSize: '12px', color: '#dc2626' }}>{reqError}</p>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Coordinators per category ── */}
      <div style={{ marginTop: '24px' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Category Coordinators</p>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px' }}>
          Assign a lead volunteer for each category. Coordinators receive notifications when shifts are created for their category.
        </p>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', background: 'white' }}>
          {categories.filter(cat => !cat.is_archived).map((cat, idx, arr) => {
            const coord = coordinators.find(c => c.category === cat.slug)
            const currentVolId = coord?.coordinator_volunteer_id ?? ''
            return (
              <div key={cat.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 16px',
                borderBottom: idx < arr.length - 1 ? '1px solid #f3f4f6' : 'none',
              }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', minWidth: '160px' }}>{cat.name}</span>
                <select
                  value={currentVolId}
                  onChange={e => handleAssignCoordinator(cat.slug, e.target.value)}
                  disabled={coordPending}
                  style={{ flex: 1, maxWidth: '260px', padding: '7px 10px', borderRadius: '7px', border: '1px solid #e5e7eb', fontSize: '13px', background: 'white', fontFamily: 'inherit', color: '#111827' }}
                >
                  <option value="">— No coordinator —</option>
                  {activeVolunteers.map(v => (
                    <option key={v.id} value={v.id}>{v.first_name} {v.last_name}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      </div>
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
