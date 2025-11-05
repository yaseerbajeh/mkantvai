/*
  # Create Renewed Subscriptions Table
  
  This table stores a copy of subscriptions when they are renewed.
  It preserves the subscription state before renewal for audit/history purposes.
  
  Structure:
  - renewed_subscriptions: Stores snapshot of subscription at time of renewal
*/

-- Create renewed_subscriptions table
CREATE TABLE IF NOT EXISTS public.renewed_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_subscription_id uuid NOT NULL REFERENCES public.active_subscriptions(id) ON DELETE CASCADE,
  order_id uuid,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  subscription_code text NOT NULL,
  subscription_type text NOT NULL,
  subscription_duration text NOT NULL,
  expiration_date timestamptz NOT NULL,
  start_date timestamptz NOT NULL,
  product_code text,
  reminder_sent boolean DEFAULT false,
  reminder_sent_at timestamptz,
  last_contacted_at timestamptz,
  renewed_from_subscription_id uuid,
  is_renewed boolean DEFAULT false,
  renewal_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  renewed_at timestamptz DEFAULT now() -- When this renewal snapshot was created
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_renewed_subscriptions_original_subscription_id ON public.renewed_subscriptions(original_subscription_id);
CREATE INDEX IF NOT EXISTS idx_renewed_subscriptions_customer_email ON public.renewed_subscriptions(customer_email);
CREATE INDEX IF NOT EXISTS idx_renewed_subscriptions_subscription_type ON public.renewed_subscriptions(subscription_type);
CREATE INDEX IF NOT EXISTS idx_renewed_subscriptions_renewed_at ON public.renewed_subscriptions(renewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_renewed_subscriptions_expiration_date ON public.renewed_subscriptions(expiration_date);

-- Enable Row Level Security (RLS)
ALTER TABLE public.renewed_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for renewed_subscriptions
-- ============================================

-- Allow authenticated users to read renewed subscriptions
DROP POLICY IF EXISTS "Anyone can read renewed subscriptions" ON public.renewed_subscriptions;
CREATE POLICY "Anyone can read renewed subscriptions"
  ON public.renewed_subscriptions
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert renewed subscriptions
DROP POLICY IF EXISTS "Anyone can insert renewed subscriptions" ON public.renewed_subscriptions;
CREATE POLICY "Anyone can insert renewed subscriptions"
  ON public.renewed_subscriptions
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- Create Function to Update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_renewed_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_renewed_subscriptions_updated_at
  BEFORE UPDATE ON public.renewed_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_renewed_subscriptions_updated_at();

