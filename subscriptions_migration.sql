-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    subscription_code TEXT NOT NULL,
    product_code TEXT NOT NULL,
    subscription_meta JSONB DEFAULT '{}'::jsonb,
    
    -- Optional: Add foreign key constraint if products table exists and product_code is unique there
    -- CONSTRAINT fk_product_code FOREIGN KEY (product_code) REFERENCES public.products(product_code) ON DELETE CASCADE,
    
    -- Ensure subscription codes are unique
    CONSTRAINT subscriptions_subscription_code_key UNIQUE (subscription_code)
);

-- Create index for faster lookups by product_code
CREATE INDEX IF NOT EXISTS subscriptions_product_code_idx ON public.subscriptions(product_code);

-- Enable Row Level Security (RLS)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access (adjust based on your auth setup)
-- This assumes you have a way to check for admin role, e.g., via a claim or a separate admins table
-- For now, allowing full access to authenticated users for simplicity, or restricted to service_role
CREATE POLICY "Allow full access to admins" ON public.subscriptions
    FOR ALL
    USING (auth.role() = 'authenticated') -- Replace with actual admin check
    WITH CHECK (auth.role() = 'authenticated'); -- Replace with actual admin check
