-- Add product_code column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS product_code text;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_product_code ON public.orders(product_code);

