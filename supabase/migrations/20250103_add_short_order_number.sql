/*
  # Add Short Order Number to Orders Table

  1. New Column
    - `order_number` (text, unique) - Short, readable order identifier
  
  2. Function
    - `generate_order_number()` - Generates a short alphanumeric order number
  
  3. Trigger
    - Auto-generates order_number on insert if not provided
*/

-- Add order_number column
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_number text UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

-- Function to generate short order number (8 characters: uppercase letters and numbers)
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excluding confusing chars (0, O, I, 1)
  result text := '';
  i integer;
BEGIN
  -- Generate 8 character code
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  
  -- Check if exists, regenerate if needed (very unlikely with 8 chars)
  WHILE EXISTS (SELECT 1 FROM public.orders WHERE order_number = result) LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-generate order_number on insert
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_order_number ON public.orders;
CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Update existing orders to have order numbers (optional, for existing data)
-- Uncomment if you want to backfill existing orders:
-- UPDATE public.orders 
-- SET order_number = generate_order_number() 
-- WHERE order_number IS NULL OR order_number = '';

