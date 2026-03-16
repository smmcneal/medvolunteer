-- Test volunteers (no auth users required — user_id is nullable)
insert into volunteers (id, org_id, first_name, last_name, email, phone, category, status, pipeline_phase) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Alice',   'Nguyen',   'alice@example.com',   '555-0101', 'medical_professional', 'volunteer',  'active'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Ben',     'Carter',   'ben@example.com',     '555-0102', 'medical_professional', 'volunteer',  'active'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Cora',    'Patel',    'cora@example.com',    '555-0103', 'support_staff',        'prospect',   'training'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'David',   'Kim',      'david@example.com',   '555-0104', 'support_staff',        'prospect',   'orientation'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Elena',   'Torres',   'elena@example.com',   '555-0105', 'medical_professional', 'prospect',   'review'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Frank',   'Osei',     'frank@example.com',   '555-0106', 'admin',                'applicant',  'intake'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Grace',   'Lim',      'grace@example.com',   '555-0107', 'medical_professional', 'inactive',   'offboarding'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Hector',  'Reyes',    'hector@example.com',  '555-0108', 'support_staff',        'applicant',  'intake'),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Ivy',     'Walsh',    'ivy@example.com',     '555-0109', 'medical_professional', 'volunteer',  'active'),
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'James',   'Abbott',   'james@example.com',   '555-0110', 'admin',                'prospect',   'training')
on conflict (id) do nothing;
