-- Create function to check if a trial user has purchased/subscribed
CREATE OR REPLACE FUNCTION check_trial_user_purchased(p_user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_purchased boolean := false;
BEGIN
  -- Check if email exists in orders table with status 'paid' or 'approved'
  SELECT EXISTS (
    SELECT 1
    FROM public.orders
    WHERE email = p_user_email
      AND status IN ('paid', 'approved', 'complete')
  ) INTO v_has_purchased;

  RETURN COALESCE(v_has_purchased, false);
END;
$$;

-- Create a view for trial users with purchase status (for easier querying)
CREATE OR REPLACE VIEW trial_users_with_purchase_status AS
SELECT 
  uta.id,
  uta.user_id,
  uta.user_email,
  uta.trial_code,
  uta.username,
  uta.password,
  uta.link,
  uta.expires_at,
  uta.assigned_at,
  CASE 
    WHEN uta.expires_at < now() THEN true
    ELSE false
  END as is_expired,
  check_trial_user_purchased(uta.user_email) as has_purchased
FROM public.user_trial_assignments uta;

-- Grant access to the view
GRANT SELECT ON trial_users_with_purchase_status TO authenticated;

