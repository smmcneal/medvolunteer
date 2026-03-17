// Auto-generated from supabase/migrations/20260313221607_initial_schema.sql
// Update by running: supabase gen types typescript --local > web/types/database.ts

export type VolunteerCategory =
  | 'medical_professional'
  | 'support_staff'
  | 'admin'
  | 'trainee'
  | 'other'

export type VolunteerStatus =
  | 'applicant'
  | 'prospect'
  | 'volunteer'
  | 'inactive'

export type PipelinePhase =
  | 'intake'
  | 'orientation'
  | 'review'
  | 'training'
  | 'active'
  | 'offboarding'

export type FlagSeverity = 'info' | 'warning' | 'critical'

export type StageType =
  | 'document_sign'
  | 'background_check'
  | 'in_person_meeting'
  | 'learning_module'
  | 'manual_approval'
  | 'form_submission'

export type MessageChannel = 'email' | 'sms' | 'push'
export type MessageRecipientType = 'individual' | 'group' | 'all'
export type CheckMethod = 'geofence' | 'manual' | 'admin'
export type LessonType = 'video' | 'text' | 'quiz'
export type DocumentStatus = 'pending' | 'signed' | 'expired'
export type BackgroundCheckResult = 'clear' | 'consider' | 'suspended' | 'pending'

// ─── Row types (what comes back from SELECT) ──────────────────────────────────

export interface Organization {
  id: string
  name: string
  logo_url: string | null
  settings: Record<string, unknown>
  created_at: string
}

export interface Location {
  id: string
  org_id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  geofence_radius_meters: number
  is_active: boolean
  created_at: string
}

export interface Volunteer {
  id: string
  user_id: string | null
  org_id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  photo_url: string | null
  category: VolunteerCategory
  status: VolunteerStatus
  pipeline_phase: PipelinePhase
  onboarding_workflow_id: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  handbook_signed_at: string | null
  handbook_signed_name: string | null
  checklist_bg_form_signed: boolean
  checklist_video_watched: boolean
  checklist_id_verified: boolean
  checklist_certifications_submitted: boolean
  created_at: string
  updated_at: string
}

export interface Credential {
  id: string
  volunteer_id: string
  type: string
  license_number: string | null
  issuing_body: string | null
  expiration_date: string | null
  document_url: string | null
  verified_at: string | null
  verified_by: string | null
  created_at: string
}

export interface Document {
  id: string
  volunteer_id: string
  name: string
  type: string | null
  status: DocumentStatus
  external_envelope_id: string | null
  signed_at: string | null
  url: string | null
  created_at: string
}

export interface BackgroundCheck {
  id: string
  volunteer_id: string
  provider: string
  external_id: string | null
  status: string
  result: BackgroundCheckResult | null
  report_url: string | null
  initiated_at: string
  completed_at: string | null
}

export interface OnboardingWorkflow {
  id: string
  org_id: string
  name: string
  applies_to_category: VolunteerCategory | null
  is_active: boolean
  created_at: string
}

export interface OnboardingStage {
  id: string
  workflow_id: string
  name: string
  description: string | null
  order_index: number
  stage_type: StageType
  is_required: boolean
  deadline_days_after_start: number | null
  metadata: Record<string, unknown>
}

export interface OnboardingProgress {
  id: string
  volunteer_id: string
  stage_id: string
  completed_at: string | null
  completed_by: string | null
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Shift {
  id: string
  org_id: string
  location_id: string | null
  name: string
  start_time: string
  end_time: string
  required_count: number
  role_requirements: unknown[]
  notes: string | null
  created_at: string
}

export interface ShiftAssignment {
  id: string
  shift_id: string
  volunteer_id: string
  role: string | null
  status: 'assigned' | 'confirmed' | 'cancelled'
  mentor_id: string | null
  created_at: string
}

export interface OrgTag {
  id: string
  org_id: string
  name: string
  color: string
  created_at: string
}

export interface VolunteerTag {
  volunteer_id: string
  tag_id: string
  applied_at: string
  tag?: OrgTag
}

export interface OrgFlag {
  id: string
  org_id: string
  name: string
  description: string | null
  severity: FlagSeverity
  color: string
  created_at: string
}

export interface VolunteerFlag {
  id: string
  volunteer_id: string
  flag_id: string
  notes: string | null
  raised_at: string
  resolved_at: string | null
  resolved_by: string | null
  flag?: OrgFlag
}

export interface VolunteerNote {
  id: string
  volunteer_id: string
  content: string
  created_by: string | null
  created_at: string
}

export interface TimeEntry {
  id: string
  volunteer_id: string
  shift_id: string | null
  location_id: string | null
  clock_in: string
  clock_out: string | null
  duration_minutes: number | null
  method: CheckMethod
  notes: string | null
}

export interface LearningModule {
  id: string
  org_id: string
  title: string
  description: string | null
  order_index: number
  is_required: boolean
  required_for_categories: VolunteerCategory[]
  is_active: boolean
  created_at: string
}

export interface Lesson {
  id: string
  module_id: string
  title: string
  type: LessonType
  content_url: string | null
  content_text: string | null
  duration_minutes: number | null
  order_index: number
  is_active: boolean
}

export interface QuizQuestion {
  id: string
  lesson_id: string
  question: string
  options: string[]
  correct_answer_index: number
  order_index: number
}

export interface LessonCompletion {
  id: string
  volunteer_id: string
  lesson_id: string
  completed_at: string
  score: number | null
  time_spent_seconds: number | null
}

export interface Form {
  id: string
  org_id: string
  name: string
  schema: Record<string, unknown>
  is_active: boolean
  created_at: string
}

export interface FormSubmission {
  id: string
  form_id: string
  volunteer_id: string
  data: Record<string, unknown>
  submitted_at: string
}

export interface Message {
  id: string
  org_id: string
  sender_id: string | null
  subject: string | null
  body: string
  channel: MessageChannel
  recipient_type: MessageRecipientType
  recipient_filter: Record<string, unknown>
  sent_at: string | null
  status: string
  created_at: string
}

export interface MessageRecipient {
  id: string
  message_id: string
  volunteer_id: string
  delivered_at: string | null
  read_at: string | null
}

export interface PushSubscription {
  id: string
  volunteer_id: string
  endpoint: string
  p256dh: string   // public key for message encryption
  auth: string     // auth secret for message encryption
  user_agent: string | null
  created_at: string
}

// ─── Joined / view types ──────────────────────────────────────────────────────

export interface VolunteerUpload {
  id: string
  volunteer_id: string
  name: string
  mime_type: string
  size_bytes: number
  storage_path: string
  uploaded_by: string | null
  uploaded_at: string
}

export interface VolunteerWithLocation extends Volunteer {
  volunteer_locations: { location: Location }[]
}

export interface VolunteerRow extends Volunteer {
  // Computed fields used in the volunteers table
  onboarding_pct?: number
  last_active?: string | null
  locations?: string[]
  tags?: Pick<OrgTag, 'id' | 'name' | 'color'>[]
}

export interface ExpiringCredential extends Credential {
  volunteer: Pick<Volunteer, 'id' | 'first_name' | 'last_name' | 'photo_url'>
  days_until_expiry: number
}

export interface RecentCheckIn extends TimeEntry {
  volunteer: Pick<Volunteer, 'id' | 'first_name' | 'last_name' | 'photo_url' | 'category'>
  location: Pick<Location, 'id' | 'name'> | null
}
