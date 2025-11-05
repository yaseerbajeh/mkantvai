/*
  # Create Reviews Table

  1. New Tables
    - `reviews`
      - `id` (uuid, primary key) - Unique identifier for each review
      - `order_id` (uuid) - Reference to the order being reviewed
      - `product_code` (text) - Product code from the order
      - `user_email` (text) - Email of the user who made the review (from order)
      - `rating` (integer) - Rating from 1 to 5
      - `comment` (text) - Optional comment text
      - `created_at` (timestamptz) - Timestamp of review creation
      - `updated_at` (timestamptz) - Timestamp of last update

  2. Constraints
    - Unique constraint: one review per order_id (users can only review each order once)
    - Rating must be between 1 and 5
    - Foreign key to orders table with CASCADE delete

  3. Security
    - Enable RLS on `reviews` table
    - Users can only view all reviews (public)
    - Users can only insert reviews for their own orders
    - Users can update their own reviews

  4. Indexes
    - Create indexes on frequently queried columns (product_code, user_email, order_id)
*/

-- Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_code text NOT NULL,
  user_email text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(order_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reviews_product_code ON public.reviews(product_code);
CREATE INDEX IF NOT EXISTS idx_reviews_user_email ON public.reviews(user_email);
CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON public.reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_reviews_updated_at();

-- Create helper function to get user email (with SECURITY DEFINER to access auth.users)
CREATE OR REPLACE FUNCTION public.get_user_email()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = auth.uid());
END;
$$;

-- Enable Row Level Security (RLS)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view reviews (public access for product pages)
CREATE POLICY "Anyone can view reviews"
  ON public.reviews
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Users can insert reviews for their own orders only
-- This is enforced by checking the order's email matches the authenticated user's email
CREATE POLICY "Users can insert reviews for their own orders"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_email = public.get_user_email()
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = reviews.order_id
      AND orders.email = public.get_user_email()
      AND orders.status IN ('approved', 'paid')
    )
  );

-- Users can update their own reviews only
CREATE POLICY "Users can update their own reviews"
  ON public.reviews
  FOR UPDATE
  TO authenticated
  USING (
    user_email = public.get_user_email()
  )
  WITH CHECK (
    user_email = public.get_user_email()
  );

-- Users can delete their own reviews only
CREATE POLICY "Users can delete their own reviews"
  ON public.reviews
  FOR DELETE
  TO authenticated
  USING (
    user_email = public.get_user_email()
  );

