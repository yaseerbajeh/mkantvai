-- ============================================
-- Complete Product Code Setup
-- Run this file AFTER running the initial subscription tables setup
-- ============================================

-- Step 1: Add product_code to orders table (if not exists)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS product_code text;

CREATE INDEX IF NOT EXISTS idx_orders_product_code ON public.orders(product_code);

-- Step 2: Add product_code to subscriptions table (if not exists)
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS product_code text;

CREATE INDEX IF NOT EXISTS idx_subscriptions_product_code ON public.subscriptions(product_code);

-- Step 3: Update subscription assignment function
CREATE OR REPLACE FUNCTION public.assign_subscription_to_order(
  p_order_id uuid,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub RECORD;
  assigned jsonb;
  order_product_code text;
BEGIN
  -- Get the product_code from the order
  SELECT product_code INTO order_product_code
  FROM public.orders
  WHERE id = p_order_id;

  -- Select and lock one available subscription matching the product_code
  -- Match subscriptions where subscription.product_code = order.product_code
  IF order_product_code IS NOT NULL THEN
    SELECT * INTO sub
    FROM public.subscriptions
    WHERE product_code = order_product_code
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  ELSE
    -- Fallback: select any subscription if product_code is not set
    SELECT * INTO sub
    FROM public.subscriptions
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  END IF;

  -- Check if subscription was found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'لا توجد اشتراكات متاحة حالياً للمنتج المحدد';
  END IF;

  -- Delete the subscription from available pool
  DELETE FROM public.subscriptions WHERE id = sub.id;

  -- Record in used_subscriptions for audit
  INSERT INTO public.used_subscriptions(
    order_id,
    subscription_code,
    subscription_meta,
    assigned_by
  )
  VALUES (
    p_order_id,
    sub.subscription_code,
    sub.subscription_meta,
    p_admin_id
  );

  -- Build assigned subscription JSONB
  assigned := jsonb_build_object(
    'code', sub.subscription_code,
    'meta', COALESCE(sub.subscription_meta, '{}'::jsonb)
  );

  -- Update order with approved status and assigned subscription
  UPDATE public.orders
  SET 
    status = 'approved',
    assigned_subscription = assigned
  WHERE id = p_order_id;

  -- Return the assigned subscription
  RETURN assigned;
END;
$$;

-- Step 4: Seed subscriptions with product_code
-- Basic subscriptions (1 month)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-BASIC-1M-001', '{"duration":"1 شهر","type":"basic"}', 'SUB-BASIC-1M'),
  ('SUB-BASIC-1M-002', '{"duration":"1 شهر","type":"basic"}', 'SUB-BASIC-1M'),
  ('SUB-BASIC-1M-003', '{"duration":"1 شهر","type":"basic"}', 'SUB-BASIC-1M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Basic subscriptions (3 months)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-BASIC-3M-001', '{"duration":"3 أشهر","type":"basic"}', 'SUB-BASIC-3M'),
  ('SUB-BASIC-3M-002', '{"duration":"3 أشهر","type":"basic"}', 'SUB-BASIC-3M'),
  ('SUB-BASIC-3M-003', '{"duration":"3 أشهر","type":"basic"}', 'SUB-BASIC-3M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Basic subscriptions (6 months)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-BASIC-6M-001', '{"duration":"6 أشهر","type":"basic"}', 'SUB-BASIC-6M'),
  ('SUB-BASIC-6M-002', '{"duration":"6 أشهر","type":"basic"}', 'SUB-BASIC-6M'),
  ('SUB-BASIC-6M-003', '{"duration":"6 أشهر","type":"basic"}', 'SUB-BASIC-6M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Premium subscriptions (1 month)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-PREMIUM-1M-001', '{"duration":"1 شهر","type":"premium"}', 'SUB-PREMIUM-1M'),
  ('SUB-PREMIUM-1M-002', '{"duration":"1 شهر","type":"premium"}', 'SUB-PREMIUM-1M'),
  ('SUB-PREMIUM-1M-003', '{"duration":"1 شهر","type":"premium"}', 'SUB-PREMIUM-1M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Premium subscriptions (3 months)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-PREMIUM-3M-001', '{"duration":"3 أشهر","type":"premium"}', 'SUB-PREMIUM-3M'),
  ('SUB-PREMIUM-3M-002', '{"duration":"3 أشهر","type":"premium"}', 'SUB-PREMIUM-3M'),
  ('SUB-PREMIUM-3M-003', '{"duration":"3 أشهر","type":"premium"}', 'SUB-PREMIUM-3M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Premium subscriptions (6 months)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-PREMIUM-6M-001', '{"duration":"6 أشهر","type":"premium"}', 'SUB-PREMIUM-6M'),
  ('SUB-PREMIUM-6M-002', '{"duration":"6 أشهر","type":"premium"}', 'SUB-PREMIUM-6M'),
  ('SUB-PREMIUM-6M-003', '{"duration":"6 أشهر","type":"premium"}', 'SUB-PREMIUM-6M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Plus subscriptions (1 month)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-PLUS-1M-001', '{"duration":"1 شهر","type":"plus"}', 'SUB-PLUS-1M'),
  ('SUB-PLUS-1M-002', '{"duration":"1 شهر","type":"plus"}', 'SUB-PLUS-1M'),
  ('SUB-PLUS-1M-003', '{"duration":"1 شهر","type":"plus"}', 'SUB-PLUS-1M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Plus subscriptions (3 months)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-PLUS-3M-001', '{"duration":"3 أشهر","type":"plus"}', 'SUB-PLUS-3M'),
  ('SUB-PLUS-3M-002', '{"duration":"3 أشهر","type":"plus"}', 'SUB-PLUS-3M'),
  ('SUB-PLUS-3M-003', '{"duration":"3 أشهر","type":"plus"}', 'SUB-PLUS-3M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Plus subscriptions (6 months)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-PLUS-6M-001', '{"duration":"6 أشهر","type":"plus"}', 'SUB-PLUS-6M'),
  ('SUB-PLUS-6M-002', '{"duration":"6 أشهر","type":"plus"}', 'SUB-PLUS-6M'),
  ('SUB-PLUS-6M-003', '{"duration":"6 أشهر","type":"plus"}', 'SUB-PLUS-6M')
ON CONFLICT (subscription_code) DO NOTHING;

-- VIP subscriptions (1 month)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-VIP-1M-001', '{"duration":"1 شهر","type":"vip"}', 'SUB-VIP-1M'),
  ('SUB-VIP-1M-002', '{"duration":"1 شهر","type":"vip"}', 'SUB-VIP-1M'),
  ('SUB-VIP-1M-003', '{"duration":"1 شهر","type":"vip"}', 'SUB-VIP-1M')
ON CONFLICT (subscription_code) DO NOTHING;

-- VIP subscriptions (3 months)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-VIP-3M-001', '{"duration":"3 أشهر","type":"vip"}', 'SUB-VIP-3M'),
  ('SUB-VIP-3M-002', '{"duration":"3 أشهر","type":"vip"}', 'SUB-VIP-3M'),
  ('SUB-VIP-3M-003', '{"duration":"3 أشهر","type":"vip"}', 'SUB-VIP-3M')
ON CONFLICT (subscription_code) DO NOTHING;

-- VIP subscriptions (6 months)
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-VIP-6M-001', '{"duration":"6 أشهر","type":"vip"}', 'SUB-VIP-6M'),
  ('SUB-VIP-6M-002', '{"duration":"6 أشهر","type":"vip"}', 'SUB-VIP-6M'),
  ('SUB-VIP-6M-003', '{"duration":"6 أشهر","type":"vip"}', 'SUB-VIP-6M')
ON CONFLICT (subscription_code) DO NOTHING;

-- Annual Basic subscriptions
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-ANNUAL-BASIC-001', '{"duration":"12 شهر","type":"basic"}', 'SUB-ANNUAL-BASIC'),
  ('SUB-ANNUAL-BASIC-002', '{"duration":"12 شهر","type":"basic"}', 'SUB-ANNUAL-BASIC'),
  ('SUB-ANNUAL-BASIC-003', '{"duration":"12 شهر","type":"basic"}', 'SUB-ANNUAL-BASIC')
ON CONFLICT (subscription_code) DO NOTHING;

-- Annual Premium subscriptions
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-ANNUAL-PREMIUM-001', '{"duration":"12 شهر","type":"premium"}', 'SUB-ANNUAL-PREMIUM'),
  ('SUB-ANNUAL-PREMIUM-002', '{"duration":"12 شهر","type":"premium"}', 'SUB-ANNUAL-PREMIUM'),
  ('SUB-ANNUAL-PREMIUM-003', '{"duration":"12 شهر","type":"premium"}', 'SUB-ANNUAL-PREMIUM')
ON CONFLICT (subscription_code) DO NOTHING;

-- Annual VIP subscriptions
INSERT INTO public.subscriptions (subscription_code, subscription_meta, product_code)
VALUES
  ('SUB-ANNUAL-VIP-001', '{"duration":"12 شهر","type":"vip"}', 'SUB-ANNUAL-VIP'),
  ('SUB-ANNUAL-VIP-002', '{"duration":"12 شهر","type":"vip"}', 'SUB-ANNUAL-VIP'),
  ('SUB-ANNUAL-VIP-003', '{"duration":"12 شهر","type":"vip"}', 'SUB-ANNUAL-VIP')
ON CONFLICT (subscription_code) DO NOTHING;


