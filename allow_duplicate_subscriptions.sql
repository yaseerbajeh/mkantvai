-- Drop the unique constraint on subscription_code if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_subscription_code_key') THEN
        ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_subscription_code_key;
    END IF;
END $$;

-- Drop unique index if it exists
DROP INDEX IF EXISTS public.subscriptions_subscription_code_key;
