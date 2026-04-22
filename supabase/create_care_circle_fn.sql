-- =============================================================================
-- CareSync — Updated RPC Function: create_care_circle (v2)
-- =============================================================================
-- Run this in Supabase → SQL Editor (new query tab).
-- This replaces the previous version of the function.
--
-- Change in v2: Self-healing profile creation.
-- If the handle_new_user trigger failed to create a profiles row for a user,
-- this function will create it from auth.users metadata before proceeding.
-- This makes onboarding robust regardless of trigger state.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_care_circle(circle_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_circle_id  UUID;
  v_user_id    UUID := auth.uid();
  v_first_name TEXT;
  v_last_name  TEXT;
BEGIN
  -- Guard: must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Self-healing: ensure the profiles row exists.
  -- The handle_new_user trigger should have created this, but if it failed
  -- for any reason, we create it here from auth.users metadata.
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    -- Read name from the auth.users metadata
    SELECT
      COALESCE(raw_user_meta_data->>'first_name', 'User'),
      COALESCE(raw_user_meta_data->>'last_name',  'User')
    INTO v_first_name, v_last_name
    FROM auth.users
    WHERE id = v_user_id;

    INSERT INTO public.profiles (id, first_name, last_name)
    VALUES (v_user_id, v_first_name, v_last_name);
  END IF;

  -- Create the care circle
  INSERT INTO public.care_circles (name, created_by)
  VALUES (circle_name, v_user_id)
  RETURNING id INTO v_circle_id;

  -- Add caller as admin member
  INSERT INTO public.care_circle_members (care_circle_id, user_id, role)
  VALUES (v_circle_id, v_user_id, 'admin');

  RETURN v_circle_id;
END;
$$;

-- Grant execution rights to authenticated users only
REVOKE ALL ON FUNCTION public.create_care_circle(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_care_circle(TEXT) TO authenticated;
