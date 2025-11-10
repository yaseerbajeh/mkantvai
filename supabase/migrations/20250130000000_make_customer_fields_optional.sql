/*
  # Make Customer Fields Optional in Subscriptions
  
  Makes customer_name and customer_email optional (nullable) in both
  active_subscriptions and expired_subscriptions tables to support
  CSV imports without requiring customer information.
*/

-- Alter active_subscriptions table
ALTER TABLE public.active_subscriptions
  ALTER COLUMN customer_name DROP NOT NULL,
  ALTER COLUMN customer_email DROP NOT NULL;

-- Alter expired_subscriptions table
ALTER TABLE public.expired_subscriptions
  ALTER COLUMN customer_name DROP NOT NULL,
  ALTER COLUMN customer_email DROP NOT NULL;

