-- Update auto_create_subscription_from_order function to use product category
-- instead of product_code pattern matching

CREATE OR REPLACE FUNCTION auto_create_subscription_from_order(
  p_order_id uuid,
  p_subscription_type text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_order RECORD;
  v_product RECORD;
  v_category RECORD;
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
  
  -- Get product details with category if product_code exists
  IF v_order.product_code IS NOT NULL THEN
    SELECT p.*, c.name as category_name, c.name_en as category_name_en
    INTO v_product
    FROM public.products p
    LEFT JOIN public.categories c ON p.category_id = c.id
    WHERE p.product_code = v_order.product_code;
  END IF;
  
  -- Determine subscription type based on category name
  -- Use category name directly as subscription_type (no mapping)
  IF p_subscription_type IS NOT NULL THEN
    -- If explicitly provided, use it (but this should be category name)
    v_subscription_type := p_subscription_type;
  ELSIF v_product IS NOT NULL AND v_product.category_name IS NOT NULL THEN
    -- Use category name directly as subscription_type
    v_subscription_type := v_product.category_name;
  ELSIF v_product IS NOT NULL AND v_product.category_name_en IS NOT NULL THEN
    -- Fallback to English category name if Arabic name not available
    v_subscription_type := v_product.category_name_en;
  ELSIF v_order.product_code IS NOT NULL THEN
    -- Fallback: if no category, use default category names based on product code
    IF v_order.product_code LIKE 'SUB-PREMIUM-%' THEN
      v_subscription_type := 'الاشتراكات المميزة'; -- Default category name
    ELSIF v_order.product_code LIKE 'SUB-PACKAGE-%' THEN
      v_subscription_type := 'البكجات'; -- Default category name
    ELSIF v_order.product_code LIKE '%SHAHID%' OR v_order.product_code LIKE '%shahid%' THEN
      v_subscription_type := 'شاهد'; -- Default category name
    ELSIF v_order.product_code LIKE 'SUB-BASIC-%' OR v_order.product_code LIKE 'SUB-ANNUAL-%' THEN
      v_subscription_type := 'اشتراكات IPTV'; -- Default category name
    ELSE
      v_subscription_type := 'اشتراكات IPTV'; -- Default
    END IF;
  ELSE
    v_subscription_type := 'اشتراكات IPTV'; -- Default
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

