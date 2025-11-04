-- Create cart_sessions table to track abandoned carts before checkout
CREATE TABLE IF NOT EXISTS public.cart_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  whatsapp text,
  cart_items jsonb NOT NULL, -- Store cart items as JSON
  total_amount numeric NOT NULL,
  discount_amount numeric DEFAULT 0,
  promo_code_id uuid REFERENCES public.promo_codes(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz, -- When cart expires (optional)
  converted_to_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL -- If cart was converted to order
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cart_sessions_user_id ON public.cart_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_sessions_email ON public.cart_sessions(email);
CREATE INDEX IF NOT EXISTS idx_cart_sessions_created_at ON public.cart_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cart_sessions_converted ON public.cart_sessions(converted_to_order_id) WHERE converted_to_order_id IS NULL;

-- Enable Row Level Security
ALTER TABLE public.cart_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view their own cart sessions
CREATE POLICY "Users can view their own cart sessions"
  ON public.cart_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy to allow service role to manage all cart sessions (for admin)
CREATE POLICY "Service role can manage all cart sessions"
  ON public.cart_sessions FOR ALL
  USING (true);

