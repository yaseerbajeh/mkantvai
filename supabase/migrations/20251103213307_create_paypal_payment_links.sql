/*
  # Create PayPal Payment Links Table
  
  Stores PayPal payment link IDs for each product.
  Allows managing payment links per product code.
  Supports both sandbox and live environments.
*/

-- Create paypal_payment_links table
CREATE TABLE IF NOT EXISTS public.paypal_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text NOT NULL UNIQUE,
  payment_link_id text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_paypal_payment_links_product_code ON public.paypal_payment_links(product_code);
CREATE INDEX IF NOT EXISTS idx_paypal_payment_links_environment ON public.paypal_payment_links(environment);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_paypal_payment_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_paypal_payment_links_updated_at
  BEFORE UPDATE ON public.paypal_payment_links
  FOR EACH ROW
  EXECUTE FUNCTION update_paypal_payment_links_updated_at();

-- Enable Row Level Security
ALTER TABLE public.paypal_payment_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Public can view payment links (for product pages)
CREATE POLICY "Public can view payment links"
  ON public.paypal_payment_links
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admins can insert/update/delete (handled via service role in API)
-- Authenticated users (admins) can manage payment links
CREATE POLICY "Authenticated users can manage payment links"
  ON public.paypal_payment_links
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert existing payment link for SUB-BASIC-1M (live environment)
INSERT INTO public.paypal_payment_links (product_code, payment_link_id, environment)
VALUES ('SUB-BASIC-1M', '5ZMTA2LQS9UCN', 'live')
ON CONFLICT (product_code) DO UPDATE 
SET payment_link_id = EXCLUDED.payment_link_id,
    updated_at = now();

