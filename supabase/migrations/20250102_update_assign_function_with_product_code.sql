-- Update function to filter subscriptions by product_code from subscriptions table
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
