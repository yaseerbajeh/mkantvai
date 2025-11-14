/*
  # Add Enhancements to CRM Leads Table
  
  Adds new fields for:
  - Importance/Priority tracking
  - Reminder dates
  - Conversion tracking (converted_at, non_converted_at)
  - Status updates
*/

-- Add importance field
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS importance text DEFAULT 'medium' 
CHECK (importance IN ('low', 'medium', 'high', 'urgent'));

-- Add reminder_date field
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS reminder_date timestamptz;

-- Add converted_at field
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS converted_at timestamptz;

-- Add non_converted_at field
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS non_converted_at timestamptz;

-- Update status enum to include 'non_converted' if needed
-- First, drop the existing constraint
ALTER TABLE public.crm_leads 
DROP CONSTRAINT IF EXISTS crm_leads_status_check;

-- Add new constraint with non_converted
ALTER TABLE public.crm_leads 
ADD CONSTRAINT crm_leads_status_check 
CHECK (status IN ('new', 'contacted', 'converted', 'lost', 'non_converted'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_leads_importance ON public.crm_leads(importance);
CREATE INDEX IF NOT EXISTS idx_crm_leads_reminder_date ON public.crm_leads(reminder_date) WHERE reminder_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_leads_converted_at ON public.crm_leads(converted_at) WHERE converted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_leads_non_converted_at ON public.crm_leads(non_converted_at) WHERE non_converted_at IS NOT NULL;

-- Add comment to columns
COMMENT ON COLUMN public.crm_leads.importance IS 'Priority level: low, medium, high, urgent';
COMMENT ON COLUMN public.crm_leads.reminder_date IS 'Date and time to remind admin to contact this lead';
COMMENT ON COLUMN public.crm_leads.converted_at IS 'Timestamp when lead was marked as converted';
COMMENT ON COLUMN public.crm_leads.non_converted_at IS 'Timestamp when lead was marked as non-converted';

