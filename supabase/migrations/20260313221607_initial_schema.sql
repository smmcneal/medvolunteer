-- =============================================
-- ENUMS
-- =============================================

create type volunteer_category as enum (
  'medical_professional', 'support_staff', 'admin', 'trainee', 'other'
);

create type volunteer_status as enum (
  'applicant', 'onboarding', 'active', 'inactive', 'suspended'
);

create type stage_type as enum (
  'document_sign', 'background_check', 'in_person_meeting',
  'learning_module', 'manual_approval', 'form_submission'
);

create type message_channel as enum ('email', 'sms', 'push');

create type message_recipient_type as enum ('individual', 'group', 'all');

create type check_method as enum ('geofence', 'manual', 'admin');

create type lesson_type as enum ('video', 'text', 'quiz');

create type document_status as enum ('pending', 'signed', 'expired');

create type background_check_result as enum ('clear', 'consider', 'suspended', 'pending');

-- =============================================
-- ORGANIZATIONS & LOCATIONS
-- =============================================

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  settings jsonb default '{}',
  created_at timestamptz default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  geofence_radius_meters int default 100,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- =============================================
-- VOLUNTEERS
-- =============================================

create table volunteers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  org_id uuid references organizations(id) on delete cascade not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  photo_url text,
  category volunteer_category not null default 'other',
  status volunteer_status not null default 'applicant',
  onboarding_workflow_id uuid,
  notes text,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table volunteer_locations (
  volunteer_id uuid references volunteers(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade,
  primary key (volunteer_id, location_id)
);

-- =============================================
-- CREDENTIALS & DOCUMENTS
-- =============================================

create table credentials (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid references volunteers(id) on delete cascade not null,
  type text not null,
  license_number text,
  issuing_body text,
  expiration_date date,
  document_url text,
  verified_at timestamptz,
  verified_by uuid references volunteers(id),
  created_at timestamptz default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid references volunteers(id) on delete cascade not null,
  name text not null,
  type text,
  status document_status default 'pending',
  external_envelope_id text,
  signed_at timestamptz,
  url text,
  created_at timestamptz default now()
);

-- =============================================
-- BACKGROUND CHECKS
-- =============================================

create table background_checks (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid references volunteers(id) on delete cascade not null,
  provider text default 'checkr',
  external_id text,
  status text default 'pending',
  result background_check_result,
  report_url text,
  initiated_at timestamptz default now(),
  completed_at timestamptz
);

-- =============================================
-- ONBOARDING WORKFLOWS
-- =============================================

create table onboarding_workflows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  applies_to_category volunteer_category,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table onboarding_stages (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references onboarding_workflows(id) on delete cascade not null,
  name text not null,
  description text,
  order_index int not null,
  stage_type stage_type not null,
  is_required boolean default true,
  deadline_days_after_start int,
  metadata jsonb default '{}'
);

create table onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid references volunteers(id) on delete cascade not null,
  stage_id uuid references onboarding_stages(id) on delete cascade not null,
  completed_at timestamptz,
  completed_by uuid references volunteers(id),
  notes text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  unique(volunteer_id, stage_id)
);

-- =============================================
-- SHIFTS & TIME TRACKING
-- =============================================

create table shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  location_id uuid references locations(id) on delete set null,
  name text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  required_count int default 1,
  role_requirements jsonb default '[]',
  notes text,
  created_at timestamptz default now()
);

create table shift_assignments (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references shifts(id) on delete cascade not null,
  volunteer_id uuid references volunteers(id) on delete cascade not null,
  role text,
  status text default 'assigned',
  created_at timestamptz default now(),
  unique(shift_id, volunteer_id)
);

create table time_entries (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid references volunteers(id) on delete cascade not null,
  shift_id uuid references shifts(id) on delete set null,
  location_id uuid references locations(id) on delete set null,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  duration_minutes int generated always as (
    extract(epoch from (clock_out - clock_in)) / 60
  ) stored,
  method check_method default 'manual',
  notes text
);

-- =============================================
-- LEARNING MANAGEMENT (LMS)
-- =============================================

create table learning_modules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  title text not null,
  description text,
  order_index int default 0,
  is_required boolean default false,
  required_for_categories jsonb default '[]',
  is_active boolean default true,
  created_at timestamptz default now()
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references learning_modules(id) on delete cascade not null,
  title text not null,
  type lesson_type not null,
  content_url text,
  content_text text,
  duration_minutes int,
  order_index int default 0,
  is_active boolean default true
);

create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references lessons(id) on delete cascade not null,
  question text not null,
  options jsonb not null,
  correct_answer_index int not null,
  order_index int default 0
);

create table lesson_completions (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid references volunteers(id) on delete cascade not null,
  lesson_id uuid references lessons(id) on delete cascade not null,
  completed_at timestamptz default now(),
  score int,
  time_spent_seconds int,
  unique(volunteer_id, lesson_id)
);

-- =============================================
-- FORMS
-- =============================================

create table forms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  schema jsonb not null default '{}',
  is_active boolean default true,
  created_at timestamptz default now()
);

create table form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references forms(id) on delete cascade not null,
  volunteer_id uuid references volunteers(id) on delete cascade not null,
  data jsonb not null default '{}',
  submitted_at timestamptz default now()
);

-- =============================================
-- COMMUNICATIONS
-- =============================================

create table messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  sender_id uuid references volunteers(id) on delete set null,
  subject text,
  body text not null,
  channel message_channel not null,
  recipient_type message_recipient_type not null,
  recipient_filter jsonb default '{}',
  sent_at timestamptz,
  status text default 'draft',
  created_at timestamptz default now()
);

create table message_recipients (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id) on delete cascade not null,
  volunteer_id uuid references volunteers(id) on delete cascade not null,
  delivered_at timestamptz,
  read_at timestamptz
);

-- =============================================
-- INDEXES
-- =============================================

create index on volunteers(org_id);
create index on volunteers(status);
create index on volunteers(category);
create index on locations(org_id);
create index on shifts(org_id);
create index on shifts(location_id);
create index on shifts(start_time);
create index on time_entries(volunteer_id);
create index on time_entries(shift_id);
create index on onboarding_progress(volunteer_id);
create index on lesson_completions(volunteer_id);
create index on credentials(volunteer_id);
create index on credentials(expiration_date);

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger volunteers_updated_at
  before update on volunteers
  for each row execute function update_updated_at();
