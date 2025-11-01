-- Add product_code column to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS product_code text;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_product_code ON public.subscriptions(product_code);

-- Add comment
COMMENT ON COLUMN public.subscriptions.product_code IS 'Matches the product code from orders table (e.g., SUB-BASIC-1M, SUB-PREMIUM-3M)';

