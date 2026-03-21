-- =============================================
-- DEMO SEED DATA
-- Run in Supabase SQL Editor AFTER migrations are pushed.
-- Safe to re-run (ON CONFLICT DO NOTHING throughout).
-- All timestamps use now() arithmetic — always current.
-- =============================================

-- =============================================
-- VOLUNTEERS (14 total)
-- =============================================

INSERT INTO volunteers (id, org_id, first_name, last_name, email, phone, category, status, created_at, updated_at) VALUES
  -- Active medical professionals
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Sarah',   'Chen',       'sarah.chen@example.com',    '555-0101', 'medical_professional', 'volunteer',  now() - interval '8 months',  now() - interval '1 month'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Marcus',  'Williams',   'marcus.w@example.com',       '555-0102', 'medical_professional', 'volunteer',  now() - interval '6 months',  now() - interval '2 weeks'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Priya',   'Patel',      'priya.patel@example.com',    '555-0103', 'medical_professional', 'volunteer',  now() - interval '1 year',    now() - interval '3 weeks'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', 'James',   'Okafor',     'james.o@example.com',        '555-0104', 'medical_professional', 'volunteer',  now() - interval '4 months',  now() - interval '1 week'),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001', 'Elena',   'Rodriguez',  'elena.r@example.com',        '555-0105', 'medical_professional', 'volunteer',  now() - interval '9 months',  now() - interval '4 days'),
  -- Active support staff
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000001', 'David',   'Kim',        'david.kim@example.com',      '555-0106', 'support_staff',        'volunteer',  now() - interval '5 months',  now() - interval '10 days'),
  ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000001', 'Aisha',   'Johnson',    'aisha.j@example.com',        '555-0107', 'support_staff',        'volunteer',  now() - interval '7 months',  now() - interval '2 weeks'),
  ('00000000-0000-0000-0000-000000000108', '00000000-0000-0000-0000-000000000001', 'Robert',  'Martinez',   'robert.m@example.com',       '555-0108', 'support_staff',        'volunteer',  now() - interval '3 months',  now() - interval '5 days'),
  -- Active trainees
  ('00000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-000000000001', 'Lily',    'Thompson',   'lily.t@example.com',         '555-0109', 'trainee',              'volunteer',  now() - interval '2 months',  now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000000110', '00000000-0000-0000-0000-000000000001', 'Noah',    'Garcia',     'noah.g@example.com',         '555-0110', 'trainee',              'volunteer',  now() - interval '6 weeks',   now() - interval '1 week'),
  -- Onboarding (prospect)
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000001', 'Fatima',  'Hassan',     'fatima.h@example.com',       '555-0111', 'medical_professional', 'prospect',   now() - interval '3 weeks',   now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000112', '00000000-0000-0000-0000-000000000001', 'Carlos',  'Nguyen',     'carlos.n@example.com',       '555-0112', 'support_staff',        'prospect',   now() - interval '2 weeks',   now() - interval '1 day'),
  -- Applicants
  ('00000000-0000-0000-0000-000000000113', '00000000-0000-0000-0000-000000000001', 'Zoe',     'Andersen',   'zoe.a@example.com',          '555-0113', 'medical_professional', 'applicant',  now() - interval '5 days',    now() - interval '5 days'),
  ('00000000-0000-0000-0000-000000000114', '00000000-0000-0000-0000-000000000001', 'Tyler',   'Brooks',     'tyler.b@example.com',        '555-0114', 'trainee',              'applicant',  now() - interval '3 days',    now() - interval '3 days')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- TIME ENTRIES
-- =============================================

-- Currently clocked in (clock_out IS NULL) → drives "Clocked In Now" KPI
INSERT INTO time_entries (id, volunteer_id, location_id, clock_in, clock_out, method) VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000010', now() - interval '2 hours',            NULL, 'geofence'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000010', now() - interval '1 hour 30 minutes',   NULL, 'manual'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000011', now() - interval '3 hours',             NULL, 'geofence')
ON CONFLICT (id) DO NOTHING;

