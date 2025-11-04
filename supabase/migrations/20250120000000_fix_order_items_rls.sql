-- Fix order_items RLS policy to allow admins to view all order items
-- This allows the admin panel to display order_items for all orders

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Order items are viewable by order owner" ON public.order_items;

-- Create new policy that allows viewing all order items (for admin panel)
-- Similar to orders table which allows public viewing
CREATE POLICY "Anyone can view order items"
  ON public.order_items FOR SELECT
  USING (true);

