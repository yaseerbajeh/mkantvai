/*
  # Complete Subscription System Setup
  Run this file in Supabase SQL Editor to set up the entire subscription system
*/

-- ============================================
-- 1. Create Tables
-- ============================================

-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  whatsapp text,
  email text NOT NULL,
  product_name text NOT NULL,
  price numeric NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  assigned_subscription jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_code text NOT NULL UNIQUE,
  subscription_meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create used_subscriptions table
CREATE TABLE IF NOT EXISTS public.used_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  subscription_code text NOT NULL,
  subscription_meta jsonb,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. Create Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_email ON public.orders(email);
CREATE INDEX IF NOT EXISTS idx_used_subscriptions_order_id ON public.used_subscriptions(order_id);
CREATE INDEX IF NOT EXISTS idx_used_subscriptions_assigned_by ON public.used_subscriptions(assigned_by);

-- ============================================
-- 3. Enable Row Level Security
-- ============================================

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.used_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. Create RLS Policies
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view used subscriptions" ON public.used_subscriptions;
DROP POLICY IF EXISTS "Anyone can insert used subscriptions" ON public.used_subscriptions;

-- Orders: Allow public viewing
CREATE POLICY "Users can view their own orders"
  ON public.orders
  FOR SELECT
  USING (true);

-- Orders: Allow public to create orders
CREATE POLICY "Anyone can create orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (true);

-- Orders: Allow updates (for admin approval)
CREATE POLICY "Anyone can update orders"
  ON public.orders
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Subscriptions: Allow reading (for admin to see available subscriptions)
CREATE POLICY "Anyone can view subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (true);

-- Subscriptions: Allow inserts (for adding new subscriptions)
CREATE POLICY "Anyone can insert subscriptions"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (true);

-- Subscriptions: Allow deletes (for assignment function)
CREATE POLICY "Anyone can delete subscriptions"
  ON public.subscriptions
  FOR DELETE
  USING (true);

-- Used subscriptions: Allow viewing
CREATE POLICY "Admins can view used subscriptions"
  ON public.used_subscriptions
  FOR SELECT
  USING (true);

-- Used subscriptions: Allow inserts (from admin function)
CREATE POLICY "Anyone can insert used subscriptions"
  ON public.used_subscriptions
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 5. Create Function for Subscription Assignment
-- ============================================

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
BEGIN
  -- Select and lock one available subscription
  SELECT * INTO sub
  FROM public.subscriptions
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- Check if subscription was found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'لا توجد اشتراكات متاحة حالياً';
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

-- ============================================
-- 6. Seed Sample Subscriptions (Optional)
-- ============================================

INSERT INTO public.subscriptions (subscription_code, subscription_meta)
VALUES
  ('SUB-001-ABC', '{"duration":"3 أشهر","type":"premium"}'),
  ('SUB-002-DEF', '{"duration":"6 أشهر","type":"premium"}'),
  ('SUB-003-GHI', '{"duration":"12 شهر","type":"premium"}'),
  ('SUB-004-JKL', '{"duration":"3 أشهر","type":"standard"}'),
  ('SUB-005-MNO', '{"duration":"6 أشهر","type":"standard"}')
ON CONFLICT (subscription_code) DO NOTHING;


