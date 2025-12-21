-- Drop the unique constraint on email if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_stock_email_key') THEN
        ALTER TABLE public.accounts_stock DROP CONSTRAINT accounts_stock_email_key;
    END IF;
END $$;

-- Drop the unique index on email if it exists (sometimes created implicitly or explicitly)
DROP INDEX IF EXISTS public.accounts_stock_email_idx;

-- Also check for any other unique indexes on email and drop them if found
-- (This is a bit more generic to ensure we catch it)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT i.relname
        FROM pg_class t, pg_class i, pg_index ix, pg_attribute a
        WHERE t.oid = ix.indrelid
          AND i.oid = ix.indexrelid
          AND a.attrelid = t.oid
          AND a.attnum = ANY(ix.indkey)
          AND t.relkind = 'r'
          AND t.relname = 'accounts_stock'
          AND a.attname = 'email'
          AND ix.indisunique = true
    ) LOOP
        EXECUTE 'DROP INDEX IF EXISTS public.' || quote_ident(r.relname);
    END LOOP;
END $$;
