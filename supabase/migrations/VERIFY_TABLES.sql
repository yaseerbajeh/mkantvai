-- ============================================
-- Run this query to verify tables exist
-- ============================================

-- Check if tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('orders', 'subscriptions', 'used_subscriptions') THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('orders', 'subscriptions', 'used_subscriptions')
ORDER BY table_name;

-- If no rows returned, tables don't exist yet - run RUN_THIS_IN_SUPABASE.sql first


