-- Add contact tracking fields to orders table for abandoned cart management
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS contact_status text DEFAULT 'not_contacted' CHECK (contact_status IN ('not_contacted', 'contacted')),
ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS reminder_hours integer;

-- Create indexes for filtering and performance
CREATE INDEX IF NOT EXISTS idx_orders_contact_status ON public.orders(contact_status);
CREATE INDEX IF NOT EXISTS idx_orders_reminder_sent_at ON public.orders(reminder_sent_at);
CREATE INDEX IF NOT EXISTS idx_orders_reminder_hours ON public.orders(reminder_hours);

-- Update existing pending orders to have default contact_status
UPDATE public.orders 
SET contact_status = 'not_contacted' 
WHERE contact_status IS NULL AND status = 'pending';

