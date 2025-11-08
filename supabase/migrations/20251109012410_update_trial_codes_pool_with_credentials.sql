-- Update trial_codes_pool table to add username, password, and link columns
ALTER TABLE public.trial_codes_pool
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS password text,
ADD COLUMN IF NOT EXISTS link text;

-- Add comments for documentation
COMMENT ON COLUMN public.trial_codes_pool.username IS 'Username for the trial subscription account';
COMMENT ON COLUMN public.trial_codes_pool.password IS 'Password for the trial subscription account';
COMMENT ON COLUMN public.trial_codes_pool.link IS 'Link/URL for accessing the trial subscription';

