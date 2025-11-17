/*
  # Update CRM Leads Table - Add Notes and Update Status Enum
  
  Adds notes field and updates status enum to include 'client thinking about it'
*/

-- Add notes field if it doesn't exist
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS notes text;

-- Drop the existing status constraint
ALTER TABLE public.crm_leads 
DROP CONSTRAINT IF EXISTS crm_leads_status_check;

-- Add new constraint with 'client thinking about it' status
ALTER TABLE public.crm_leads 
ADD CONSTRAINT crm_leads_status_check 
CHECK (status IN ('new', 'contacted', 'client thinking about it', 'converted', 'lost', 'non_converted'));

-- Create index for notes search (if needed in future)
CREATE INDEX IF NOT EXISTS idx_crm_leads_notes ON public.crm_leads(notes) WHERE notes IS NOT NULL;

-- Add comment to notes column
COMMENT ON COLUMN public.crm_leads.notes IS 'Quick notes field for admin to add notes about the lead';

