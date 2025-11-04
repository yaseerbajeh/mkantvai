-- Create order_items table for cart orders
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_code text NOT NULL,
  product_name text NOT NULL,
  price numeric NOT NULL,
  quantity integer DEFAULT 1 CHECK (quantity > 0),
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_code ON public.order_items(product_code);

-- Enable RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Policy: Order items are viewable by order owner or admin
-- Admins will use service role key in API routes
CREATE POLICY "Order items are viewable by order owner"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
