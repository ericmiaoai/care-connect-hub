-- =============================================================================
-- CareSync — Migration: Completion Tracking
-- =============================================================================
-- Run in Supabase → SQL Editor AFTER schema.sql has been applied.
--
-- Adds:
--   calendar_events.completed_by  — who attended / confirmed the appointment
--   calendar_events.completed_at  — when it was marked complete
--   tasks.completed_by            — who marked the task done (≠ assigned_to)
-- =============================================================================

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_completed_by ON public.calendar_events(completed_by);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_by    ON public.tasks(completed_by);
