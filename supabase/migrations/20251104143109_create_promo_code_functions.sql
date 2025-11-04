-- Function to safely increment promo code usage count
CREATE OR REPLACE FUNCTION public.increment_promo_code_usage(promo_code_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.promo_codes
  SET used_count = used_count + 1,
      updated_at = now()
  WHERE id = promo_code_id;
END;
$$;