-- Completed entries this month → drives "Hours This Month" KPI
INSERT INTO time_entries (id, volunteer_id, location_id, clock_in, clock_out, method) VALUES
  ('00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000010', now() - interval '7 days',  now() - interval '7 days'  + interval '4 hours', 'geofence'),
  ('00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000010', now() - interval '14 days', now() - interval '14 days' + interval '4 hours', 'geofence'),
  ('00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000010', now() - interval '5 days',  now() - interval '5 days'  + interval '6 hours', 'manual'),
  ('00000000-0000-0000-0000-000000000213', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000011', now() - interval '10 days', now() - interval '10 days' + interval '4 hours', 'geofence'),
  ('00000000-0000-0000-0000-000000000214', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000010', now() - interval '3 days',  now() - interval '3 days'  + interval '3 hours', 'manual'),
  ('00000000-0000-0000-0000-000000000215', '00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000011', now() - interval '8 days',  now() - interval '8 days'  + interval '5 hours', 'geofence'),
  ('00000000-0000-0000-0000-000000000216', '00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000010', now() - interval '12 days', now() - interval '12 days' + interval '4 hours', 'manual'),
  ('00000000-0000-0000-0000-000000000217', '00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000011', now() - interval '6 days',  now() - interval '6 days'  + interval '4 hours', 'geofence'),
  ('00000000-0000-0000-0000-000000000218', '00000000-0000-0000-0000-000000000108', '00000000-0000-0000-0000-000000000010', now() - interval '4 days',  now() - interval '4 days'  + interval '3 hours', 'manual'),
  ('00000000-0000-0000-0000-000000000219', '00000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-000000000011', now() - interval '9 days',  now() - interval '9 days'  + interval '2 hours', 'geofence')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- CREDENTIALS (some expiring within 30 days)
-- =============================================

INSERT INTO credentials (id, volunteer_id, type, license_number, issuing_body, expiration_date, verified_at) VALUES
  -- Expiring in ~7 days → urgent
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', 'CPR Certification',  'CPR-2021-4892',  'American Red Cross',                              (now() + interval '7 days')::date,   now() - interval '2 years'),
  -- Expiring in ~12 days
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000102', 'Medical License',    'ML-IL-38291',    'IL Dept of Financial & Professional Regulation',  (now() + interval '12 days')::date,  now() - interval '1 year'),
  -- Expiring in ~21 days
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000105', 'CPR Certification',  'CPR-2023-7741',  'American Heart Association',                      (now() + interval '21 days')::date,  now() - interval '2 years'),
  -- Not expiring soon (background data)
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000103', 'Nursing License',    'NL-IL-55123',    'IL Dept of Financial & Professional Regulation',  (now() + interval '400 days')::date, now() - interval '6 months'),
  ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000104', 'CPR Certification',  'CPR-2024-1193',  'American Red Cross',                              (now() + interval '180 days')::date, now() - interval '6 months'),
  ('00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000107', 'First Aid',          'FA-2024-0042',   'American Red Cross',                              (now() + interval '300 days')::date, now() - interval '4 months')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SHIFTS (next 4 weeks, partial fills → open spots)
-- =============================================

INSERT INTO shifts (id, org_id, location_id, name, start_time, end_time, required_count) VALUES
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'Saturday Morning Clinic',    now() + interval '9 days',  now() + interval '9 days'  + interval '4 hours', 4),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'Wednesday Evening Outreach', now() + interval '12 days', now() + interval '12 days' + interval '3 hours', 3),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'Saturday Morning Clinic',    now() + interval '16 days', now() + interval '16 days' + interval '4 hours', 5),
  ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'Tuesday Evening Outreach',   now() + interval '19 days', now() + interval '19 days' + interval '3 hours', 3)
ON CONFLICT (id) DO NOTHING;

-- Partial shift assignments → open spots show in KPI
INSERT INTO shift_assignments (shift_id, volunteer_id, role, status) VALUES
  -- Shift 401: need 4, assign 2 → 2 open
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', 'Medical Lead', 'assigned'),
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000106', 'Support',      'assigned'),
  -- Shift 402: need 3, assign 1 → 2 open
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000107', 'Support',      'assigned'),
  -- Shift 403: need 5, assign 3 → 2 open
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000102', 'Medical Lead', 'assigned'),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000103', 'Medical',      'assigned'),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000108', 'Support',      'assigned'),
  -- Shift 404: need 3, assign 1 → 2 open
  ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000105', 'Medical',      'assigned')
ON CONFLICT (shift_id, volunteer_id) DO NOTHING;

-- =============================================
-- MESSAGES
-- =============================================

INSERT INTO messages (id, org_id, subject, body, channel, recipient_type, sent_at, status) VALUES
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000001',
   'Upcoming Shift Reminder',
   'Hi everyone — this is a reminder that Saturday Morning Clinic is coming up next weekend. Please confirm your availability by Thursday.',
   'email', 'all', now() - interval '3 days', 'sent'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000001',
   'Credential Renewal Reminder',
   'Several volunteers have certifications expiring in the next 30 days. Please renew before your next scheduled shift.',
   'email', 'group', now() - interval '1 day', 'sent'),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000001',
   'New Volunteer Orientation — Next Week',
   'We have two new volunteers joining us next week. Please give them a warm welcome and help them get oriented at the clinic.',
   'email', 'all', NULL, 'draft')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- LESSON COMPLETIONS
-- =============================================

INSERT INTO lesson_completions (volunteer_id, lesson_id, completed_at, score, time_spent_seconds) VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000050', now() - interval '8 months',  NULL, 920),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000051', now() - interval '8 months',  100,  610),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000052', now() - interval '8 months',  NULL, 1240),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000050', now() - interval '6 months',  NULL, 850),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000051', now() - interval '6 months',  90,   540),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000050', now() - interval '1 year',    NULL, 900),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000051', now() - interval '1 year',    95,   580),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000052', now() - interval '1 year',    NULL, 1300),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000050', now() - interval '4 months',  NULL, 870),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000051', now() - interval '4 months',  85,   600),
  ('00000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-000000000050', now() - interval '2 months',  NULL, 960),
  ('00000000-0000-0000-0000-000000000110', '00000000-0000-0000-0000-000000000050', now() - interval '5 weeks',   NULL, 1010)
ON CONFLICT (volunteer_id, lesson_id) DO NOTHING;
