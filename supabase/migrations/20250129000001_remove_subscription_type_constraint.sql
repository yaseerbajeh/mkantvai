-- Remove CHECK constraint on subscription_type to allow category names
-- This allows subscription_type to be any category name from the categories table

-- Remove the constraint from active_subscriptions table
ALTER TABLE public.active_subscriptions 
DROP CONSTRAINT IF EXISTS active_subscriptions_subscription_type_check;

-- Note: subscription_type can now be any text value (category name)

