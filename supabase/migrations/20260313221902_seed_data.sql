-- =============================================
-- SEED: Demo organization
-- =============================================

insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'City Free Clinic');

-- =============================================
-- SEED: Locations
-- =============================================

insert into locations (id, org_id, name, address, lat, lng, geofence_radius_meters) values
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'Main Clinic',
    '123 Main St, Springfield, IL 62701',
    39.7817, -89.6501, 100
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'East Side Outreach',
    '456 East Ave, Springfield, IL 62703',
    39.7834, -89.6312, 100
  );

-- =============================================
-- SEED: Onboarding workflow
-- =============================================

insert into onboarding_workflows (id, org_id, name, applies_to_category) values
  (
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000001',
    'Medical Professional Onboarding',
    'medical_professional'
  );

insert into onboarding_stages
  (id, workflow_id, name, description, order_index, stage_type, is_required, deadline_days_after_start)
values
  (
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000020',
    'Submit Application',
    'Complete the initial volunteer application form',
    1, 'form_submission', true, 7
  ),
  (
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000020',
    'Background Check',
    'Authorize and complete background screening',
    2, 'background_check', true, 14
  ),
  (
    '00000000-0000-0000-0000-000000000032',
    '00000000-0000-0000-0000-000000000020',
    'Sign Volunteer Agreement',
    'Review and sign the volunteer agreement document',
    3, 'document_sign', true, 14
  ),
  (
    '00000000-0000-0000-0000-000000000033',
    '00000000-0000-0000-0000-000000000020',
    'Orientation Meeting',
    'Attend mandatory in-person orientation session',
    4, 'in_person_meeting', true, 21
  ),
  (
    '00000000-0000-0000-0000-000000000034',
    '00000000-0000-0000-0000-000000000020',
    'Complete Safety Training',
    'Finish all required safety learning modules',
    5, 'learning_module', true, 30
  );

-- =============================================
-- SEED: Learning modules
-- =============================================

insert into learning_modules (id, org_id, title, description, order_index, is_required, required_for_categories) values
  (
    '00000000-0000-0000-0000-000000000040',
    '00000000-0000-0000-0000-000000000001',
    'Volunteer Safety & Compliance',
    'Required safety training for all volunteers',
    1, true,
    '["medical_professional","support_staff","trainee"]'
  ),
  (
    '00000000-0000-0000-0000-000000000041',
    '00000000-0000-0000-0000-000000000001',
    'Patient Privacy & HIPAA',
    'Understanding patient rights and data privacy',
    2, true,
    '["medical_professional","support_staff"]'
  );

insert into lessons (id, module_id, title, type, content_url, duration_minutes, order_index) values
  (
    '00000000-0000-0000-0000-000000000050',
    '00000000-0000-0000-0000-000000000040',
    'Introduction to Volunteer Safety',
    'video', null, 15, 1
  ),
  (
    '00000000-0000-0000-0000-000000000051',
    '00000000-0000-0000-0000-000000000040',
    'Safety Quiz',
    'quiz', null, 10, 2
  ),
  (
    '00000000-0000-0000-0000-000000000052',
    '00000000-0000-0000-0000-000000000041',
    'HIPAA Basics',
    'video', null, 20, 1
  );

insert into quiz_questions (lesson_id, question, options, correct_answer_index, order_index) values
  (
    '00000000-0000-0000-0000-000000000051',
    'What should you do if you witness an unsafe condition at the clinic?',
    '["Ignore it","Report it to a supervisor immediately","Handle it yourself","Wait until end of shift"]',
    1, 1
  ),
  (
    '00000000-0000-0000-0000-000000000051',
    'PPE should be worn when:',
    '["Only when asked","Never","Any time there is potential exposure to bodily fluids","Only by doctors"]',
    2, 2
  );

-- =============================================
-- SEED: Demo shifts
-- =============================================

insert into shifts (id, org_id, location_id, name, start_time, end_time, required_count) values
  (
    '00000000-0000-0000-0000-000000000060',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'Saturday Morning Clinic',
    now() + interval '2 days',
    now() + interval '2 days' + interval '4 hours',
    5
  ),
  (
    '00000000-0000-0000-0000-000000000061',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000011',
    'Tuesday Evening Outreach',
    now() + interval '5 days',
    now() + interval '5 days' + interval '3 hours',
    3
  );
