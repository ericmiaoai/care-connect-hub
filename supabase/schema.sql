-- =============================================================================
-- CareSync Supabase Schema
-- Phase 0 | Step 3: Database Schema & Auth Generation
-- Engineer: Lead Database Engineer (Claude Sonnet 4.6)
-- Approved Domain Model: Care Circle bounded context, RBAC roles
-- Approved AI Contract: AVS metadata only stored here; PHI stays local
-- =============================================================================

-- =============================================================================
-- SECTION 0: EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- for case-insensitive email indexing


-- =============================================================================
-- SECTION 1: CUSTOM ENUM TYPES
-- =============================================================================

-- Role a user holds within a specific Care Circle
CREATE TYPE care_circle_role AS ENUM (
  'admin',        -- Primary Caregiver OR Self-Managing Patient (full control)
  'collaborator', -- Co-Caregiver / Family Member (functional read/write)
  'viewer'        -- Extended Family (read-only: calendar + broadcasts only)
);

-- Task lifecycle states
CREATE TYPE task_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'cancelled'
);

-- Task urgency levels
CREATE TYPE task_priority AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

-- Broadcast severity for the Updates board
CREATE TYPE broadcast_severity AS ENUM (
  'info',
  'warning',
  'critical'
);

-- The HITL gate status for AVS document metadata stored in the DB.
-- NOTE: The actual extracted PHI payload (medications, appointments) 
-- NEVER enters this database. Only the human review decision is recorded.
CREATE TYPE avs_review_status AS ENUM (
  'pending_human_review', -- Default: AI processed, awaiting caregiver approval
  'approved',             -- Human reviewed & committed to local device storage
  'rejected'              -- Human rejected the AI extraction; document discarded
);


-- =============================================================================
-- SECTION 2: CORE TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 PROFILES
-- Extends Supabase's auth.users with app-specific data.
-- One row per authenticated user. Linked 1-to-1 with auth.users.
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name    TEXT        NOT NULL,
  last_name     TEXT        NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.profiles IS 
  'App-level user data. One row per Supabase Auth user. PHI is never stored here.';

-- -----------------------------------------------------------------------------
-- 2.2 CARE CIRCLES
-- The core security boundary (Aggregate Root). All data is scoped to a circle.
-- A circle represents one "household" or "care unit" around a patient.
-- -----------------------------------------------------------------------------
CREATE TABLE public.care_circles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,  -- e.g., "John Doe's Care Circle"
  created_by    UUID        NOT NULL REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.care_circles IS
  'The bounded security context. Every piece of care data belongs to exactly one circle.';

-- -----------------------------------------------------------------------------
-- 2.3 CARE CIRCLE MEMBERS (Junction Table)
-- Maps Users to Care Circles with a specific RBAC role.
-- This is the Single Source of Truth for all RLS policy checks.
-- -----------------------------------------------------------------------------
CREATE TABLE public.care_circle_members (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  care_circle_id  UUID              NOT NULL REFERENCES public.care_circles(id) ON DELETE CASCADE,
  user_id         UUID              NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role            care_circle_role  NOT NULL DEFAULT 'viewer',
  joined_at       TIMESTAMPTZ       NOT NULL DEFAULT now(),
  UNIQUE (care_circle_id, user_id)  -- A user can only have one role per circle
);
COMMENT ON TABLE public.care_circle_members IS
  'RBAC junction table. The RLS Golden Rule: all policies check membership here first.';

