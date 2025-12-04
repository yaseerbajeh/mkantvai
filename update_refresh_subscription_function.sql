-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS refresh_subscription_from_inventory(uuid, uuid, uuid);

-- Update refresh_subscription_from_inventory function to accept optional inventory_subscription_id
-- This allows admins to select a specific subscription instead of random selection

CREATE OR REPLACE FUNCTION refresh_subscription_from_inventory(
  p_order_id UUID DEFAULT NULL,
  p_active_subscription_id UUID DEFAULT NULL,
  p_inventory_subscription_id UUID DEFAULT NULL
)
RETURNS TABLE (
  subscription_code TEXT,
  subscription_meta JSONB,
  product_code TEXT,
  order_id UUID,
  active_subscription_id UUID
) AS $$
DECLARE
  v_product_code TEXT;
  v_subscription_record RECORD;
  v_order_id UUID;
  v_active_subscription_id UUID;
BEGIN
  -- Validate input: must provide either order_id or active_subscription_id
  IF p_order_id IS NULL AND p_active_subscription_id IS NULL THEN
    RAISE EXCEPTION 'يجب توفير order_id أو active_subscription_id';
  END IF;

  -- Get product_code from order or active_subscription
  IF p_order_id IS NOT NULL THEN
    SELECT o.product_code INTO v_product_code
    FROM orders o
    WHERE o.id = p_order_id;
    
    IF v_product_code IS NULL THEN
      RAISE EXCEPTION 'الطلب غير موجود أو لا يحتوي على رمز منتج';
    END IF;
    
    v_order_id := p_order_id;
  ELSE
    SELECT a.product_code, a.order_id INTO v_product_code, v_order_id
    FROM active_subscriptions a
    WHERE a.id = p_active_subscription_id;
    
    IF v_product_code IS NULL THEN
      RAISE EXCEPTION 'الاشتراك النشط غير موجود أو لا يحتوي على رمز منتج';
    END IF;
    
    v_active_subscription_id := p_active_subscription_id;
  END IF;

  -- Get subscription from inventory
  IF p_inventory_subscription_id IS NOT NULL THEN
    -- Use the specific subscription selected by admin
    SELECT * INTO v_subscription_record
    FROM subscriptions
    WHERE id = p_inventory_subscription_id
      AND subscriptions.product_code = v_product_code;
    
    IF v_subscription_record IS NULL THEN
      RAISE EXCEPTION 'الاشتراك المحدد غير موجود أو لا يطابق رمز المنتج';
    END IF;
  ELSE
    -- Random selection (original behavior)
    SELECT * INTO v_subscription_record
    FROM subscriptions
    WHERE subscriptions.product_code = v_product_code
    ORDER BY RANDOM()
    LIMIT 1;
    
    IF v_subscription_record IS NULL THEN
      RAISE EXCEPTION 'لا توجد اشتراكات متاحة في المخزون للمنتج: %', v_product_code;
    END IF;
  END IF;

  -- Update order if order_id provided
  IF v_order_id IS NOT NULL THEN
    UPDATE orders
    SET 
      assigned_subscription = jsonb_build_object(
        'code', v_subscription_record.subscription_code,
        'meta', v_subscription_record.subscription_meta
      ),
      updated_at = NOW()
    WHERE id = v_order_id;
  END IF;

  -- Update active_subscription if active_subscription_id provided
  IF v_active_subscription_id IS NOT NULL THEN
    UPDATE active_subscriptions
    SET 
      subscription_code = v_subscription_record.subscription_code,
      updated_at = NOW()
    WHERE id = v_active_subscription_id;
  ELSIF v_order_id IS NOT NULL THEN
    -- If we have order_id but no active_subscription_id, try to find and update the active subscription
    UPDATE active_subscriptions
    SET 
      subscription_code = v_subscription_record.subscription_code,
      updated_at = NOW()
    WHERE active_subscriptions.order_id = v_order_id;
  END IF;

  -- Delete the used subscription from inventory
  DELETE FROM subscriptions WHERE id = v_subscription_record.id;

  -- Return the subscription details
  RETURN QUERY SELECT 
    v_subscription_record.subscription_code::TEXT,
    v_subscription_record.subscription_meta::JSONB,
    v_subscription_record.product_code::TEXT,
    v_order_id,
    v_active_subscription_id;
END;
$$ LANGUAGE plpgsql;
