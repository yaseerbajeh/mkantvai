-- Add whatsapp column to user_trial_assignments table
ALTER TABLE public.user_trial_assignments
ADD COLUMN IF NOT EXISTS whatsapp text;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_trial_assignments_whatsapp ON public.user_trial_assignments(whatsapp);

-- Add comment for documentation
COMMENT ON COLUMN public.user_trial_assignments.whatsapp IS 'User WhatsApp number in format 966[9digits] (e.g., 966542668201)';

