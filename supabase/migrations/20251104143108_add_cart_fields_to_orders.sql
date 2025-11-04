-- Add cart-related fields to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS promo_code_id uuid REFERENCES public.promo_codes(id),
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount numeric,
ADD COLUMN IF NOT EXISTS is_cart_order boolean DEFAULT false;

-- Create index for cart orders
CREATE INDEX IF NOT EXISTS idx_orders_is_cart_order ON public.orders(is_cart_order);
CREATE INDEX IF NOT EXISTS idx_orders_promo_code_id ON public.orders(promo_code_id);
