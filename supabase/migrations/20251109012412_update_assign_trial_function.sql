-- Drop existing function first to allow changing return type
DROP FUNCTION IF EXISTS assign_trial_code_to_user(uuid);

-- Update assign_trial_code_to_user function to return and store credentials
CREATE FUNCTION assign_trial_code_to_user(p_user_id uuid)
RETURNS TABLE(
  trial_code text, 
  expires_at timestamptz,
  username text,
  password text,
  link text
) AS $$
DECLARE
  v_trial_code text;
  v_expires_at timestamptz;
  v_username text;
  v_password text;
  v_link text;
  v_pool_id uuid;
  v_user_email text;
BEGIN
  -- Check if user already has a trial code
  IF EXISTS (SELECT 1 FROM public.user_trial_assignments WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User already has a trial code assigned';
  END IF;

  -- Get user email from auth.users
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;

  -- Get an available code from pool (not assigned, not expired)
  SELECT tc.id, tc.trial_code, tc.expires_at, tc.username, tc.password, tc.link
  INTO v_pool_id, v_trial_code, v_expires_at, v_username, v_password, v_link
  FROM public.trial_codes_pool tc
  WHERE tc.is_assigned = false
    AND tc.expires_at > now()
  ORDER BY tc.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If no code available, raise exception
  IF v_trial_code IS NULL THEN
    RAISE EXCEPTION 'No trial codes available in pool';
  END IF;

  -- Mark code as assigned
  UPDATE public.trial_codes_pool
  SET is_assigned = true,
      assigned_to_user_id = p_user_id,
      assigned_at = now()
  WHERE id = v_pool_id;

  -- Record assignment with credentials and user email
  INSERT INTO public.user_trial_assignments (
    user_id, 
    trial_code, 
    expires_at,
    username,
    password,
    link,
    user_email
  )
  VALUES (
    p_user_id, 
    v_trial_code, 
    v_expires_at,
    v_username,
    v_password,
    v_link,
    v_user_email
  );

  -- Return the code and credentials
  RETURN QUERY SELECT 
    v_trial_code::text, 
    v_expires_at::timestamptz,
    v_username::text,
    v_password::text,
    v_link::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

