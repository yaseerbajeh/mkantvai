/*
  # Create Categories Table
  
  This table stores product categories that replace the hardcoded section system.
  Categories can be managed through the admin panel.
*/

-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_en text,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON public.categories(display_order);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON public.categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_name ON public.categories(name);

-- Create unique constraint on name to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_unique ON public.categories(name) WHERE is_active = true;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION update_categories_updated_at();

-- Enable Row Level Security
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Public can view active categories
CREATE POLICY "Public can view active categories"
  ON public.categories
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Authenticated users can view all categories (for admin panel)
CREATE POLICY "Authenticated users can view all categories"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete (handled via service role in API)
-- For now, allow authenticated users to manage (will be restricted by API auth)
CREATE POLICY "Authenticated users can manage categories"
  ON public.categories
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

