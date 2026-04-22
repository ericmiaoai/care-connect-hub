-- =============================================================================
-- CareSync — Seed Data Script
-- =============================================================================
-- INSTRUCTIONS — Read before running:
--
-- This script must be run AFTER you create your first account in the app.
-- It references your real user ID from Supabase Auth.
--
-- Step 1: Open the CareSync app and complete registration + onboarding.
-- Step 2: Go to your Supabase dashboard → Authentication → Users
-- Step 3: Copy the "User UID" shown next to your email address.
-- Step 4: Paste it below, replacing the text YOUR_USER_UUID_HERE (keep the quotes).
-- Step 5: Run this entire script in Supabase → SQL Editor.
--
-- The script is safe to re-run. It uses IF NOT EXISTS / ON CONFLICT guards.
-- =============================================================================

DO $$
DECLARE
  -- ⬇️  PASTE YOUR USER UUID HERE ⬇️
  v_user_id       UUID := 'ed442651-208c-4a2a-83b1-8c047979b72c';
  -- ⬆️  PASTE YOUR USER UUID HERE ⬆️

  v_circle_id     UUID;
  v_patient_id    UUID;
  v_today         TIMESTAMPTZ := date_trunc('day', NOW());

BEGIN

  -- ── 1. CARE CIRCLE ─────────────────────────────────────────────────────────
  -- Get existing circle if the user already created one via onboarding,
  -- otherwise create a new one for demo purposes.
  SELECT care_circle_id INTO v_circle_id
  FROM public.care_circle_members
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_circle_id IS NULL THEN
    INSERT INTO public.care_circles (name, created_by)
    VALUES ('Johnson Family Care Circle', v_user_id)
    RETURNING id INTO v_circle_id;

    INSERT INTO public.care_circle_members (care_circle_id, user_id, role)
    VALUES (v_circle_id, v_user_id, 'admin');
  END IF;

  -- ── 2. PATIENT ─────────────────────────────────────────────────────────────
  -- Check if a patient already exists for this circle
  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE care_circle_id = v_circle_id
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    INSERT INTO public.patients (care_circle_id, first_name, last_name, date_of_birth)
    VALUES (v_circle_id, 'Robert', 'Johnson', '1948-03-15')
    RETURNING id INTO v_patient_id;
  END IF;

  -- ── 3. TASKS (My Day) ──────────────────────────────────────────────────────
  -- 8 tasks representing a realistic care day for Robert.
  -- All due today. Uses ON CONFLICT (title, care_circle_id) would be complex,
  -- so we clear existing seed tasks first to ensure clean re-runs.
  DELETE FROM public.tasks
  WHERE care_circle_id = v_circle_id
    AND created_by = v_user_id;

  INSERT INTO public.tasks
    (care_circle_id, patient_id, title, notes, status, priority, assigned_to, due_date, created_by)
  VALUES
    (v_circle_id, v_patient_id,
     'Blood pressure check',
     'Log both systolic and diastolic readings in Robert''s health journal.',
     'pending', 'high', v_user_id,
     v_today + INTERVAL '7 hours 30 minutes', v_user_id),

    (v_circle_id, v_patient_id,
     'Lisinopril 10mg — Morning dose',
     '1 tablet with breakfast. Do not skip — manages blood pressure.',
     'pending', 'critical', v_user_id,
     v_today + INTERVAL '8 hours', v_user_id),

    (v_circle_id, v_patient_id,
     'Metformin 500mg — Morning dose',
     '1 tablet with food. Take with breakfast to reduce stomach upset.',
     'pending', 'critical', v_user_id,
     v_today + INTERVAL '8 hours', v_user_id),

    (v_circle_id, v_patient_id,
     'Cardiology follow-up — Dr. Patel',
     'Bring the AVS folder from the last hospital visit. Valley Heart Center, Suite 200.',
     'pending', 'high', v_user_id,
     v_today + INTERVAL '10 hours 30 minutes', v_user_id),

    (v_circle_id, v_patient_id,
     'Atorvastatin 20mg — With lunch',
     'Take after meal. Manages cholesterol levels per Dr. Patel''s orders.',
     'pending', 'medium', v_user_id,
     v_today + INTERVAL '12 hours', v_user_id),

    (v_circle_id, v_patient_id,
     'Physical therapy pickup',
     'Pick up from Valley Rehab, front entrance, Building B. ETA 2 PM.',
     'pending', 'medium', v_user_id,
     v_today + INTERVAL '14 hours', v_user_id),

    (v_circle_id, v_patient_id,
     'Lisinopril 10mg — Evening dose',
     'Second daily dose. Take with dinner.',
     'pending', 'critical', v_user_id,
     v_today + INTERVAL '18 hours', v_user_id),

    (v_circle_id, v_patient_id,
     'Wound dressing change',
     'Left forearm. Use sterile gauze from the blue kit in the bathroom cabinet.',
     'pending', 'high', v_user_id,
     v_today + INTERVAL '21 hours', v_user_id);

  -- ── 4. CALENDAR EVENTS ─────────────────────────────────────────────────────
  DELETE FROM public.calendar_events
  WHERE care_circle_id = v_circle_id
    AND created_by = v_user_id;

  INSERT INTO public.calendar_events
    (care_circle_id, patient_id, title, description, location, start_time, end_time, created_by)
  VALUES
    -- Today
    (v_circle_id, v_patient_id,
     'Cardiology Follow-Up',
     'Post-discharge check with Dr. Patel. Bring AVS documents.',
     'Valley Heart Center, Suite 200',
     v_today + INTERVAL '10 hours 30 minutes',
     v_today + INTERVAL '11 hours 30 minutes',
     v_user_id),

    -- Tomorrow
    (v_circle_id, v_patient_id,
     'Physical Therapy Session',
     'Lower body strengthening program — 45 minutes.',
     'Valley Rehab Center, Building B',
     v_today + INTERVAL '1 day 9 hours',
     v_today + INTERVAL '1 day 10 hours',
     v_user_id),

    -- Day after tomorrow
    (v_circle_id, v_patient_id,
     'Morning Medications',
     'Lisinopril + Metformin with breakfast.',
     NULL,
     v_today + INTERVAL '2 days 8 hours',
     v_today + INTERVAL '2 days 8 hours 15 minutes',
     v_user_id),

    -- Day 3
    (v_circle_id, v_patient_id,
     'Lab Draw — Fasting Blood Panel',
     'No food after midnight. Bring insurance card.',
     'Valley Medical Lab, Ground Floor',
     v_today + INTERVAL '3 days 7 hours 30 minutes',
     v_today + INTERVAL '3 days 8 hours 30 minutes',
     v_user_id),

    -- Day 4
    (v_circle_id, v_patient_id,
     'Pharmacy Run',
     'Pick up Metformin refill (90-day supply). Insurance card in the blue folder.',
     'CVS Pharmacy — Main Street',
     v_today + INTERVAL '4 days 11 hours',
     v_today + INTERVAL '4 days 11 hours 30 minutes',
     v_user_id),

    -- Day 5
    (v_circle_id, v_patient_id,
     'Physical Therapy Session',
     'Week 2 — balance and mobility work.',
     'Valley Rehab Center, Building B',
     v_today + INTERVAL '5 days 9 hours',
     v_today + INTERVAL '5 days 10 hours',
     v_user_id),

    -- Day 7 — bigger appointment
    (v_circle_id, v_patient_id,
     'Primary Care Follow-Up — Dr. Nguyen',
     'Quarterly review. Bring blood pressure log and medication list.',
     'Valley Family Medicine, Room 14',
     v_today + INTERVAL '7 days 14 hours',
     v_today + INTERVAL '7 days 15 hours',
     v_user_id),

    -- Extra transport events — orange car icons across the week
    (v_circle_id, v_patient_id,
     'Drive to Pharmacy',
     'Pick up Atorvastatin refill. Insurance card is in the blue folder.',
     'CVS Pharmacy — Oak Street',
     v_today + INTERVAL '1 day 13 hours',
     v_today + INTERVAL '1 day 13 hours 30 minutes',
     v_user_id),

    (v_circle_id, v_patient_id,
     'Transport to Lab Draw',
     'Drive to Valley Medical Lab for fasting blood panel. Arrive 15 minutes early.',
     'Valley Medical Lab, Building A',
     v_today + INTERVAL '3 days 7 hours',
     v_today + INTERVAL '3 days 8 hours',
     v_user_id),

    (v_circle_id, v_patient_id,
     'PT Session Pickup',
     'Pick up from Valley Rehab after afternoon session. Text when leaving.',
     'Valley Rehab Center — Building B',
     v_today + INTERVAL '5 days 10 hours',
     v_today + INTERVAL '5 days 10 hours 30 minutes',
     v_user_id),

    (v_circle_id, v_patient_id,
     'Specialist Referral Ride',
     'Nephrology consult — Dr. Santos. Bring all current medication list.',
     'Valley Specialty Center, Suite 400',
     v_today + INTERVAL '6 days 11 hours',
     v_today + INTERVAL '6 days 12 hours 30 minutes',
     v_user_id);

  -- ── 5. BROADCAST UPDATES ───────────────────────────────────────────────────
  DELETE FROM public.broadcast_updates
  WHERE care_circle_id = v_circle_id
    AND author_id = v_user_id;

  INSERT INTO public.broadcast_updates
    (care_circle_id, title, content, severity, author_id, created_at)
  VALUES
    (v_circle_id,
     'Evening medication schedule updated',
     'Updated Robert''s evening medication schedule per Dr. Patel''s notes from today''s cardiology visit. The Lisinopril evening dose is now moved to 6 PM instead of 8 PM. Please review before tonight''s dose. Do not give the old schedule.',
     'warning', v_user_id,
     NOW() - INTERVAL '12 minutes'),

    (v_circle_id,
     'Nurse Kim arriving Thursday',
     'Nurse Kim will arrive Thursday at 9 AM for the weekly wound check and dressing change on Robert''s left forearm. Someone needs to be on-site to let her in — please confirm availability in the comments.',
     'info', v_user_id,
     NOW() - INTERVAL '2 hours'),

    (v_circle_id,
     'New AVS scanned — pending your review',
     'A new After Visit Summary from yesterday''s cardiology appointment has been scanned and is waiting in the Scan AVS tab for your review and approval. Please review the extracted medications before they are added to the schedule.',
     'info', v_user_id,
     NOW() - INTERVAL '1 day');

  RAISE NOTICE '✅ Seed complete. Care Circle ID: %', v_circle_id;
  RAISE NOTICE '   Patient ID:      %', v_patient_id;
  RAISE NOTICE '   Tasks created:   8';
  RAISE NOTICE '   Events created:  11';
  RAISE NOTICE '   Updates created: 3';

END $$;

