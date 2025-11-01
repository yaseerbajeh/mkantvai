-- ============================================
-- TEST: Try creating just ONE table first
-- If this works, then run the full file
-- ============================================

-- Test: Create orders table only
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  whatsapp text,
  email text NOT NULL,
  product_name text NOT NULL,
  price numeric NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  assigned_subscription jsonb,
  created_at timestamptz DEFAULT now()
);

-- Check if it was created
SELECT 'orders table created successfully!' as result;

-- View the table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'orders';


