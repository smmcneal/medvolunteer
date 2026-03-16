'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, Clock, AlertTriangle, FileText, ShieldCheck, BookOpen } from 'lucide-react'
import type {
  Volunteer, Credential, Document, BackgroundCheck,
  TimeEntry, LessonCompletion,
  OrgTag, OrgFlag, VolunteerFlag, VolunteerNote,
} from '@/types/database'
import type { VolunteerDetail, OnboardingStageWithProgress } from './page'
import PipelinePhaseBar from './PipelinePhaseBar'
import TagsPanel from './TagsPanel'
import FlagsPanel from './FlagsPanel'
import NotesPanel from './NotesPanel'

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

const TABS = ['Info', 'Pipeline', 'Credentials', 'Hours', 'Documents', 'Background Check', 'Flags', 'Notes'] as const
type Tab = typeof TABS[number]

// ─── Component ────────────────────────────────────────────────────────────────

export default function VolunteerTabs({
  volunteer,
  credentials,
  documents,
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
}: {
  volunteer: VolunteerDetail
  credentials: Credential[]
  documents: Document[]
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
}) {
  const [activeTab, setActiveTab] = useState<Tab>('Info')

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { label: 'First Name',        value: volunteer.first_name },
                { label: 'Last Name',         value: volunteer.last_name },
                { label: 'Email',             value: volunteer.email },
                { label: 'Phone',             value: volunteer.phone ?? '—' },
                { label: 'Category',          value: volunteer.category.replace(/_/g, ' ') },
                { label: 'Status',            value: volunteer.status },
                { label: 'Emergency Contact', value: volunteer.emergency_contact_name ?? '—' },
                { label: 'Emergency Phone',   value: volunteer.emergency_contact_phone ?? '—' },
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
            </div>

            {/* Tags section */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                Tags
              </p>
              <TagsPanel volunteerId={volunteer.id} appliedTags={appliedTags} orgTags={orgTags} />
            </div>
          </div>
        )}

        {/* ── Pipeline ── */}
        {activeTab === 'Pipeline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
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
          <div>
            {credentials.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>
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
          <div>
            {documents.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>No documents on file</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {documents.map(d => (
                  <div key={d.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderRadius: '10px',
                    border: '1px solid #f3f4f6', background: 'white',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <FileText style={{ width: '20px', height: '20px', color: '#9ca3af' }} />
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{d.name}</p>
                        {d.signed_at && <p style={{ fontSize: '12px', color: '#16a34a' }}>Signed {new Date(d.signed_at).toLocaleDateString()}</p>}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '12px', fontWeight: 500, padding: '3px 8px', borderRadius: '6px',
                      background: d.status === 'signed' ? '#f0fdf4' : d.status === 'expired' ? '#fef2f2' : '#f3f4f6',
                      color: d.status === 'signed' ? '#15803d' : d.status === 'expired' ? '#dc2626' : '#6b7280',
                    }}>
                      {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
