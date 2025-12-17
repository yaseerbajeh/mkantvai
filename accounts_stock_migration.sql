-- Create accounts_stock table
CREATE TABLE IF NOT EXISTS public.accounts_stock (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    expiration_date DATE,
    renew_until DATE,
    type TEXT,
    notes TEXT
);

-- Enable RLS
ALTER TABLE public.accounts_stock ENABLE ROW LEVEL SECURITY;

-- Create policies (assuming public read for admins/authenticated for now similar to others, or strict admin)
-- Since we don't have the exact admin check function handy in SQL usually, allowing authenticated for now and handling auth in API is a common pattern in this codebase, 
-- BUT `admin/products` usually checks email.
-- Let's just create the table. RLS policies can be applied if needed, but for now we'll allow all authenticated to CRUD for simplicity in the migration script, 
-- or we can skip RLS creation here if the user manages it via dashboard.
-- I'll add basic authenticated policies to be safe.

CREATE POLICY "Enable read access for authenticated users" ON "public"."accounts_stock"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON "public"."accounts_stock"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON "public"."accounts_stock"
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Enable delete access for authenticated users" ON "public"."accounts_stock"
AS PERMISSIVE FOR DELETE
TO authenticated
USING (true);
