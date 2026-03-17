'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Circle, Clock, AlertTriangle, FileText, ShieldCheck, BookOpen } from 'lucide-react'
import { toggleChecklistItem } from './actions'
import { getUploadSignedUrl } from './actions'
import type { ChecklistField } from './actions'
import type {
  Volunteer, Credential, Document, BackgroundCheck,
  TimeEntry, LessonCompletion, Location,
  OrgTag, OrgFlag, VolunteerFlag, VolunteerNote, VolunteerUpload,
} from '@/types/database'
import type { VolunteerDetail, OnboardingStageWithProgress } from './page'
import PipelinePhaseBar from './PipelinePhaseBar'
import InfoTab from './InfoTab'
import FlagsPanel from './FlagsPanel'
import NotesPanel from './NotesPanel'
import DocumentsPanel from './DocumentsPanel'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  document_sign:     'Document Sign',
  background_check:  'Background Check',
  in_person_meeting: 'In-Person Meeting',
  learning_module:   'Learning Module',
  manual_approval:   'Manual Approval',
  form_submission:   'Form Submission',
}

const STAGE_ICONS: Record<string, React.ElementType> = {
  document_sign:     FileText,
  background_check:  ShieldCheck,
  in_person_meeting: Clock,
  learning_module:   BookOpen,
  manual_approval:   CheckCircle2,
  form_submission:   FileText,
}

const BG_RESULT_COLORS: Record<string, { bg: string; text: string }> = {
  clear:     { bg: '#f0fdf4', text: '#15803d' },
  consider:  { bg: '#fff7ed', text: '#ea580c' },
  suspended: { bg: '#fef2f2', text: '#dc2626' },
  pending:   { bg: '#eff6ff', text: '#1d4ed8' },
}

const TABS = ['Info', 'Onboarding', 'Credentials', 'Hours', 'Documents', 'Background Check', 'Flags', 'Notes'] as const
type Tab = typeof TABS[number]

// ─── Component ────────────────────────────────────────────────────────────────

