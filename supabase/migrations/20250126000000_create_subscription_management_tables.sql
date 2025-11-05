/*
  # Subscription Management System
  Creates tables and functions for managing customer subscriptions with expiration tracking
*/

-- ============================================
-- 1. Create active_subscriptions table
-- ============================================

CREATE TABLE IF NOT EXISTS public.active_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  subscription_code text NOT NULL,
  subscription_type text NOT NULL CHECK (subscription_type IN ('iptv', 'shahid', 'netflix', 'package')),
  subscription_duration text NOT NULL,
  expiration_date timestamptz NOT NULL,
  start_date timestamptz NOT NULL,
  product_code text,
  reminder_sent boolean DEFAULT false,
  reminder_sent_at timestamptz,
  last_contacted_at timestamptz,
  renewed_from_subscription_id uuid REFERENCES public.active_subscriptions(id) ON DELETE SET NULL,
  is_renewed boolean DEFAULT false,
  renewal_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. Create expired_subscriptions table
-- ============================================

CREATE TABLE IF NOT EXISTS public.expired_subscriptions (
  id uuid PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  subscription_code text NOT NULL,
  subscription_type text NOT NULL,
  subscription_duration text NOT NULL,
  expiration_date timestamptz NOT NULL,
  start_date timestamptz NOT NULL,
  product_code text,
  reminder_sent boolean DEFAULT false,
  reminder_sent_at timestamptz,
  last_contacted_at timestamptz,
  renewed_from_subscription_id uuid,
  is_renewed boolean DEFAULT false,
  renewal_count integer DEFAULT 0,
  created_at timestamptz,
  updated_at timestamptz,
  expired_at timestamptz DEFAULT now()
);

-- ============================================
-- 3. Create Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_active_subscriptions_type ON public.active_subscriptions(subscription_type);
CREATE INDEX IF NOT EXISTS idx_active_subscriptions_expiration ON public.active_subscriptions(expiration_date);
CREATE INDEX IF NOT EXISTS idx_active_subscriptions_email ON public.active_subscriptions(customer_email);
CREATE INDEX IF NOT EXISTS idx_active_subscriptions_order_id ON public.active_subscriptions(order_id);
CREATE INDEX IF NOT EXISTS idx_active_subscriptions_renewed_from ON public.active_subscriptions(renewed_from_subscription_id);
CREATE INDEX IF NOT EXISTS idx_active_subscriptions_is_renewed ON public.active_subscriptions(is_renewed);

CREATE INDEX IF NOT EXISTS idx_expired_subscriptions_type ON public.expired_subscriptions(subscription_type);
CREATE INDEX IF NOT EXISTS idx_expired_subscriptions_expiration ON public.expired_subscriptions(expiration_date);
CREATE INDEX IF NOT EXISTS idx_expired_subscriptions_expired_at ON public.expired_subscriptions(expired_at);
CREATE INDEX IF NOT EXISTS idx_expired_subscriptions_email ON public.expired_subscriptions(customer_email);

-- ============================================
-- 4. Enable Row Level Security
-- ============================================

ALTER TABLE public.active_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expired_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. Create RLS Policies
-- ============================================

-- Active subscriptions: Allow public read (admin will use service role)
DROP POLICY IF EXISTS "Anyone can view active subscriptions" ON public.active_subscriptions;
CREATE POLICY "Anyone can view active subscriptions"
  ON public.active_subscriptions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert active subscriptions" ON public.active_subscriptions;
CREATE POLICY "Anyone can insert active subscriptions"
  ON public.active_subscriptions
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update active subscriptions" ON public.active_subscriptions;
CREATE POLICY "Anyone can update active subscriptions"
  ON public.active_subscriptions
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete active subscriptions" ON public.active_subscriptions;
CREATE POLICY "Anyone can delete active subscriptions"
  ON public.active_subscriptions
  FOR DELETE
  USING (true);

-- Expired subscriptions: Allow public read
DROP POLICY IF EXISTS "Anyone can view expired subscriptions" ON public.expired_subscriptions;
CREATE POLICY "Anyone can view expired subscriptions"
  ON public.expired_subscriptions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert expired subscriptions" ON public.expired_subscriptions;
CREATE POLICY "Anyone can insert expired subscriptions"
  ON public.expired_subscriptions
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 6. Create Function to Update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_active_subscriptions_updated_at
  BEFORE UPDATE ON public.active_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. Create Function to Move Expired Subscriptions
-- ============================================

