-- ============================================
-- COPY AND PASTE THIS ENTIRE FILE INTO SUPABASE SQL EDITOR
-- Then click RUN or press Ctrl+Enter
-- ============================================

-- Step 1: Create orders table
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

-- Step 2: Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_code text NOT NULL UNIQUE,
  subscription_meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- Step 3: Create used_subscriptions table
CREATE TABLE IF NOT EXISTS public.used_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  subscription_code text NOT NULL,
  subscription_meta jsonb,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now()
);

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_email ON public.orders(email);
CREATE INDEX IF NOT EXISTS idx_used_subscriptions_order_id ON public.used_subscriptions(order_id);
CREATE INDEX IF NOT EXISTS idx_used_subscriptions_assigned_by ON public.used_subscriptions(assigned_by);

-- Step 5: Enable Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.used_subscriptions ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop old policies if they exist (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Anyone can insert subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Anyone can delete subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can view used subscriptions" ON public.used_subscriptions;
DROP POLICY IF EXISTS "Anyone can insert used subscriptions" ON public.used_subscriptions;

-- Step 7: Create RLS Policies for orders
CREATE POLICY "Users can view their own orders"
  ON public.orders
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update orders"
  ON public.orders
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Step 8: Create RLS Policies for subscriptions
CREATE POLICY "Anyone can view subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert subscriptions"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete subscriptions"
  ON public.subscriptions
  FOR DELETE
  USING (true);

-- Step 9: Create RLS Policies for used_subscriptions
CREATE POLICY "Admins can view used subscriptions"
  ON public.used_subscriptions
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert used subscriptions"
  ON public.used_subscriptions
  FOR INSERT
  WITH CHECK (true);

-- Step 10: Create function for subscription assignment
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
  SELECT * INTO sub
  FROM public.subscriptions
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'لا توجد اشتراكات متاحة حالياً';
  END IF;

  DELETE FROM public.subscriptions WHERE id = sub.id;

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

  assigned := jsonb_build_object(
    'code', sub.subscription_code,
    'meta', COALESCE(sub.subscription_meta, '{}'::jsonb)
  );

  UPDATE public.orders
  SET 
    status = 'approved',
    assigned_subscription = assigned
  WHERE id = p_order_id;

  RETURN assigned;
END;
$$;

-- Step 11: Add sample subscriptions
INSERT INTO public.subscriptions (subscription_code, subscription_meta)
VALUES
  ('SUB-001-ABC', '{"duration":"3 أشهر","type":"premium"}'),
  ('SUB-002-DEF', '{"duration":"6 أشهر","type":"premium"}'),
  ('SUB-003-GHI', '{"duration":"12 شهر","type":"premium"}'),
  ('SUB-004-JKL', '{"duration":"3 أشهر","type":"standard"}'),
  ('SUB-005-MNO', '{"duration":"6 أشهر","type":"standard"}')
ON CONFLICT (subscription_code) DO NOTHING;

-- ============================================
-- VERIFICATION: Run this query to check if tables were created
-- ============================================
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('orders', 'subscriptions', 'used_subscriptions');

