/*
  # Create CRM Leads Table
  
  This table stores leads from various sources:
  - abandoned_cart: Automatically created from cart_sessions
  - whatsapp: Created via n8n webhook from Evolution API
  - manual: Created manually by admin
  
  Features:
  - Products stored as JSONB array
  - Comments stored as JSONB array with history
  - Status tracking (new, contacted, converted, lost)
  - Source reference for tracking original source
*/

-- Create crm_leads table
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('abandoned_cart', 'whatsapp', 'manual')),
  name text NOT NULL,
  email text,
  whatsapp text,
  products jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of products with details
  total_amount numeric DEFAULT 0,
  comments jsonb DEFAULT '[]'::jsonb, -- Array of comment objects {text, added_by, added_at}
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'lost')),
  source_reference_id uuid, -- Reference to order_id or cart_session_id if from abandoned cart
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_leads_source ON public.crm_leads(source);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON public.crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_created_at ON public.crm_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_email ON public.crm_leads(email);
CREATE INDEX IF NOT EXISTS idx_crm_leads_whatsapp ON public.crm_leads(whatsapp);
CREATE INDEX IF NOT EXISTS idx_crm_leads_source_reference ON public.crm_leads(source_reference_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_crm_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_leads_updated_at();

-- Enable Row Level Security
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to manage all leads (for admin)
CREATE POLICY "Service role can manage all leads"
  ON public.crm_leads FOR ALL
  USING (true);

