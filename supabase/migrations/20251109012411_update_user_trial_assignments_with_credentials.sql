-- Update user_trial_assignments table to add username, password, link, and user_email columns
-- Also prevent deletion by changing ON DELETE CASCADE to ON DELETE RESTRICT

-- First, drop the existing foreign key constraint
ALTER TABLE public.user_trial_assignments
DROP CONSTRAINT IF EXISTS user_trial_assignments_user_id_fkey;

-- Add new columns
ALTER TABLE public.user_trial_assignments
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS password text,
ADD COLUMN IF NOT EXISTS link text,
ADD COLUMN IF NOT EXISTS user_email text;

-- Recreate foreign key with RESTRICT instead of CASCADE to prevent deletion
ALTER TABLE public.user_trial_assignments
ADD CONSTRAINT user_trial_assignments_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- Add index on user_email for purchase status queries
CREATE INDEX IF NOT EXISTS idx_user_trial_assignments_user_email ON public.user_trial_assignments(user_email);

-- Add comments for documentation
COMMENT ON COLUMN public.user_trial_assignments.username IS 'Username for the trial subscription account';
COMMENT ON COLUMN public.user_trial_assignments.password IS 'Password for the trial subscription account';
COMMENT ON COLUMN public.user_trial_assignments.link IS 'Link/URL for accessing the trial subscription';
COMMENT ON COLUMN public.user_trial_assignments.user_email IS 'User email stored for purchase status matching';

