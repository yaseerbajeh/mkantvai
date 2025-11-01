/*
  # Create Trial Codes Pool System
  
  This system allows admins to manually insert trial codes into a pool.
  When users request a trial code, the system assigns them one from the pool.
  
  Structure:
  1. trial_codes_pool - Pool of available trial codes (admin inserts these)
  2. user_trial_assignments - Tracks which users have received codes (prevents duplicates)
*/

-- Create trial_codes_pool table (codes inserted by admin)
CREATE TABLE IF NOT EXISTS public.trial_codes_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trial_code text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  is_assigned boolean NOT NULL DEFAULT false,
  assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create user_trial_assignments table (tracks who got codes)
CREATE TABLE IF NOT EXISTS public.user_trial_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trial_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(user_id) -- Ensure one trial per user
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trial_codes_pool_is_assigned ON public.trial_codes_pool(is_assigned);
CREATE INDEX IF NOT EXISTS idx_trial_codes_pool_expires_at ON public.trial_codes_pool(expires_at);
CREATE INDEX IF NOT EXISTS idx_trial_codes_pool_trial_code ON public.trial_codes_pool(trial_code);
CREATE INDEX IF NOT EXISTS idx_user_trial_assignments_user_id ON public.user_trial_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trial_assignments_trial_code ON public.user_trial_assignments(trial_code);

-- Function to delete expired trial codes from pool
CREATE OR REPLACE FUNCTION delete_expired_trial_codes_pool()
RETURNS void AS $$
BEGIN
  DELETE FROM public.trial_codes_pool
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to assign a trial code from pool to a user
CREATE OR REPLACE FUNCTION assign_trial_code_to_user(p_user_id uuid)
RETURNS TABLE(trial_code text, expires_at timestamptz) AS $$
DECLARE
  v_trial_code text;
  v_expires_at timestamptz;
  v_pool_id uuid;
BEGIN
  -- Check if user already has a trial code
  IF EXISTS (SELECT 1 FROM public.user_trial_assignments WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User already has a trial code assigned';
  END IF;

  -- Get an available code from pool (not assigned, not expired)
  SELECT tc.id, tc.trial_code, tc.expires_at
  INTO v_pool_id, v_trial_code, v_expires_at
  FROM public.trial_codes_pool tc
  WHERE tc.is_assigned = false
    AND tc.expires_at > now()
  ORDER BY tc.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If no code available, raise exception
  IF v_trial_code IS NULL THEN
    RAISE EXCEPTION 'No trial codes available in pool';
  END IF;

  -- Mark code as assigned
  UPDATE public.trial_codes_pool
  SET is_assigned = true,
      assigned_to_user_id = p_user_id,
      assigned_at = now()
  WHERE id = v_pool_id;

  -- Record assignment
  INSERT INTO public.user_trial_assignments (user_id, trial_code, expires_at)
  VALUES (p_user_id, v_trial_code, v_expires_at);

  -- Return the code (use variable names directly - they take precedence over column names)
  RETURN QUERY SELECT v_trial_code::text, v_expires_at::timestamptz;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security
ALTER TABLE public.trial_codes_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_trial_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage trial codes pool" ON public.trial_codes_pool;
DROP POLICY IF EXISTS "Users can view their own trial assignments" ON public.user_trial_assignments;
DROP POLICY IF EXISTS "Admins can view all trial assignments" ON public.user_trial_assignments;

-- RLS Policies for trial_codes_pool
-- Only admins can view/manage the pool (insert codes)
CREATE POLICY "Admins can manage trial codes pool"
  ON public.trial_codes_pool
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN (
        SELECT unnest(string_to_array(current_setting('app.admin_emails', true), ','))
      )
    )
  );

-- RLS Policies for user_trial_assignments
-- Users can only view their own assignments
CREATE POLICY "Users can view their own trial assignments"
  ON public.user_trial_assignments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all assignments
CREATE POLICY "Admins can view all trial assignments"
  ON public.user_trial_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email IN (
        SELECT unnest(string_to_array(current_setting('app.admin_emails', true), ','))
      )
    )
  );

