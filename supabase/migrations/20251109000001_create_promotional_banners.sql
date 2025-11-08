-- Create promotional_banners table
CREATE TABLE IF NOT EXISTS public.promotional_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT false,
  title text NOT NULL,
  subtitle text NOT NULL,
  discount_percentage integer NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  expiration_date timestamptz NOT NULL,
  cta_link text NOT NULL DEFAULT '/subscribe',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique partial index to ensure only one enabled banner at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_promotional_banners_one_enabled 
  ON public.promotional_banners(is_enabled) 
  WHERE is_enabled = true;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_promotional_banners_is_enabled ON public.promotional_banners(is_enabled);
CREATE INDEX IF NOT EXISTS idx_promotional_banners_expiration_date ON public.promotional_banners(expiration_date);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_promotional_banners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_promotional_banners_updated_at
  BEFORE UPDATE ON public.promotional_banners
  FOR EACH ROW
  EXECUTE FUNCTION update_promotional_banners_updated_at();

-- Enable Row Level Security
ALTER TABLE public.promotional_banners ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view enabled banners
CREATE POLICY "Public can view enabled banners"
  ON public.promotional_banners FOR SELECT
  USING (is_enabled = true);

-- Note: Admin operations will be handled via service role key in API routes

