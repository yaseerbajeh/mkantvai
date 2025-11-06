/*
  # Drop PayPal Payment Links Table
  
  This migration removes the paypal_payment_links table and all related objects
  as payment links functionality has been removed from the application.
*/

-- Drop the trigger first
DROP TRIGGER IF EXISTS trigger_update_paypal_payment_links_updated_at ON public.paypal_payment_links;

-- Drop the function
DROP FUNCTION IF EXISTS update_paypal_payment_links_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_paypal_payment_links_product_code;
DROP INDEX IF EXISTS idx_paypal_payment_links_environment;

-- Drop RLS policies
DROP POLICY IF EXISTS "Public can view payment links" ON public.paypal_payment_links;
DROP POLICY IF EXISTS "Authenticated users can manage payment links" ON public.paypal_payment_links;

-- Drop the table
DROP TABLE IF EXISTS public.paypal_payment_links;

