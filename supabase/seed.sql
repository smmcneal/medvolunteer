-- =============================================================================
-- SEED AUTH USERS
-- Dashboard admin + 3 test volunteers for /volunteer portal
-- All passwords: volunteer123   |   Admin password: admin123
-- =============================================================================

insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at
) values
  -- Dashboard admin
  (
    'c0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'admin@medvolunteer.org',
    crypt('admin123', gen_salt('bf')),
    now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', now(), now()
  ),
  -- Alice Nguyen (volunteer)
  (
    'c0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'alice@example.com',
    crypt('volunteer123', gen_salt('bf')),
    now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', now(), now()
  ),
  -- Ben Carter (volunteer)
  (
    'c0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'ben@example.com',
    crypt('volunteer123', gen_salt('bf')),
    now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', now(), now()
  ),
  -- Cora Patel (trainee / prospect)
  (
    'c0000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'cora@example.com',
    crypt('volunteer123', gen_salt('bf')),
    now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', now(), now()
  )
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
) values
  (
    'c0000000-0000-0000-0001-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'admin@medvolunteer.org', 'email',
    jsonb_build_object('sub', 'c0000000-0000-0000-0000-000000000001', 'email', 'admin@medvolunteer.org'),
    now(), now(), now()
  ),
  (
    'c0000000-0000-0000-0001-000000000002',
    'c0000000-0000-0000-0000-000000000002',
    'alice@example.com', 'email',
    jsonb_build_object('sub', 'c0000000-0000-0000-0000-000000000002', 'email', 'alice@example.com'),
    now(), now(), now()
  ),
  (
    'c0000000-0000-0000-0001-000000000003',
    'c0000000-0000-0000-0000-000000000003',
    'ben@example.com', 'email',
    jsonb_build_object('sub', 'c0000000-0000-0000-0000-000000000003', 'email', 'ben@example.com'),
    now(), now(), now()
  ),
  (
    'c0000000-0000-0000-0001-000000000004',
    'c0000000-0000-0000-0000-000000000004',
    'cora@example.com', 'email',
    jsonb_build_object('sub', 'c0000000-0000-0000-0000-000000000004', 'email', 'cora@example.com'),
    now(), now(), now()
  )
on conflict (id) do nothing;

-- ─── Org tags ─────────────────────────────────────────────────────────────────
insert into org_tags (id, org_id, name, color) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'CPR Certified',     '#16a34a'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Bilingual',         '#2563eb'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Driver',            '#7c3aed'),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Night Shift OK',    '#0891b2'),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Remote Only',       '#9ca3af')
on conflict (id) do nothing;

-- ─── Org flags ─────────────────────────────────────────────────────────────────
insert into org_flags (id, org_id, name, description, severity, color) values
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Missing Documents',  'Required paperwork not yet received',  'warning',  '#f59e0b'),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Attendance Issue',   'Multiple no-shows or late arrivals',    'warning',  '#f97316'),
  ('b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Credential Expired', 'One or more credentials have expired',  'critical', '#dc2626'),
  ('b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Under Review',       'Pending investigation or evaluation',   'info',     '#2563eb'),
  ('b0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Onboarding Stalled', 'Has not progressed in 30+ days',        'info',     '#6b7280')
on conflict (id) do nothing;

-- ─── Admin role ───────────────────────────────────────────────────────────────
-- The dashboard admin must be in admin_users (the migration bootstrap runs
-- before seed creates this auth user, so insert explicitly here).
insert into admin_users (user_id) values
  ('c0000000-0000-0000-0000-000000000001')
on conflict (user_id) do nothing;

-- ─── Test volunteers ──────────────────────────────────────────────────────────
-- Alice, Ben, Cora have auth accounts; the rest are admin-created (no portal login)
insert into volunteers (id, org_id, user_id, first_name, last_name, email, phone, category, status, pipeline_phase) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Alice',   'Nguyen',   'alice@example.com',   '555-0101', 'medical_professional', 'volunteer',  'active'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Ben',     'Carter',   'ben@example.com',     '555-0102', 'medical_professional', 'volunteer',  'active'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Cora',    'Patel',    'cora@example.com',    '555-0103', 'support_staff',        'prospect',   'training'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', null,                                   'David',   'Kim',      'david@example.com',   '555-0104', 'support_staff',        'prospect',   'orientation'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', null,                                   'Elena',   'Torres',   'elena@example.com',   '555-0105', 'medical_professional', 'prospect',   'review'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', null,                                   'Frank',   'Osei',     'frank@example.com',   '555-0106', 'admin',                'applicant',  'intake'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', null,                                   'Grace',   'Lim',      'grace@example.com',   '555-0107', 'medical_professional', 'inactive',   'offboarding'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', null,                                   'Hector',  'Reyes',    'hector@example.com',  '555-0108', 'support_staff',        'applicant',  'intake'),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', null,                                   'Ivy',     'Walsh',    'ivy@example.com',     '555-0109', 'medical_professional', 'volunteer',  'active'),
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', null,                                   'James',   'Abbott',   'james@example.com',   '555-0110', 'admin',                'prospect',   'training')
on conflict (id) do nothing;
