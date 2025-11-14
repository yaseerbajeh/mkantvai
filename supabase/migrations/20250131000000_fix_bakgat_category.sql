/*
  # Fix البكجات Category Issues
  
  This migration ensures:
  1. The "البكجات" category exists and is active
  2. Products SUB-PACKAGE-PREMIUM and SUB-PACKAGE-LEGENDARY are properly linked to the category
  3. Any subscriptions with package products have the correct subscription_type
*/

-- Step 1: Ensure "البكجات" category exists and is active
-- Handle the partial unique index (only on active categories) properly
DO $$
DECLARE
  v_category_id uuid;
BEGIN
  -- Check if category exists (active or inactive)
  SELECT id INTO v_category_id
  FROM public.categories
  WHERE name = 'البكجات'
  LIMIT 1;

  IF v_category_id IS NULL THEN
    -- Category doesn't exist, create it
    INSERT INTO public.categories (name, display_order, is_active)
    VALUES ('البكجات', 4, true)
    RETURNING id INTO v_category_id;
  ELSE
    -- Category exists, ensure it's active
    UPDATE public.categories
    SET is_active = true,
        display_order = 4
    WHERE id = v_category_id;
  END IF;
END $$;

-- Step 2: Verify and fix product category links for package products
-- Get the category ID for "البكجات"
DO $$
DECLARE
  v_bakgat_category_id uuid;
BEGIN
  -- Get the category ID
  SELECT id INTO v_bakgat_category_id
  FROM public.categories
  WHERE name = 'البكجات'
  LIMIT 1;

  -- Update SUB-PACKAGE-PREMIUM if it exists
  UPDATE public.products
  SET category_id = v_bakgat_category_id
  WHERE product_code = 'SUB-PACKAGE-PREMIUM'
    AND (category_id IS NULL OR category_id != v_bakgat_category_id);

  -- Update SUB-PACKAGE-LEGENDARY if it exists
  UPDATE public.products
  SET category_id = v_bakgat_category_id
  WHERE product_code = 'SUB-PACKAGE-LEGENDARY'
    AND (category_id IS NULL OR category_id != v_bakgat_category_id);

  -- Log the updates
  RAISE NOTICE 'Updated category_id for package products to: %', v_bakgat_category_id;
END $$;

-- Step 3: Fix any existing subscriptions that have package products but wrong subscription_type
-- Update subscriptions where product_code is SUB-PACKAGE-* but subscription_type is not 'البكجات'
UPDATE public.active_subscriptions
SET subscription_type = 'البكجات'
WHERE (product_code = 'SUB-PACKAGE-PREMIUM' OR product_code = 'SUB-PACKAGE-LEGENDARY')
  AND subscription_type != 'البكجات'
  AND subscription_type IS NOT NULL;

-- Step 4: Verify the fix - show summary
DO $$
DECLARE
  v_category_count integer;
  v_premium_count integer;
  v_legendary_count integer;
  v_subscription_count integer;
BEGIN
  -- Count category
  SELECT COUNT(*) INTO v_category_count
  FROM public.categories
  WHERE name = 'البكجات' AND is_active = true;

  -- Count products with correct category
  SELECT COUNT(*) INTO v_premium_count
  FROM public.products
  WHERE product_code = 'SUB-PACKAGE-PREMIUM'
    AND category_id = (SELECT id FROM public.categories WHERE name = 'البكجات' LIMIT 1);

  SELECT COUNT(*) INTO v_legendary_count
  FROM public.products
  WHERE product_code = 'SUB-PACKAGE-LEGENDARY'
    AND category_id = (SELECT id FROM public.categories WHERE name = 'البكجات' LIMIT 1);

  -- Count subscriptions with correct type
  SELECT COUNT(*) INTO v_subscription_count
  FROM public.active_subscriptions
  WHERE (product_code = 'SUB-PACKAGE-PREMIUM' OR product_code = 'SUB-PACKAGE-LEGENDARY')
    AND subscription_type = 'البكجات';

  RAISE NOTICE 'Fix Summary:';
  RAISE NOTICE '  - البكجات category (active): %', v_category_count;
  RAISE NOTICE '  - SUB-PACKAGE-PREMIUM with correct category: %', v_premium_count;
  RAISE NOTICE '  - SUB-PACKAGE-LEGENDARY with correct category: %', v_legendary_count;
  RAISE NOTICE '  - Subscriptions with البكجات type: %', v_subscription_count;
END $$;

