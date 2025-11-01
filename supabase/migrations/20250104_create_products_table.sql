/*
  # Create Products Table
  
  This table stores product definitions that appear on the subscribe page.
  Products can be managed through the admin panel.
*/

-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL,
  duration text NOT NULL,
  section integer NOT NULL CHECK (section >= 1 AND section <= 4),
  section_title text NOT NULL,
  image text NOT NULL DEFAULT '',
  image2 text,
  logos text[],
  gradient text NOT NULL DEFAULT 'from-blue-500 to-cyan-500',
  badge_color text NOT NULL DEFAULT 'bg-blue-500',
  icon_name text NOT NULL DEFAULT 'sparkles',
  is_package boolean NOT NULL DEFAULT false,
  features text[],
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_product_code ON public.products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_section ON public.products(section);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_display_order ON public.products(section, display_order);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Public can view active products
CREATE POLICY "Public can view active products"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Only admins can insert/update/delete (handled via service role in API)
-- For now, allow authenticated users to view all products (admin panel needs this)
CREATE POLICY "Authenticated users can view all products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert existing products from hardcoded data
INSERT INTO public.products (
  product_code, name, description, price, duration, section, section_title,
  image, image2, gradient, badge_color, icon_name, is_package, display_order
) VALUES
  -- Section 1 - IPTV
  ('SUB-BASIC-1M', 'اشتراك IPTV - 1 شهر', 'اشتراك IPTV لمدة شهر واحد', 49, '1 شهر', 1, 'اشتراكات IPTV', 
   'https://a.top4top.io/p_3592o24r01.png', 'https://b.top4top.io/p_3592ftqff2.png', 
   'from-purple-500 to-blue-500', 'bg-purple-500', 'sparkles', false, 1),
  ('SUB-BASIC-3M', 'اشتراك IPTV - 3 أشهر', 'اشتراك IPTV لمدة 3 أشهر', 129, '3 أشهر', 1, 'اشتراكات IPTV',
   'https://a.top4top.io/p_3592o24r01.png', 'https://b.top4top.io/p_3592ftqff2.png',
   'from-purple-500 to-blue-500', 'bg-purple-500', 'sparkles', false, 2),
  ('SUB-BASIC-6M', 'اشتراك IPTV - 6 أشهر', 'اشتراك IPTV لمدة 6 أشهر', 229, '6 أشهر', 1, 'اشتراكات IPTV',
   'https://a.top4top.io/p_3592o24r01.png', 'https://b.top4top.io/p_3592ftqff2.png',
   'from-purple-500 to-blue-500', 'bg-purple-500', 'sparkles', false, 3),
  
  -- Section 2 - Premium
  ('SUB-PREMIUM-1M', 'اشتراك مميز - 1 شهر', 'اشتراك مميز مع ميزات إضافية', 79, '1 شهر', 2, 'الاشتراكات المميزة',
   '/logos/netflix.svg', NULL, 'from-red-500 to-rose-200', 'bg-red-500', 'star', false, 1),
  ('SUB-PREMIUM-3M', 'اشتراك مميز - 3 أشهر', 'اشتراك مميز مع ميزات إضافية', 199, '3 أشهر', 2, 'الاشتراكات المميزة',
   '/logos/netflix.svg', NULL, 'from-red-500 to-rose-200', 'bg-red-500', 'star', false, 2),
  ('SUB-PREMIUM-6M', 'اشتراك مميز - 6 أشهر', 'اشتراك مميز مع ميزات إضافية', 349, '6 أشهر', 2, 'الاشتراكات المميزة',
   '/logos/netflix.svg', NULL, 'from-red-500 to-rose-200', 'bg-red-500', 'star', false, 3),
  
  -- Section 3 - Annual
  ('SUB-ANNUAL-BASIC', 'اشتراك سنوي - أساسي', 'اشتراك سنوي أساسي', 399, '12 شهر', 3, 'الاشتراكات السنوية',
   'https://c.top4top.io/p_35923vyyf1.jpeg', NULL, 'from-green-500 to-emerald-500', 'bg-green-500', 'check', false, 1),
  ('SUB-ANNUAL-PREMIUM', 'اشتراك سنوي - مميز', 'اشتراك سنوي مميز', 699, '12 شهر', 3, 'الاشتراكات السنوية',
   'https://c.top4top.io/p_35923vyyf1.jpeg', NULL, 'from-green-500 to-emerald-500', 'bg-green-500', 'check', false, 2),
  ('SUB-ANNUAL-VIP', 'اشتراك سنوي - VIP', 'اشتراك سنوي VIP', 1199, '12 شهر', 3, 'الاشتراكات السنوية',
   'https://c.top4top.io/p_35923vyyf1.jpeg', NULL, 'from-green-500 to-emerald-500', 'bg-green-500', 'check', false, 3),
  
  -- Section 4 - Packages
  ('SUB-PACKAGE-PREMIUM', 'البكج الفاخر', 'باقة متكاملة تشمل Netflix و Shahid و IPTV مع ميزات حصرية', 299, 'باقة متكاملة', 4, 'البكجات',
   '', NULL, 'from-blue-500 via-cyan-500 to-teal-500', 'bg-blue-500', 'package', true, 1),
  ('SUB-PACKAGE-LEGENDARY', 'البكج الاسطوري', 'باقة حصرية تجمع Netflix و Shahid في باقة واحدة', 199, 'باقة مميزة', 4, 'البكجات',
   '', NULL, 'from-emerald-500 via-green-500 to-teal-500', 'bg-emerald-500', 'crown', true, 2)
ON CONFLICT (product_code) DO NOTHING;

-- Update package products with logos and features
UPDATE public.products
SET logos = ARRAY['/logos/netflix.svg', 'https://c.top4top.io/p_35923vyyf1.jpeg', '/logos/iptv.png'],
    features = ARRAY['Netflix Premium', 'Shahid VIP', 'IPTV Premium', 'دعم فني 24/7', 'جودة 4K فائقة', 'مشاهدة متعددة الأجهزة']
WHERE product_code = 'SUB-PACKAGE-PREMIUM';

UPDATE public.products
SET logos = ARRAY['/logos/netflix.svg', 'https://c.top4top.io/p_35923vyyf1.jpeg'],
    features = ARRAY['Netflix Premium', 'Shahid VIP', 'محتوى حصري', 'دعم فني متقدم', 'جودة HD فائقة']
WHERE product_code = 'SUB-PACKAGE-LEGENDARY';

