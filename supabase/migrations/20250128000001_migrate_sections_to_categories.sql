/*
  # Migrate Sections to Categories
  
  This migration:
  1. Creates default categories from existing section titles
  2. Adds category_id column to products table
  3. Migrates existing products to use categories
  4. Adds foreign key constraint
*/

-- Step 1: Create default categories from existing section titles
INSERT INTO public.categories (name, display_order, is_active)
VALUES
  ('اشتراكات IPTV', 1, true),
  ('الاشتراكات المميزة', 2, true),
  ('الاشتراكات السنوية', 3, true),
  ('البكجات', 4, true)
ON CONFLICT DO NOTHING;

-- Step 2: Add category_id column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS category_id uuid;

-- Step 3: Migrate existing products to use categories based on section
-- Map section 1 -> IPTV category, section 2 -> Premium, etc.
UPDATE public.products p
SET category_id = c.id
FROM public.categories c
WHERE p.category_id IS NULL
  AND c.name = CASE 
    WHEN p.section = 1 THEN 'اشتراكات IPTV'
    WHEN p.section = 2 THEN 'الاشتراكات المميزة'
    WHEN p.section = 3 THEN 'الاشتراكات السنوية'
    WHEN p.section = 4 THEN 'البكجات'
    ELSE 'اشتراكات IPTV'
  END;

-- Step 4: Set default category for any products that didn't match (shouldn't happen, but safety)
UPDATE public.products
SET category_id = (SELECT id FROM public.categories WHERE name = 'اشتراكات IPTV' LIMIT 1)
WHERE category_id IS NULL;

-- Step 5: Make category_id NOT NULL after migration
ALTER TABLE public.products
ALTER COLUMN category_id SET NOT NULL;

-- Step 6: Add foreign key constraint with ON DELETE RESTRICT
-- This prevents deletion of categories that have products
ALTER TABLE public.products
ADD CONSTRAINT fk_products_category_id 
FOREIGN KEY (category_id) 
REFERENCES public.categories(id) 
ON DELETE RESTRICT;

-- Step 7: Create index for category_id
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

-- Note: section and section_title columns are kept for backward compatibility
-- They can be removed in a future migration after ensuring all code uses category_id

