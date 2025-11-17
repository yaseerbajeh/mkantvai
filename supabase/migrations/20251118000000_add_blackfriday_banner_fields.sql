-- Add banner_type and banner_image_url fields to promotional_banners table
ALTER TABLE public.promotional_banners
ADD COLUMN IF NOT EXISTS banner_type text NOT NULL DEFAULT 'default' CHECK (banner_type IN ('default', 'blackfriday')),
ADD COLUMN IF NOT EXISTS banner_image_url text;

-- Drop the old unique index that only allowed one enabled banner
DROP INDEX IF EXISTS idx_promotional_banners_one_enabled;

-- Create new unique partial index to ensure only one enabled banner per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_promotional_banners_one_enabled_per_type 
  ON public.promotional_banners(banner_type, is_enabled) 
  WHERE is_enabled = true;

-- Create index for banner_type for better query performance
CREATE INDEX IF NOT EXISTS idx_promotional_banners_banner_type ON public.promotional_banners(banner_type);