CREATE OR REPLACE FUNCTION move_expired_subscriptions()
RETURNS TABLE(moved_count integer) AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- Insert expired subscriptions into expired_subscriptions
  -- A subscription is expired if expiration_date <= now()
  WITH moved AS (
    INSERT INTO public.expired_subscriptions (
      id, order_id, customer_name, customer_email, customer_phone,
      subscription_code, subscription_type, subscription_duration,
      expiration_date, start_date, product_code,
      reminder_sent, reminder_sent_at, last_contacted_at,
      renewed_from_subscription_id, is_renewed, renewal_count,
      created_at, updated_at, expired_at
    )
    SELECT 
      id, order_id, customer_name, customer_email, customer_phone,
      subscription_code, subscription_type, subscription_duration,
      expiration_date, start_date, product_code,
      reminder_sent, reminder_sent_at, last_contacted_at,
      renewed_from_subscription_id, is_renewed, renewal_count,
      created_at, updated_at, now()
    FROM public.active_subscriptions
    WHERE expiration_date <= now()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM moved;
  
  -- Delete from active_subscriptions
  DELETE FROM public.active_subscriptions
  WHERE expiration_date <= now();
  
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. Create Function to Calculate Duration in Days
-- ============================================

CREATE OR REPLACE FUNCTION parse_duration_to_days(duration_text text)
RETURNS integer AS $$
DECLARE
  months_match integer;
  days_match integer;
BEGIN
  -- Try to extract months (e.g., "3 أشهر", "1 شهر")
  SELECT (regexp_match(duration_text, '(\d+)\s*شهر'))[1]::integer INTO months_match;
  IF months_match IS NOT NULL THEN
    RETURN months_match * 30; -- Approximate 30 days per month
  END IF;
  
  -- Try to extract days
  SELECT (regexp_match(duration_text, '(\d+)\s*يوم'))[1]::integer INTO days_match;
  IF days_match IS NOT NULL THEN
    RETURN days_match;
  END IF;
  
  -- Default: if contains "باقة" or "package", return 90 days
  IF duration_text ILIKE '%باقة%' OR duration_text ILIKE '%package%' THEN
    RETURN 90;
  END IF;
  
  -- Default fallback
  RETURN 30;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 9. Create Function to Auto-Create Subscription from Order
-- ============================================

CREATE OR REPLACE FUNCTION auto_create_subscription_from_order(
  p_order_id uuid,
  p_subscription_type text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_order RECORD;
  v_product RECORD;
  v_subscription_type text;
  v_duration_days integer;
  v_start_date timestamptz;
  v_expiration_date timestamptz;
  v_subscription_id uuid;
  v_subscription_code text;
  v_duration_text text;
BEGIN
  -- Get order details
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND status = 'approved';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or not approved';
  END IF;
  
  -- Get product details if product_code exists
  IF v_order.product_code IS NOT NULL THEN
    SELECT * INTO v_product
    FROM public.products
    WHERE product_code = v_order.product_code;
  END IF;
  
  -- Determine subscription type
  IF p_subscription_type IS NOT NULL THEN
    v_subscription_type := p_subscription_type;
  ELSIF v_order.product_code IS NOT NULL THEN
    -- Map product_code to subscription type
    IF v_order.product_code LIKE 'SUB-BASIC-%' THEN
      v_subscription_type := 'iptv';
    ELSIF v_order.product_code LIKE 'SUB-PREMIUM-%' THEN
      v_subscription_type := 'netflix';
    ELSIF v_order.product_code LIKE 'SUB-PACKAGE-%' THEN
      v_subscription_type := 'package';
    ELSIF v_order.product_name ILIKE '%shahid%' THEN
      v_subscription_type := 'shahid';
    ELSE
      v_subscription_type := 'iptv'; -- Default
    END IF;
  ELSE
    v_subscription_type := 'iptv'; -- Default
  END IF;
  
  -- Get subscription code from assigned_subscription or generate one
  IF v_order.assigned_subscription IS NOT NULL AND v_order.assigned_subscription->>'code' IS NOT NULL THEN
    v_subscription_code := v_order.assigned_subscription->>'code';
  ELSE
    v_subscription_code := 'SUB-' || substr(md5(random()::text), 1, 8);
  END IF;
  
  -- Get duration
  IF v_product IS NOT NULL AND v_product.duration IS NOT NULL THEN
    v_duration_text := v_product.duration;
  ELSIF v_order.assigned_subscription IS NOT NULL AND v_order.assigned_subscription->'meta'->>'duration' IS NOT NULL THEN
    v_duration_text := v_order.assigned_subscription->'meta'->>'duration';
  ELSE
    v_duration_text := '1 شهر'; -- Default
  END IF;
  
  -- Calculate dates
  v_start_date := COALESCE(v_order.created_at, now());
  v_duration_days := parse_duration_to_days(v_duration_text);
  v_expiration_date := v_start_date + (v_duration_days || ' days')::interval;
  
  -- Insert subscription
  INSERT INTO public.active_subscriptions (
    order_id, customer_name, customer_email, customer_phone,
    subscription_code, subscription_type, subscription_duration,
    expiration_date, start_date, product_code
  )
  VALUES (
    p_order_id,
    v_order.name,
    v_order.email,
    v_order.whatsapp,
    v_subscription_code,
    v_subscription_type,
    v_duration_text,
    v_expiration_date,
    v_start_date,
    v_order.product_code
  )
  RETURNING id INTO v_subscription_id;
  
  RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

