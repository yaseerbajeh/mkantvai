/*
  # Add updated_at column to orders table
  
  Adds updated_at timestamp column to track when orders are modified.
  This is needed for the refresh_subscription_from_inventory function.
*/

-- Add updated_at column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_orders_updated_at ON public.orders;
CREATE TRIGGER trigger_update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();

-- Set updated_at to created_at for existing records
UPDATE public.orders 
SET updated_at = created_at 
WHERE updated_at IS NULL;