export default function VolunteerTabs({
  volunteer,
  credentials,
  documents,
  uploads,
  backgroundCheck,
  timeEntries,
  onboardingStages,
  lessonCompletions,
  notes,
  appliedTags,
  activeFlags,
  resolvedFlags,
  orgTags,
  orgFlags,
  orgLocations,
}: {
  volunteer: VolunteerDetail
  credentials: Credential[]
  documents: Document[]
  uploads: VolunteerUpload[]
  backgroundCheck: BackgroundCheck | null
  timeEntries: (TimeEntry & { location: { name: string } | null })[]
  onboardingStages: OnboardingStageWithProgress[]
  lessonCompletions: LessonCompletion[]
  notes: VolunteerNote[]
  appliedTags: OrgTag[]
  activeFlags: (VolunteerFlag & { flag: OrgFlag })[]
  resolvedFlags: (VolunteerFlag & { flag: OrgFlag })[]
  orgTags: OrgTag[]
  orgFlags: OrgFlag[]
  orgLocations?: Pick<Location, 'id' | 'name'>[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('Info')

  // ── Onboarding checklist state (optimistic) ──
  const [checklist, setChecklist] = useState({
    handbook:      !!volunteer.handbook_signed_at,
    bg_form:       volunteer.checklist_bg_form_signed,
    video:         volunteer.checklist_video_watched,
    id_verified:   volunteer.checklist_id_verified,
    certifications: volunteer.checklist_certifications_submitted,
  })
  const [, startChecklistTransition] = useTransition()

  function handleChecklistToggle(
    key: keyof typeof checklist,
    field: ChecklistField,
    current: boolean,
  ) {
    const next = !current
    setChecklist(prev => ({ ...prev, [key]: next }))
    startChecklistTransition(async () => {
      const result = await toggleChecklistItem(volunteer.id, field, next)
      if (result.error) {
        // Revert on failure
        setChecklist(prev => ({ ...prev, [key]: current }))
      }
    })
  }

  const completed  = onboardingStages.filter(s => s.progress?.completed_at).length
  const totalHours = timeEntries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0) / 60

  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0' }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #f0f0f0', padding: '0 8px', overflowX: 'auto' }}>
        {TABS.map(tab => {
          const badge = tab === 'Flags' && activeFlags.length > 0 ? activeFlags.length : null
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '14px 16px',
                border: 'none', background: 'none',
                fontSize: '13px', fontWeight: activeTab === tab ? 600 : 400,
                color: activeTab === tab ? '#1B2A4A' : '#6b7280',
                cursor: 'pointer', whiteSpace: 'nowrap',
                borderBottom: activeTab === tab ? '2px solid #1B2A4A' : '2px solid transparent',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              {tab}
              {badge !== null && (
                <span style={{
                  fontSize: '10px', fontWeight: 700, lineHeight: 1,
                  padding: '2px 5px', borderRadius: 99,
                  background: '#fef2f2', color: '#dc2626',
                }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div style={{ padding: '24px' }}>

        {/* ── Info ── */}
        {activeTab === 'Info' && (
          <InfoTab volunteer={volunteer} appliedTags={appliedTags} orgTags={orgTags} orgLocations={orgLocations ?? []} />
        )}

        {/* ── Onboarding ── */}
        {activeTab === 'Onboarding' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

            {/* ── Onboarding Checklist ── */}
            {(() => {
              const checklistItems: {
                key: keyof typeof checklist
                field: ChecklistField | null
                label: string
                sublabel: string
                auto: boolean
                signedDetail?: string | null
              }[] = [
                {
                  key: 'handbook',
                  field: null,
                  label: 'Volunteer Handbook read & signed',
                  sublabel: volunteer.handbook_signed_at
                    ? `Signed by ${volunteer.handbook_signed_name ?? 'volunteer'} on ${new Date(volunteer.handbook_signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : 'Volunteer must sign via the Handbook tab in their portal',
                  auto: true,
                  signedDetail: volunteer.handbook_signed_at ?? null,
                },
                {
                  key: 'bg_form',
                  field: 'checklist_bg_form_signed',
                  label: 'Background Check permission form signed & submitted',
                  sublabel: 'Permission form received and consent on file',
                  auto: false,
                },
                {
                  key: 'video',
                  field: 'checklist_video_watched',
                  label: 'Video watched',
                  sublabel: 'Orientation or required training video completed',
                  auto: false,
                },
                {
                  key: 'id_verified',
                  field: 'checklist_id_verified',
                  label: 'ID verified',
                  sublabel: 'Government-issued photo ID reviewed and confirmed',
                  auto: false,
                },
                {
                  key: 'certifications',
                  field: 'checklist_certifications_submitted',
                  label: 'Certifications submitted',
                  sublabel: 'Relevant professional certifications received',
                  auto: false,
                },
              ]

              const doneCount = checklistItems.filter(item => checklist[item.key]).length
              const allDone   = doneCount === checklistItems.length
              const pct       = Math.round((doneCount / checklistItems.length) * 100)

              return (
                <div>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Onboarding Checklist
                    </p>
                    <span style={{
                      fontSize: '12px', fontWeight: 600,
                      color: allDone ? '#16a34a' : '#6b7280',
                    }}>
                      {doneCount}/{checklistItems.length} complete
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: '5px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden', marginBottom: '14px' }}>
                    <div style={{
                      height: '100%', borderRadius: '4px',
                      background: allDone ? '#22c55e' : '#1B2A4A',
                      width: `${pct}%`,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>

                  {/* Items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {checklistItems.map(item => {
                      const isDone = checklist[item.key]
                      return (
                        <div
                          key={item.key}
                          onClick={() => {
                            if (!item.auto && item.field) {
                              handleChecklistToggle(item.key, item.field, isDone)
                            }
                          }}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: '12px',
                            padding: '13px 14px',
                            borderRadius: '10px',
                            border: `1px solid ${isDone ? '#d1fae5' : '#f0f0f0'}`,
                            background: isDone ? '#f0fdf4' : 'white',
                            cursor: item.auto ? 'default' : 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          {/* Checkbox / check */}
                          <div style={{
                            width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
                            border: `2px solid ${isDone ? '#22c55e' : '#d1d5db'}`,
                            background: isDone ? '#22c55e' : 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginTop: '1px', transition: 'all 0.15s',
                          }}>
                            {isDone && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            )}
                          </div>

                          {/* Text */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              fontSize: '13px', fontWeight: 600,
                              color: isDone ? '#15803d' : '#111827',
                              marginBottom: '2px',
                              textDecoration: isDone ? 'none' : 'none',
                            }}>
                              {item.label}
                              {item.auto && (
                                <span style={{
                                  marginLeft: '7px', fontSize: '10px', fontWeight: 600,
                                  padding: '1px 6px', borderRadius: '4px',
                                  background: '#eff6ff', color: '#1d4ed8',
                                  verticalAlign: 'middle',
                                }}>
                                  AUTO
                                </span>
                              )}
                            </p>
                            <p style={{ fontSize: '11px', color: isDone ? '#16a34a' : '#9ca3af', lineHeight: '1.4' }}>
                              {item.sublabel}
                            </p>
                          </div>

                          {/* Right side: toggle label or lock icon */}
                          {item.auto ? (
                            <div style={{ flexShrink: 0, marginTop: '1px' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                              </svg>
                            </div>
                          ) : (
                            <span style={{
                              fontSize: '11px', fontWeight: 500,
                              color: isDone ? '#16a34a' : '#9ca3af',
                              flexShrink: 0, marginTop: '2px',
                            }}>
                              {isDone ? 'Done' : 'Pending'}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            <PipelinePhaseBar volunteerId={volunteer.id} currentPhase={volunteer.pipeline_phase} />

            {/* Onboarding stage checklist */}
            {onboardingStages.length > 0 && (
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
                  Workflow Stages
                </p>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  marginBottom: '16px', padding: '14px 16px',
                  background: '#fafafa', borderRadius: '8px', border: '1px solid #f3f4f6',
                }}>
                  <div style={{ flex: 1, height: '6px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '4px',
                      background: completed === onboardingStages.length ? '#22c55e' : '#1B2A4A',
                      width: `${Math.round((completed / onboardingStages.length) * 100)}%`,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                    {completed}/{onboardingStages.length} stages
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {onboardingStages.map((stage, i) => {
                    const done = !!stage.progress?.completed_at
                    const StageIcon = STAGE_ICONS[stage.stage_type] ?? Circle
                    return (
                      <div key={stage.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '14px',
                        padding: '14px 16px', borderRadius: '10px',
                        border: `1px solid ${done ? '#d1fae5' : '#f3f4f6'}`,
                        background: done ? '#f0fdf4' : 'white',
                      }}>
                        {done
                          ? <CheckCircle2 style={{ width: '18px', height: '18px', color: '#22c55e', flexShrink: 0, marginTop: '1px' }} />
                          : <Circle       style={{ width: '18px', height: '18px', color: '#d1d5db', flexShrink: 0, marginTop: '1px' }} />
                        }
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>{i + 1}.</span>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{stage.name}</span>
                            <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '5px', background: '#f3f4f6', color: '#6b7280' }}>
                              {STAGE_LABELS[stage.stage_type]}
                            </span>
                          </div>
                          {stage.description && (
                            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>{stage.description}</p>
                          )}
                          {done && stage.progress?.completed_at && (
                            <p style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}>
                              Completed {new Date(stage.progress.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                          {!done && stage.deadline_days_after_start && (
                            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                              Due within {stage.deadline_days_after_start} days of start
                            </p>
                          )}
                        </div>
                        {!done && (
                          <button style={{
                            padding: '5px 12px', borderRadius: '6px',
                            border: '1px solid #e5e7eb', background: 'white',
                            fontSize: '12px', fontWeight: 500, color: '#374151',
                            cursor: 'pointer', flexShrink: 0,
                          }}>
                            Mark done
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {onboardingStages.length === 0 && (
              <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
                No onboarding workflow assigned to this volunteer.
              </p>
            )}
          </div>
        )}

        {/* ── Credentials ── */}
        {activeTab === 'Credentials' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Credential metadata cards */}
            {credentials.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
                No credentials on file
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {credentials.map(c => {
                  const isExpired = c.expiration_date && new Date(c.expiration_date) < new Date()
                  const daysLeft = c.expiration_date
                    ? Math.ceil((new Date(c.expiration_date).getTime() - Date.now()) / 86400000)
                    : null
                  return (
                    <div key={c.id} style={{
                      padding: '14px 16px', borderRadius: '10px',
                      border: `1px solid ${isExpired ? '#fecaca' : '#f3f4f6'}`,
                      background: isExpired ? '#fef2f2' : 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{c.type}</p>
                        {c.license_number && <p style={{ fontSize: '12px', color: '#6b7280' }}>License: {c.license_number}</p>}
                        {c.issuing_body && <p style={{ fontSize: '12px', color: '#6b7280' }}>{c.issuing_body}</p>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {c.expiration_date && (
                          <>
                            <p style={{ fontSize: '12px', color: isExpired ? '#dc2626' : '#374151' }}>
                              {isExpired ? 'Expired ' : 'Expires '}
                              {new Date(c.expiration_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            {!isExpired && daysLeft !== null && daysLeft <= 30 && (
                              <span style={{ fontSize: '11px', color: '#ea580c', display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end' }}>
                                <AlertTriangle style={{ width: '11px', height: '11px' }} />
                                {daysLeft}d left
                              </span>
                            )}
                          </>
                        )}
                        {c.verified_at && (
                          <p style={{ fontSize: '11px', color: '#22c55e', marginTop: '2px' }}>✓ Verified</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Credential file uploads (uploaded by volunteer via portal) */}
            {(() => {
              const credUploads = uploads.filter(u => u.category === 'credential')
              if (credUploads.length === 0) return null

              function credFileColor(mime: string) {
                if (mime === 'application/pdf')                          return '#ef4444'
                if (mime.includes('word') || mime.includes('document')) return '#2563eb'
                if (mime.includes('excel') || mime.includes('sheet'))   return '#16a34a'
                if (mime.startsWith('image/'))                          return '#8b5cf6'
                return '#9ca3af'
              }
              function credExtBadge(name: string, mime: string) {
                const ext = name.includes('.') ? name.split('.').pop()!.toUpperCase() : ''
                if (ext)                        return ext.slice(0, 4)
                if (mime === 'application/pdf') return 'PDF'
                if (mime.startsWith('image/'))  return mime.split('/')[1].toUpperCase().slice(0, 4)
                return 'FILE'
              }
              function fmtBytes(bytes: number) {
                if (bytes < 1024)          return `${bytes} B`
                if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`
                return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
              }

              return (
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                    Supporting Documents
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #f0f0f0' }}>
                    {credUploads.map((u, i) => {
                      const color = credFileColor(u.mime_type)
                      return (
                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'white', borderTop: i > 0 ? '1px solid #f9fafb' : 'none' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, color }}>
                            {credExtBadge(u.name, u.mime_type)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</p>
                            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>
                              {fmtBytes(u.size_bytes)} · {new Date(u.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                          <CredViewButton upload={u} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── Hours ── */}
        {activeTab === 'Hours' && (
          <div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              {[
                { label: 'Total Hours', value: totalHours.toFixed(1) },
                { label: 'Sessions',   value: timeEntries.length },
                { label: 'Avg Session', value: timeEntries.length ? `${(totalHours / timeEntries.length * 60).toFixed(0)}m` : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  flex: 1, padding: '14px 16px', background: '#fafafa',
                  borderRadius: '8px', border: '1px solid #f3f4f6',
                }}>
                  <p style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{label}</p>
                  <p style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>{value}</p>
                </div>
              ))}
            </div>

            {timeEntries.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>No time entries yet</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    {['Date', 'Location', 'Clock In', 'Clock Out', 'Duration', 'Method'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeEntries.map((e, i) => (
                    <tr key={e.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f9f9f9' }}>
                      <td style={{ padding: '11px 12px', fontSize: '13px', color: '#374151' }}>
                        {new Date(e.clock_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '11px 12px', fontSize: '13px', color: '#374151' }}>{e.location?.name ?? '—'}</td>
                      <td style={{ padding: '11px 12px', fontSize: '13px', color: '#374151' }}>
                        {new Date(e.clock_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '11px 12px', fontSize: '13px', color: '#374151' }}>
                        {e.clock_out ? new Date(e.clock_out).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : (
                          <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px' }}>Active</span>
                        )}
                      </td>
                      <td style={{ padding: '11px 12px', fontSize: '13px', color: '#374151' }}>
                        {e.duration_minutes != null ? `${Math.floor(e.duration_minutes / 60)}h ${e.duration_minutes % 60}m` : '—'}
                      </td>
                      <td style={{ padding: '11px 12px' }}>
                        <span style={{ fontSize: '11px', background: '#f3f4f6', color: '#374151', padding: '2px 6px', borderRadius: '4px' }}>
                          {e.method}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Documents ── */}
        {activeTab === 'Documents' && (
          <DocumentsPanel
            volunteerId={volunteer.id}
            uploads={uploads.filter(u => u.category !== 'credential')}
            signedDocuments={documents}
          />
        )}

        {/* ── Background Check ── */}
        {activeTab === 'Background Check' && (
          <div>
            {!backgroundCheck ? (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <ShieldCheck style={{ width: '32px', height: '32px', color: '#d1d5db', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px' }}>No background check initiated</p>
                <button style={{
                  padding: '8px 16px', borderRadius: '8px',
                  background: '#1B2A4A', color: 'white',
                  border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600,
                }}>
                  Initiate Background Check
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Provider',  value: backgroundCheck.provider },
                  { label: 'Status',    value: backgroundCheck.status },
                  { label: 'Initiated', value: new Date(backgroundCheck.initiated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
                  { label: 'Completed', value: backgroundCheck.completed_at ? new Date(backgroundCheck.completed_at).toLocaleDateString() : '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f3f4f6',
                  }}>
                    <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: '13px', color: '#111827', fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
                {backgroundCheck.result && (
                  <div style={{
                    padding: '14px 16px', borderRadius: '10px',
                    border: '1px solid',
                    borderColor: BG_RESULT_COLORS[backgroundCheck.result]?.bg ?? '#f3f4f6',
                    background: BG_RESULT_COLORS[backgroundCheck.result]?.bg ?? '#fafafa',
                  }}>
                    <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Result</p>
                    <p style={{ fontSize: '18px', fontWeight: 700, color: BG_RESULT_COLORS[backgroundCheck.result]?.text ?? '#111827', textTransform: 'capitalize' }}>
                      {backgroundCheck.result}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Flags ── */}
        {activeTab === 'Flags' && (
          <FlagsPanel
            volunteerId={volunteer.id}
            activeFlags={activeFlags}
            resolvedFlags={resolvedFlags}
            orgFlags={orgFlags}
          />
        )}

        {/* ── Notes ── */}
        {activeTab === 'Notes' && (
          <NotesPanel volunteerId={volunteer.id} initialNotes={notes} />
        )}

      </div>
    </div>
  )
}

// ─── Credential view button ───────────────────────────────────────────────────

function CredViewButton({ upload }: { upload: VolunteerUpload }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState<string | null>(null)

  async function handleClick() {
    if (!upload.storage_path) return
    setLoading(true)
    const result = await getUploadSignedUrl(upload.storage_path)
    setLoading(false)
    if (result.error || !result.url) { setErr(result.error ?? 'Error'); return }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div>
      {err && <span style={{ fontSize: '11px', color: '#dc2626' }}>{err}</span>}
      <button
        onClick={handleClick}
        disabled={loading}
        title="Open file"
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '6px 11px', borderRadius: '7px',
          border: '1px solid #e5e7eb', background: 'white',
          fontSize: '12px', fontWeight: 600, color: '#374151',
          cursor: loading ? 'wait' : 'pointer', flexShrink: 0,
          fontFamily: 'inherit',
        }}
      >
        {loading ? '…' : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open
          </>
        )}
      </button>
    </div>
  )
}
