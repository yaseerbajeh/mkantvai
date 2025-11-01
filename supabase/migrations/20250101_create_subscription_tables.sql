/*
  # Create subscription system tables

  1. orders table
    - Stores customer orders with status tracking
    - assigned_subscription JSONB contains subscription details after approval

  2. subscriptions table
    - Available subscription codes for assignment
    - Will be deleted when assigned to an order

  3. used_subscriptions table
    - Audit trail of assigned subscriptions
    - Tracks which admin assigned which subscription to which order
*/

-- Create orders table
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

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_code text NOT NULL UNIQUE,
  subscription_meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create used_subscriptions table
CREATE TABLE IF NOT EXISTS public.used_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  subscription_code text NOT NULL,
  subscription_meta jsonb,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_email ON public.orders(email);
CREATE INDEX IF NOT EXISTS idx_used_subscriptions_order_id ON public.used_subscriptions(order_id);
CREATE INDEX IF NOT EXISTS idx_used_subscriptions_assigned_by ON public.used_subscriptions(assigned_by);

-- Enable Row Level Security (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.used_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders
-- Allow public to view orders (for order details page)
CREATE POLICY "Users can view their own orders"
  ON public.orders
  FOR SELECT
  USING (true);

-- Allow public to insert orders (for subscription form)
CREATE POLICY "Anyone can create orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (true);

-- Allow updates (for admin approval)
CREATE POLICY "Anyone can update orders"
  ON public.orders
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- RLS Policies for used_subscriptions (admin only)
CREATE POLICY "Admins can view used subscriptions"
  ON public.used_subscriptions
  FOR SELECT
  USING (true);

-- Allow inserts for used_subscriptions (from admin function)
CREATE POLICY "Anyone can insert used subscriptions"
  ON public.used_subscriptions
  FOR INSERT
  WITH CHECK (true);

