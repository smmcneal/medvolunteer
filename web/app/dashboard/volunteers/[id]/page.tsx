import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone, MapPin, Calendar } from 'lucide-react'
import VolunteerTabs from './VolunteerTabs'
import type {
  Volunteer, Credential, Document, BackgroundCheck,
  OnboardingStage, OnboardingProgress, TimeEntry,
  LearningModule, Lesson, LessonCompletion, Location,
} from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VolunteerDetail extends Volunteer {
  locations: Location[]
}

export interface OnboardingStageWithProgress extends OnboardingStage {
  progress: OnboardingProgress | null
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function fetchVolunteer(id: string) {
  const supabase = await createClient()

  const [volunteerRes, credsRes, docsRes, bgCheckRes, timeRes, learningRes] = await Promise.all([
    supabase
      .from('volunteers')
      .select(`
        *,
        volunteer_locations(location:locations(*))
      `)
      .eq('id', id)
      .single(),

    supabase
      .from('credentials')
      .select('*')
      .eq('volunteer_id', id)
      .order('expiration_date', { ascending: true }),

    supabase
      .from('documents')
      .select('*')
      .eq('volunteer_id', id)
      .order('created_at', { ascending: false }),

    supabase
      .from('background_checks')
      .select('*')
      .eq('volunteer_id', id)
      .order('initiated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('time_entries')
      .select('*, location:locations(name)')
      .eq('volunteer_id', id)
      .order('clock_in', { ascending: false })
      .limit(20),

    supabase
      .from('lesson_completions')
      .select('*, lesson:lessons(*, module:learning_modules(title))')
      .eq('volunteer_id', id),
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

    onboardingStages = (stagesRes.data ?? []).map(s => ({
      ...s,
      progress: progressMap[s.id] ?? null,
    }))
  }

  const volunteer: VolunteerDetail = {
    ...volunteerRes.data,
    locations: (volunteerRes.data.volunteer_locations ?? [])
      .map((vl: { location: Location }) => vl.location)
      .filter(Boolean),
  }

  return {
    volunteer,
    credentials: (credsRes.data ?? []) as Credential[],
    documents: (docsRes.data ?? []) as Document[],
    backgroundCheck: bgCheckRes.data as BackgroundCheck | null,
    timeEntries: (timeRes.data ?? []) as (TimeEntry & { location: { name: string } | null })[],
    onboardingStages,
    lessonCompletions: (learningRes.data ?? []) as LessonCompletion[],
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
  applicant:  { bg: '#f3f4f6', text: '#374151', dot: '#9ca3af' },
  onboarding: { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  active:     { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e' },
  inactive:   { bg: '#f9fafb', text: '#6b7280', dot: '#d1d5db' },
  suspended:  { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function VolunteerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await fetchVolunteer(id)
  if (!data) notFound()

  const { volunteer, credentials, documents, backgroundCheck, timeEntries, onboardingStages, lessonCompletions } = data
  const statStyle = STATUS_COLORS[volunteer.status] ?? STATUS_COLORS.inactive

  const totalHours = timeEntries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0) / 60

  return (
    <div style={{ padding: '32px', maxWidth: '1100px' }}>

      {/* Back */}
      <Link href="/dashboard/volunteers" style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        fontSize: '13px', color: '#6b7280', textDecoration: 'none', marginBottom: '20px',
      }}>
        <ArrowLeft style={{ width: '14px', height: '14px' }} /> Back to Volunteers
      </Link>

      {/* Profile header */}
      <div style={{
        background: 'white', borderRadius: '12px',
        border: '1px solid #f0f0f0', padding: '24px 28px',
        display: 'flex', alignItems: 'flex-start', gap: '20px',
        marginBottom: '20px',
      }}>
        {/* Avatar */}
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: '#1B2A4A1a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', fontWeight: 700, color: '#1B2A4A', flexShrink: 0,
        }}>
          {volunteer.first_name[0]}{volunteer.last_name[0]}
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>
              {volunteer.first_name} {volunteer.last_name}
            </h1>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              fontSize: '12px', fontWeight: 500, padding: '3px 9px', borderRadius: '6px',
              background: statStyle.bg, color: statStyle.text,
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statStyle.dot }} />
              {volunteer.status.charAt(0).toUpperCase() + volunteer.status.slice(1)}
            </span>
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

        {/* Stats */}
        <div style={{ display: 'flex', gap: '24px', flexShrink: 0 }}>
          {[
            { label: 'Total Hours',   value: totalHours.toFixed(1) },
            { label: 'Credentials',   value: credentials.length },
            { label: 'Lessons Done',  value: lessonCompletions.length },
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
        backgroundCheck={backgroundCheck}
        timeEntries={timeEntries}
        onboardingStages={onboardingStages}
        lessonCompletions={lessonCompletions}
      />
    </div>
  )
}
