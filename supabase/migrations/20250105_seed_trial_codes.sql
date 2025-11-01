/*
  # Seed Trial Codes Pool
  
  Insert trial codes into the pool.
  These codes will be assigned to users when they request a trial.
  
  Usage:
  1. Insert your trial codes below
  2. Set expires_at to 12 hours from when you want them to expire
  3. Run this SQL script
  4. Users can then request codes from this pool
*/

-- Insert trial codes into the pool
-- Replace the codes below with your actual trial codes
-- Format: trial_code should be your actual code, expires_at should be 12 hours from creation

INSERT INTO public.trial_codes_pool (trial_code, expires_at, is_assigned)
VALUES
  -- Example codes - replace with your actual codes
  ('TRIAL-CODE-001', NOW() + INTERVAL '12 hours', false),
  ('TRIAL-CODE-002', NOW() + INTERVAL '12 hours', false),
  ('TRIAL-CODE-003', NOW() + INTERVAL '12 hours', false),
  ('TRIAL-CODE-004', NOW() + INTERVAL '12 hours', false),
  ('TRIAL-CODE-005', NOW() + INTERVAL '12 hours', false),
  ('TRIAL-CODE-006', NOW() + INTERVAL '12 hours', false),
  ('TRIAL-CODE-007', NOW() + INTERVAL '12 hours', false),
  ('TRIAL-CODE-008', NOW() + INTERVAL '12 hours', false),
  ('TRIAL-CODE-009', NOW() + INTERVAL '12 hours', false),
  ('TRIAL-CODE-010', NOW() + INTERVAL '12 hours', false)
ON CONFLICT (trial_code) DO NOTHING;

-- Display summary
SELECT 
  COUNT(*) as total_codes_in_pool,
  COUNT(*) FILTER (WHERE is_assigned = false AND expires_at > NOW()) as available_codes,
  COUNT(*) FILTER (WHERE is_assigned = true) as assigned_codes,
  COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_codes
FROM public.trial_codes_pool;
