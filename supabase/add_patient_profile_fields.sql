-- =============================================================================
-- add_patient_profile_fields.sql
-- =============================================================================
-- Adds four new profile fields to the patients table for the Care Recipient
-- (patient profile) feature, enrolls patients in realtime sync, tightens the
-- UPDATE policy to admin-only, and adds storage policies for patient photos.
--
-- All new fields are nullable so existing patient records remain valid.
-- Existing onboarding INSERT continues working unchanged.
-- Idempotent — safe to run multiple times.
-- =============================================================================

-- 1. Add new columns ---------------------------------------------------------
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS avatar_url     TEXT,
  ADD COLUMN IF NOT EXISTS preferred_name TEXT,
  ADD COLUMN IF NOT EXISTS relationship   TEXT,
  ADD COLUMN IF NOT EXISTS about          TEXT;

-- 200-character cap on `about` (defense-in-depth alongside client validation).
-- Wrapped in DO block so it doesn't error if the constraint already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'patients_about_length_check'
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_about_length_check
      CHECK (about IS NULL OR char_length(about) <= 200);
  END IF;
END $$;

-- 2. Enroll patients in the realtime publication so edits propagate ---------
--    across all care-circle members without manual refresh.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname    = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'patients'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;
  END IF;
END $$;

-- REPLICA IDENTITY FULL ensures filtered subscriptions on care_circle_id
-- (a non-primary-key column) receive UPDATE events correctly.
ALTER TABLE public.patients REPLICA IDENTITY FULL;

-- 3. Tighten UPDATE policy to admin-only -------------------------------------
--    Previously admin OR collaborator could update patient records.
--    Now only admins can — matches the UI which only surfaces Edit to admins.
DROP POLICY IF EXISTS "patients: collaborators can update" ON public.patients;
DROP POLICY IF EXISTS "patients: admins can update"        ON public.patients;
CREATE POLICY "patients: admins can update" ON public.patients
  FOR UPDATE USING (
    is_circle_member(care_circle_id, ARRAY['admin']::care_circle_role[])
  );

-- 4. Storage policies for patient photos -------------------------------------
--    Reuses the existing 'avatars' bucket. File path pattern:
--      avatars/patient-{patientId}.jpg
--    Coexists with user avatars (which use 'avatars/{userId}.jpg').
DROP POLICY IF EXISTS "Admins can upload patient photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update patient photos" ON storage.objects;

CREATE POLICY "Admins can upload patient photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND name LIKE 'patient-%.jpg'
  AND EXISTS (
    SELECT 1 FROM public.care_circle_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update patient photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND name LIKE 'patient-%.jpg'
  AND EXISTS (
    SELECT 1 FROM public.care_circle_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Public read of the avatars bucket is already covered by the existing
-- "Public read access for avatars" policy created in MAINTENANCE_SOP §4.
-- =============================================================================
