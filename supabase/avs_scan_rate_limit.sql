-- AVS scan rate limiting
-- Run in Supabase SQL Editor to enable server-side rate limiting on Scan AVS.
--
-- Each successful call to process-avs inserts one row. The function counts
-- rows in the past 24 hours before calling Gemini; if the count exceeds
-- AVS_DAILY_SCAN_LIMIT (default 10) it returns 429 without hitting the API.

CREATE TABLE IF NOT EXISTS public.avs_scan_logs (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avs_scan_logs_user_time
  ON public.avs_scan_logs(user_id, scanned_at);

ALTER TABLE public.avs_scan_logs ENABLE ROW LEVEL SECURITY;

-- Users may insert their own log entries (the function uses their JWT)
CREATE POLICY "users can log own scans"
  ON public.avs_scan_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users may read their own log entries (needed for the count query)
CREATE POLICY "users can read own scan logs"
  ON public.avs_scan_logs
  FOR SELECT
  USING (auth.uid() = user_id);
