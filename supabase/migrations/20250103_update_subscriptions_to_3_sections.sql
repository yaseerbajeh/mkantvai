/*
  # Update subscriptions to match new 3-section structure
  
  This migration updates the subscription metadata to reflect the new organization:
  - Section 1: IPTV subscriptions (SUB-BASIC-*) - Purple/Blue theme
  - Section 2: Premium subscriptions (SUB-PREMIUM-*) - Red/White theme  
  - Section 3: Annual subscriptions (SUB-ANNUAL-*) - Green theme
  
  IMPORTANT: Run this migration in your Supabase SQL editor after updating the frontend code.
*/

-- Update subscription_meta for IPTV subscriptions to reflect new naming
UPDATE public.subscriptions 
SET subscription_meta = jsonb_set(
  COALESCE(subscription_meta, '{}'::jsonb), 
  '{display_name}', 
  '"اشتراك IPTV"'
)
WHERE product_code IN ('SUB-BASIC-1M', 'SUB-BASIC-3M', 'SUB-BASIC-6M');

-- Update subscription_meta for Premium subscriptions with red/white theme
UPDATE public.subscriptions 
SET subscription_meta = jsonb_set(
  COALESCE(subscription_meta, '{}'::jsonb), 
  '{theme}', 
  '"red-white"'
)
WHERE product_code IN ('SUB-PREMIUM-1M', 'SUB-PREMIUM-3M', 'SUB-PREMIUM-6M');

-- Ensure Annual subscriptions are properly configured with green theme
UPDATE public.subscriptions 
SET subscription_meta = jsonb_set(
  COALESCE(subscription_meta, '{}'::jsonb), 
  '{theme}', 
  '"green"'
)
WHERE product_code IN ('SUB-ANNUAL-BASIC', 'SUB-ANNUAL-PREMIUM', 'SUB-ANNUAL-VIP');

-- Note: The product codes remain the same, only metadata is updated
-- The frontend has been updated to display products in 3 sections with proper theming
-- No subscription records are deleted - this is just a metadata update

