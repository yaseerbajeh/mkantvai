-- Add payment-related columns to orders table for PayPal integration
-- This migration adds payment_method, payment_id, and payment_status columns

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS payment_id text,
ADD COLUMN IF NOT EXISTS payment_status text;

-- Add index for faster queries on payment_method
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON public.orders(payment_method);

-- Add comment for documentation
COMMENT ON COLUMN public.orders.payment_method IS 'Payment method used (e.g., paypal, card, etc.)';
COMMENT ON COLUMN public.orders.payment_id IS 'Payment transaction ID from payment provider';
COMMENT ON COLUMN public.orders.payment_status IS 'Status from payment provider (e.g., COMPLETED, PENDING, etc.)';

