/*
  # Create Trial Codes Table
  
  This table stores trial codes (12 hours duration in DB, shown as 3 hours to users) that users can request.
  Each user can only request one trial code.
  Codes are automatically deleted after 12 hours via a scheduled function.
*/

-- Create trial_codes table
CREATE TABLE IF NOT EXISTS public.trial_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trial_code text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id) -- Ensure one trial per user
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trial_codes_user_id ON public.trial_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_codes_trial_code ON public.trial_codes(trial_code);
CREATE INDEX IF NOT EXISTS idx_trial_codes_expires_at ON public.trial_codes(expires_at);

-- Function to delete expired trial codes
CREATE OR REPLACE FUNCTION delete_expired_trial_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM public.trial_codes
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to run every hour (requires pg_cron extension)
-- Note: This requires pg_cron extension to be enabled in Supabase
-- If pg_cron is not available, you can set up a cron job externally or use Supabase Edge Functions
-- For now, the function exists and can be called manually or via Edge Functions

-- Enable Row Level Security
ALTER TABLE public.trial_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to handle re-runs)
DROP POLICY IF EXISTS "Users can view their own trial codes" ON public.trial_codes;
DROP POLICY IF EXISTS "Admins can view all trial codes" ON public.trial_codes;

-- RLS Policies
-- Users can only view their own trial codes
CREATE POLICY "Users can view their own trial codes"
  ON public.trial_codes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all trial codes
CREATE POLICY "Admins can view all trial codes"
  ON public.trial_codes
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
