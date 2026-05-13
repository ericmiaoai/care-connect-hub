-- ════════════════════════════════════════════════════════════════════════════
-- Migration: Allow account self-deletion
-- ════════════════════════════════════════════════════════════════════════════
-- Five columns referenced public.profiles(id) with NOT NULL and no ON DELETE
-- behavior. Default RESTRICT prevented users from deleting their own accounts
-- if they had ever created any tasks, events, broadcasts, circles, or scans.
--
-- This migration relaxes them to ON DELETE SET NULL so the user's account can
-- be removed cleanly. Their historical contributions stay in the database,
-- just unattributed — appropriate for a family care-coordination log.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- care_circles.created_by
ALTER TABLE public.care_circles DROP CONSTRAINT IF EXISTS care_circles_created_by_fkey;
ALTER TABLE public.care_circles ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.care_circles
  ADD CONSTRAINT care_circles_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- tasks.created_by
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
ALTER TABLE public.tasks ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- calendar_events.created_by
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_created_by_fkey;
ALTER TABLE public.calendar_events ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- broadcast_updates.author_id
ALTER TABLE public.broadcast_updates DROP CONSTRAINT IF EXISTS broadcast_updates_author_id_fkey;
ALTER TABLE public.broadcast_updates ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.broadcast_updates
  ADD CONSTRAINT broadcast_updates_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- avs_documents.scanned_by
ALTER TABLE public.avs_documents DROP CONSTRAINT IF EXISTS avs_documents_scanned_by_fkey;
ALTER TABLE public.avs_documents ALTER COLUMN scanned_by DROP NOT NULL;
ALTER TABLE public.avs_documents
  ADD CONSTRAINT avs_documents_scanned_by_fkey
  FOREIGN KEY (scanned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMIT;
