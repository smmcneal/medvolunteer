import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_noStore as noStore } from 'next/cache'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone, MapPin, Calendar } from 'lucide-react'
import VolunteerTabs from './VolunteerTabs'
import type {
  Volunteer, Credential, Document, BackgroundCheck,
  OnboardingStage, OnboardingProgress, TimeEntry,
  LessonCompletion, Location,
  OrgTag, OrgFlag, VolunteerFlag, VolunteerNote, VolunteerUpload,
} from '@/types/database'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VolunteerDetail extends Volunteer {
  locations: Location[]
}

export interface OnboardingStageWithProgress extends OnboardingStage {
  progress: OnboardingProgress | null
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function fetchVolunteer(id: string) {
  noStore()
  const supabase = createAdminClient()

  const [volunteerRes, credsRes, docsRes, bgCheckRes, timeRes, learningRes,
         notesRes, volTagsRes, volFlagsRes, orgTagsRes, orgFlagsRes, uploadsRes, orgLocationsRes, orgSettingsRes] = await Promise.all([
    supabase
      .from('volunteers')
      .select('*, volunteer_locations(location:locations(*))')
      .eq('id', id)
      .single(),
    supabase.from('credentials').select('*').eq('volunteer_id', id).order('expiration_date', { ascending: true }),
    supabase.from('documents').select('*').eq('volunteer_id', id).order('created_at', { ascending: false }),
    supabase.from('background_checks').select('*').eq('volunteer_id', id).order('initiated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('time_entries').select('*, location:locations(name)').eq('volunteer_id', id).order('clock_in', { ascending: false }).limit(20),
    supabase.from('lesson_completions').select('*, lesson:lessons(*, module:learning_modules(title))').eq('volunteer_id', id),
    supabase.from('volunteer_notes').select('*').eq('volunteer_id', id).order('created_at', { ascending: false }),
    supabase.from('volunteer_tags').select('tag:org_tags(*)').eq('volunteer_id', id),
    supabase.from('volunteer_flags').select('*, flag:org_flags(*)').eq('volunteer_id', id).order('raised_at', { ascending: false }),
    supabase.from('org_tags').select('*').order('name'),
    supabase.from('org_flags').select('*').order('name'),
    supabase.from('volunteer_uploads').select('*').eq('volunteer_id', id).order('uploaded_at', { ascending: false }),
    supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
    supabase.from('organizations').select('settings').limit(1).single(),
  ])

  if (!volunteerRes.data) return null

  // Onboarding stages + progress
  const workflowId = volunteerRes.data.onboarding_workflow_id
  let onboardingStages: OnboardingStageWithProgress[] = []

  if (workflowId) {
    const [stagesRes, progressRes] = await Promise.all([
      supabase.from('onboarding_stages').select('*').eq('workflow_id', workflowId).order('order_index'),
      supabase.from('onboarding_progress').select('*').eq('volunteer_id', id),
    ])
    const progressMap: Record<string, OnboardingProgress> = {}
    for (const p of (progressRes.data ?? [])) progressMap[p.stage_id] = p
    onboardingStages = (stagesRes.data ?? []).map(s => ({ ...s, progress: progressMap[s.id] ?? null }))
  }

  const volunteer: VolunteerDetail = {
    ...volunteerRes.data,
    locations: (volunteerRes.data.volunteer_locations ?? [])
      .map((vl: { location: Location }) => vl.location)
      .filter(Boolean),
  }

  // Tags
  const appliedTags = (volTagsRes.data ?? [])
    .map((vt: any) => vt.tag as OrgTag | null)
    .filter(Boolean) as OrgTag[]

  // Flags split into active / resolved
  const allFlags = (volFlagsRes.data ?? []) as (VolunteerFlag & { flag: OrgFlag })[]
  const activeFlags   = allFlags.filter(f => !f.resolved_at)
  const resolvedFlags = allFlags.filter(f => !!f.resolved_at)

  const jotformApiKey = ((orgSettingsRes.data?.settings as Record<string, unknown>)?.jotform_api_key as string) ?? null

  return {
    volunteer,
    credentials:       (credsRes.data ?? []) as Credential[],
    documents:         (docsRes.data ?? []) as Document[],
    uploads:           (uploadsRes.data ?? []) as VolunteerUpload[],
    backgroundCheck:   bgCheckRes.data as BackgroundCheck | null,
    timeEntries:       (timeRes.data ?? []) as (TimeEntry & { location: { name: string } | null })[],
    onboardingStages,
    lessonCompletions: (learningRes.data ?? []) as LessonCompletion[],
    notes:             (notesRes.data ?? []) as VolunteerNote[],
    appliedTags,
    activeFlags,
    resolvedFlags,
    orgTags:      (orgTagsRes.data ?? []) as OrgTag[],
    orgFlags:     (orgFlagsRes.data ?? []) as OrgFlag[],
    orgLocations: (orgLocationsRes.data ?? []) as Pick<Location, 'id' | 'name'>[],
    jotformApiKey,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  medical_professional: 'Medical Professional',
  support_staff: 'Support Staff',
  admin: 'Admin',
  trainee: 'Trainee',
  other: 'Other',
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  applicant: { bg: '#f3f4f6', text: '#374151', dot: '#9ca3af' },
  prospect:  { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  volunteer: { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e' },
  inactive:  { bg: '#f9fafb', text: '#6b7280', dot: '#d1d5db' },
}

const STATUS_LABELS: Record<string, string> = {
  applicant: 'Applicant',
  prospect:  'Prospect',
  volunteer: 'Volunteer',
  inactive:  'Inactive',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function VolunteerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await fetchVolunteer(id)
  if (!data) notFound()

  const {
    volunteer, credentials, documents, uploads, backgroundCheck,
    timeEntries, onboardingStages, lessonCompletions,
    notes, appliedTags, activeFlags, resolvedFlags, orgTags, orgFlags, orgLocations,
    jotformApiKey,
  } = data

  const statStyle = STATUS_COLORS[volunteer.status] ?? STATUS_COLORS.inactive
  const totalHours = timeEntries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0) / 60

  return (
    <div style={{ padding: '32px', maxWidth: '1100px' }}>

      <Link href="/dashboard/volunteers" style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        fontSize: '13px', color: '#6b7280', textDecoration: 'none', marginBottom: '20px',
      }}>
        <ArrowLeft style={{ width: '14px', height: '14px' }} /> Back to Volunteers
      </Link>

      {/* Profile header */}
      <div style={{
        background: 'white', borderRadius: '12px', border: '1px solid #f0f0f0',
        padding: '24px 28px', display: 'flex', alignItems: 'flex-start',
        gap: '20px', marginBottom: '20px',
      }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%', background: '#1B2A4A1a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', fontWeight: 700, color: '#1B2A4A', flexShrink: 0,
        }}>
          {volunteer.first_name[0]}{volunteer.last_name[0]}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>
              {volunteer.first_name} {volunteer.last_name}
            </h1>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              fontSize: '12px', fontWeight: 500, padding: '3px 9px', borderRadius: '6px',
              background: statStyle.bg, color: statStyle.text,
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statStyle.dot }} />
              {STATUS_LABELS[volunteer.status] ?? volunteer.status}
            </span>
            {/* Active flag count badge */}
            {activeFlags.length > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#fef2f2', color: '#dc2626' }}>
                ⛔ {activeFlags.length} flag{activeFlags.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '10px' }}>
            {CATEGORY_LABELS[volunteer.category]}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#374151' }}>
              <Mail style={{ width: '13px', height: '13px', color: '#9ca3af' }} />
              {volunteer.email}
            </span>
            {volunteer.phone && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#374151' }}>
                <Phone style={{ width: '13px', height: '13px', color: '#9ca3af' }} />
                {volunteer.phone}
              </span>
            )}
            {volunteer.locations.map(l => (
              <span key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#374151' }}>
                <MapPin style={{ width: '13px', height: '13px', color: '#9ca3af' }} />
                {l.name}
              </span>
            ))}
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#374151' }}>
              <Calendar style={{ width: '13px', height: '13px', color: '#9ca3af' }} />
              Joined {new Date(volunteer.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px', flexShrink: 0 }}>
          {[
            { label: 'Total Hours',  value: totalHours.toFixed(1) },
            { label: 'Credentials', value: credentials.length },
            { label: 'Lessons Done', value: lessonCompletions.length },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>{value}</p>
              <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <VolunteerTabs
        volunteer={volunteer}
        credentials={credentials}
        documents={documents}
        uploads={uploads}
        backgroundCheck={backgroundCheck}
        timeEntries={timeEntries}
        onboardingStages={onboardingStages}
        lessonCompletions={lessonCompletions}
        notes={notes}
        appliedTags={appliedTags}
        activeFlags={activeFlags}
        resolvedFlags={resolvedFlags}
        orgTags={orgTags}
        orgFlags={orgFlags}
        orgLocations={orgLocations}
        jotformApiKey={jotformApiKey}
      />
    </div>
  )
}
