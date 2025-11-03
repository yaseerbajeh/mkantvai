/*
  # Add Quantity/Stock Management to Products Table
  
  Adds quantity tracking fields to products table:
  - quantity: Manual quantity override (nullable)
  - quantity_auto: Boolean to enable auto-calculation from subscriptions (default true)
  
  When quantity_auto is true, stock is calculated from available subscriptions count.
  When false, use manual quantity value.
*/

-- Add quantity fields to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS quantity integer,
ADD COLUMN IF NOT EXISTS quantity_auto boolean NOT NULL DEFAULT true;

-- Create index for quantity queries
CREATE INDEX IF NOT EXISTS idx_products_quantity ON public.products(quantity);

-- Add comment for documentation
COMMENT ON COLUMN public.products.quantity IS 'Manual quantity override. Used only if quantity_auto is false.';
COMMENT ON COLUMN public.products.quantity_auto IS 'If true, quantity is auto-calculated from subscriptions table. If false, use manual quantity value.';

