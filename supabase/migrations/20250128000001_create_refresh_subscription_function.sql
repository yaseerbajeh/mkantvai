/*
  # Subscription Refresh Function
  Creates function to refresh subscription from inventory for broken subscriptions
*/

CREATE OR REPLACE FUNCTION public.refresh_subscription_from_inventory(
  p_order_id uuid DEFAULT NULL,
  p_active_subscription_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_active_sub RECORD;
  v_new_subscription RECORD;
  v_product_code text;
  v_assigned_subscription jsonb;
  v_updated_active_sub_id uuid;
  v_order_found boolean := false;
  v_active_sub_found boolean := false;
  v_order_id uuid;
  v_active_sub_id uuid;
BEGIN
  -- Validate input: must provide either order_id or active_subscription_id
  IF p_order_id IS NULL AND p_active_subscription_id IS NULL THEN
    RAISE EXCEPTION 'يجب توفير order_id أو active_subscription_id';
  END IF;

  -- Get order information
  IF p_order_id IS NOT NULL THEN
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'الطلب غير موجود';
    END IF;
    
    v_order_found := true;
    v_order_id := v_order.id;
    v_product_code := v_order.product_code;
  ELSIF p_active_subscription_id IS NOT NULL THEN
    SELECT * INTO v_active_sub
    FROM public.active_subscriptions
    WHERE id = p_active_subscription_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'الاشتراك غير موجود';
    END IF;
    
    v_active_sub_found := true;
    v_active_sub_id := v_active_sub.id;
    v_product_code := v_active_sub.product_code;
    
    -- Get order from active subscription if order_id exists
    IF v_active_sub.order_id IS NOT NULL THEN
      SELECT * INTO v_order
      FROM public.orders
      WHERE id = v_active_sub.order_id;
      
      IF FOUND THEN
        v_order_found := true;
        v_order_id := v_order.id;
      END IF;
    END IF;
  END IF;

  -- Check if product_code is available
  IF v_product_code IS NULL THEN
    RAISE EXCEPTION 'رمز المنتج غير متوفر. لا يمكن تحديث الاشتراك';
  END IF;

  -- Find a new subscription from inventory matching the product_code
  SELECT * INTO v_new_subscription
  FROM public.subscriptions
  WHERE product_code = v_product_code
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- Check if subscription was found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'لا توجد اشتراكات متاحة في المخزون للمنتج المحدد';
  END IF;

  -- Delete the subscription from available pool
  DELETE FROM public.subscriptions WHERE id = v_new_subscription.id;

  -- Build assigned subscription JSONB
  v_assigned_subscription := jsonb_build_object(
    'code', v_new_subscription.subscription_code,
    'meta', COALESCE(v_new_subscription.subscription_meta, '{}'::jsonb)
  );

  -- Update order if it exists (check if v_order was found)
  IF v_order_found THEN
    UPDATE public.orders
    SET assigned_subscription = v_assigned_subscription,
        updated_at = now()
    WHERE id = v_order_id;
  END IF;

  -- Update active_subscriptions if it exists
  IF v_active_sub_found THEN
    UPDATE public.active_subscriptions
    SET subscription_code = v_new_subscription.subscription_code,
        updated_at = now()
    WHERE id = v_active_sub_id
    RETURNING id INTO v_updated_active_sub_id;
  ELSIF v_order_found THEN
    -- Try to find and update active subscription by order_id
    UPDATE public.active_subscriptions
    SET subscription_code = v_new_subscription.subscription_code,
        updated_at = now()
    WHERE order_id = v_order_id
    RETURNING id INTO v_updated_active_sub_id;
  END IF;

  -- Return the new subscription details
  RETURN jsonb_build_object(
    'success', true,
    'subscription_code', v_new_subscription.subscription_code,
    'subscription_meta', v_new_subscription.subscription_meta,
    'order_id', CASE WHEN v_order_found THEN v_order_id::text ELSE NULL END,
    'active_subscription_id', CASE 
      WHEN v_updated_active_sub_id IS NOT NULL THEN v_updated_active_sub_id::text
      WHEN v_active_sub_found THEN v_active_sub_id::text
      ELSE NULL
    END,
    'product_code', v_product_code
  );
END;
$$;