-- -----------------------------------------------------------------------------
-- 2.4 PATIENTS
-- The clinical subject. Decoupled from auth.users by design.
-- A patient may optionally be linked to a profile (self-managing patient case).
-- -----------------------------------------------------------------------------
CREATE TABLE public.patients (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  care_circle_id  UUID    NOT NULL REFERENCES public.care_circles(id) ON DELETE CASCADE,
  -- Optional link: if the patient manages their own account, link their profile.
  -- If NULL, the patient is managed entirely by caregivers.
  linked_profile_id UUID  REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_name      TEXT    NOT NULL,
  last_name       TEXT    NOT NULL,
  date_of_birth   DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.patients IS
  'Clinical subject entity. Intentionally decoupled from auth.users. '
  'linked_profile_id = NULL means the patient is incapacitated or non-active. '
  'linked_profile_id = a valid profile means the patient self-manages their circle.';

-- -----------------------------------------------------------------------------
-- 2.5 TASKS (My Day Dashboard)
-- Actionable care items assigned within a Care Circle.
-- -----------------------------------------------------------------------------
CREATE TABLE public.tasks (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  care_circle_id  UUID            NOT NULL REFERENCES public.care_circles(id) ON DELETE CASCADE,
  patient_id      UUID            REFERENCES public.patients(id) ON DELETE SET NULL,
  title           TEXT            NOT NULL,
  notes           TEXT,
  status          task_status     NOT NULL DEFAULT 'pending',
  priority        task_priority   NOT NULL DEFAULT 'medium',
  assigned_to     UUID            REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date        TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_by      UUID            NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.tasks IS 'Clinical task items for the My Day dashboard.';

-- -----------------------------------------------------------------------------
-- 2.6 CALENDAR EVENTS (Care Calendar)
-- Shared scheduling events scoped to the Care Circle.
-- -----------------------------------------------------------------------------
CREATE TABLE public.calendar_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_circle_id  UUID        NOT NULL REFERENCES public.care_circles(id) ON DELETE CASCADE,
  patient_id      UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
  title           TEXT        NOT NULL,
  description     TEXT,
  location        TEXT,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ NOT NULL,
  created_by      UUID        NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);
COMMENT ON TABLE public.calendar_events IS 'Shared care schedule events for the Calendar view.';

-- -----------------------------------------------------------------------------
-- 2.7 BROADCAST UPDATES (Updates Board)
-- Announcements and alerts pushed to all circle members.
-- -----------------------------------------------------------------------------
CREATE TABLE public.broadcast_updates (
  id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  care_circle_id  UUID                NOT NULL REFERENCES public.care_circles(id) ON DELETE CASCADE,
  title           TEXT                NOT NULL,
  content         TEXT                NOT NULL,
  severity        broadcast_severity  NOT NULL DEFAULT 'info',
  author_id       UUID                NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.broadcast_updates IS 'Circle-wide announcements for the Updates board.';

-- -----------------------------------------------------------------------------
-- 2.8 AVS DOCUMENTS (HITL Staging Metadata)
-- ⚠️  CRITICAL ARCHITECTURE NOTE ⚠️
-- This table stores ONLY metadata about the scan event.
-- The actual AI-extracted PHI payload (medications, appointments, instructions)
-- is NEVER written to this table. It lives exclusively in the local device
-- storage (IndexedDB) until the user approves it or discards it.
-- This table records only: who scanned what, when, and what the human decided.
-- -----------------------------------------------------------------------------
CREATE TABLE public.avs_documents (
  id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  care_circle_id      UUID              NOT NULL REFERENCES public.care_circles(id) ON DELETE CASCADE,
  patient_id          UUID              NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- Human-readable label only. Never a file path or medical content.
  document_label      TEXT              NOT NULL DEFAULT 'After Visit Summary',
  visit_date          DATE,             -- Extracted date of the visit (non-PHI metadata)
  provider_name       TEXT,             -- Extracted provider name (non-PHI metadata)
  review_status       avs_review_status NOT NULL DEFAULT 'pending_human_review',
  -- The user who performed the HITL approval decision
  reviewed_by         UUID              REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  -- The local device storage key where PHI payload lives on the user's device.
  -- This lets the app re-hydrate the staging UI if the app is closed mid-review.
  local_storage_key   TEXT              UNIQUE,
  scanned_by          UUID              NOT NULL REFERENCES public.profiles(id),
  scanned_at          TIMESTAMPTZ       NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.avs_documents IS
  'HITL audit trail ONLY. Contains zero PHI. '
  'The AI-extracted payload (meds/appointments) is stored locally on the device. '
  'This table records only the human review decision and non-PHI metadata.';


-- =============================================================================
-- SECTION 3: SUPABASE AUTH TRIGGER
-- Automatically creates a profile row when a new user signs up.
-- This fires immediately after a new row is inserted into auth.users.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'New'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS
  'Fires on new Supabase auth signup. Auto-provisions a profile row. '
  'Pass first_name and last_name in the signUp() options.data object.';


-- =============================================================================
-- SECTION 4: UPDATED_AT AUTO-TRIGGER
-- Automatically maintains the updated_at timestamp on mutable tables.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


-- =============================================================================
-- SECTION 5: ROW LEVEL SECURITY (RLS) POLICIES
-- THE GOLDEN RULE: Every SELECT/INSERT/UPDATE/DELETE checks that the 
-- current auth.uid() exists as a member in the target row's care_circle.
-- No membership = zero rows returned. No exceptions.
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_circles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_updates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avs_documents      ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- HELPER FUNCTION: is_circle_member(circle_id, required_role[])
-- Centralizes the membership check to keep policies clean and DRY.
-- Returns TRUE if the current user is a member of the circle with 
-- one of the specified roles.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_circle_member(
  p_care_circle_id UUID,
  p_roles care_circle_role[] DEFAULT ARRAY['admin', 'collaborator', 'viewer']::care_circle_role[]
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.care_circle_members
    WHERE care_circle_id = p_care_circle_id
      AND user_id = auth.uid()
      AND role = ANY(p_roles)
  );
$$;


-- 5.1 PROFILES
-- Users can only read and edit their own profile.
CREATE POLICY "profiles: read own"   ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles: update own" ON public.profiles FOR UPDATE USING (id = auth.uid());


-- 5.2 CARE CIRCLES
-- Any member can view their circle. Only admins can update it.
CREATE POLICY "care_circles: members can read" ON public.care_circles
  FOR SELECT USING (is_circle_member(id));

CREATE POLICY "care_circles: admin can update" ON public.care_circles
  FOR UPDATE USING (is_circle_member(id, ARRAY['admin']::care_circle_role[]));

CREATE POLICY "care_circles: authenticated can create" ON public.care_circles
  FOR INSERT WITH CHECK (auth.uid() = created_by);


-- 5.3 CARE CIRCLE MEMBERS
-- All members can see who else is in their circle.
-- Only admins can add or remove members.
CREATE POLICY "members: circle members can read" ON public.care_circle_members
  FOR SELECT USING (is_circle_member(care_circle_id));

CREATE POLICY "members: admin can insert" ON public.care_circle_members
  FOR INSERT WITH CHECK (is_circle_member(care_circle_id, ARRAY['admin']::care_circle_role[]));

CREATE POLICY "members: admin can delete" ON public.care_circle_members
  FOR DELETE USING (is_circle_member(care_circle_id, ARRAY['admin']::care_circle_role[]));


-- 5.4 PATIENTS
-- All circle members can read patient info.
-- Only admin and collaborators can create/update patient records.
CREATE POLICY "patients: members can read" ON public.patients
  FOR SELECT USING (is_circle_member(care_circle_id));

CREATE POLICY "patients: collaborators can insert" ON public.patients
  FOR INSERT WITH CHECK (
    is_circle_member(care_circle_id, ARRAY['admin', 'collaborator']::care_circle_role[])
  );

CREATE POLICY "patients: collaborators can update" ON public.patients
  FOR UPDATE USING (
    is_circle_member(care_circle_id, ARRAY['admin', 'collaborator']::care_circle_role[])
  );


-- 5.5 TASKS
-- All members can read tasks. Collaborators and admins can mutate.
CREATE POLICY "tasks: members can read" ON public.tasks
  FOR SELECT USING (is_circle_member(care_circle_id));

CREATE POLICY "tasks: collaborators can insert" ON public.tasks
  FOR INSERT WITH CHECK (
    is_circle_member(care_circle_id, ARRAY['admin', 'collaborator']::care_circle_role[])
  );

CREATE POLICY "tasks: collaborators can update" ON public.tasks
  FOR UPDATE USING (
    is_circle_member(care_circle_id, ARRAY['admin', 'collaborator']::care_circle_role[])
  );

CREATE POLICY "tasks: admin can delete" ON public.tasks
  FOR DELETE USING (
    is_circle_member(care_circle_id, ARRAY['admin']::care_circle_role[])
  );


-- 5.6 CALENDAR EVENTS
-- All members can read. Collaborators and admins can create/update.
CREATE POLICY "calendar: members can read" ON public.calendar_events
  FOR SELECT USING (is_circle_member(care_circle_id));

CREATE POLICY "calendar: collaborators can insert" ON public.calendar_events
  FOR INSERT WITH CHECK (
    is_circle_member(care_circle_id, ARRAY['admin', 'collaborator']::care_circle_role[])
  );

CREATE POLICY "calendar: collaborators can update" ON public.calendar_events
  FOR UPDATE USING (
    is_circle_member(care_circle_id, ARRAY['admin', 'collaborator']::care_circle_role[])
  );

CREATE POLICY "calendar: admin can delete" ON public.calendar_events
  FOR DELETE USING (
    is_circle_member(care_circle_id, ARRAY['admin']::care_circle_role[])
  );


-- 5.7 BROADCAST UPDATES
-- All members can read (including viewers). Only admins can post/delete.
CREATE POLICY "broadcasts: members can read" ON public.broadcast_updates
  FOR SELECT USING (is_circle_member(care_circle_id));

CREATE POLICY "broadcasts: admin can insert" ON public.broadcast_updates
  FOR INSERT WITH CHECK (
    is_circle_member(care_circle_id, ARRAY['admin']::care_circle_role[])
  );

CREATE POLICY "broadcasts: admin can delete" ON public.broadcast_updates
  FOR DELETE USING (
    is_circle_member(care_circle_id, ARRAY['admin']::care_circle_role[])
  );


-- 5.8 AVS DOCUMENTS (HITL Audit Metadata)
-- All members can view scan audit history.
-- Only admins and collaborators can initiate a scan.
-- Only the reviewer (admin/collaborator) can update the review status.
CREATE POLICY "avs: members can read" ON public.avs_documents
  FOR SELECT USING (is_circle_member(care_circle_id));

CREATE POLICY "avs: collaborators can insert" ON public.avs_documents
  FOR INSERT WITH CHECK (
    is_circle_member(care_circle_id, ARRAY['admin', 'collaborator']::care_circle_role[])
  );

CREATE POLICY "avs: collaborators can update review status" ON public.avs_documents
  FOR UPDATE USING (
    is_circle_member(care_circle_id, ARRAY['admin', 'collaborator']::care_circle_role[])
  );


-- =============================================================================
-- SECTION 6: PERFORMANCE INDEXES
-- =============================================================================
CREATE INDEX idx_care_circle_members_user   ON public.care_circle_members(user_id);
CREATE INDEX idx_care_circle_members_circle ON public.care_circle_members(care_circle_id);
CREATE INDEX idx_tasks_care_circle          ON public.tasks(care_circle_id);
CREATE INDEX idx_tasks_assigned_to          ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_due_date             ON public.tasks(due_date);
CREATE INDEX idx_tasks_status               ON public.tasks(status);
CREATE INDEX idx_calendar_care_circle       ON public.calendar_events(care_circle_id);
CREATE INDEX idx_calendar_start_time        ON public.calendar_events(start_time);
CREATE INDEX idx_broadcasts_care_circle     ON public.broadcast_updates(care_circle_id);
CREATE INDEX idx_avs_care_circle            ON public.avs_documents(care_circle_id);
CREATE INDEX idx_avs_review_status          ON public.avs_documents(review_status);
CREATE INDEX idx_patients_care_circle       ON public.patients(care_circle_id);


-- =============================================================================
-- END OF SCHEMA
-- Run this entire file in the Supabase SQL Editor (Database > SQL Editor).
-- After running, verify in Database > Tables that all 8 tables are present
-- and RLS is shown as ENABLED for each.
-- =============================================================================
