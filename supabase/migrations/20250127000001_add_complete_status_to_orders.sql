-- Add 'complete' status to orders table CHECK constraint
-- This allows orders to be marked as complete

-- First, drop the existing constraint
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add new constraint with 'complete' status included
ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'complete'));

