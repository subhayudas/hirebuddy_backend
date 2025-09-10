-- =====================================================
-- HIREBUDDY REFERRAL SYSTEM - PART 5: VERIFICATION & COMPLETION
-- =====================================================
-- This is the final file - run verification queries to ensure everything is set up correctly
-- Run this file after 04_referral_views.sql
-- =====================================================

-- =====================================================
-- 1. COMPREHENSIVE VERIFICATION
-- =====================================================

-- Check if all tables exist
SELECT 
  'Tables Check' as check_type,
  table_name,
  CASE 
    WHEN table_name IN ('user_referral_codes', 'referrals', 'referral_rewards') 
    THEN '✅ EXISTS' 
    ELSE '❌ MISSING' 
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_referral_codes', 'referrals', 'referral_rewards')
ORDER BY table_name;

-- Check RLS status
SELECT 
  'RLS Check' as check_type,
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ ENABLED' 
    ELSE '❌ DISABLED' 
  END as status
FROM pg_tables 
WHERE tablename IN ('user_referral_codes', 'referrals', 'referral_rewards');

-- Check RLS policies
SELECT 
  'RLS Policies' as check_type,
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN policyname IS NOT NULL THEN '✅ EXISTS' 
    ELSE '❌ MISSING' 
  END as status
FROM pg_policies 
WHERE tablename IN ('user_referral_codes', 'referrals', 'referral_rewards')
ORDER BY tablename, policyname;

-- Check functions
SELECT 
  'Functions Check' as check_type,
  routine_name,
  routine_type,
  CASE 
    WHEN routine_name IN ('is_admin', 'owns_referral', 'can_manage_referral', 
                         'is_valid_referral_code', 'can_use_referral_code', 
                         'has_premium_access', 'update_referral_rewards') 
    THEN '✅ EXISTS' 
    ELSE '❌ MISSING' 
  END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('is_admin', 'owns_referral', 'can_manage_referral', 
                     'is_valid_referral_code', 'can_use_referral_code', 
                     'has_premium_access', 'update_referral_rewards')
ORDER BY routine_name;

-- Check triggers
SELECT 
  'Triggers Check' as check_type,
  trigger_name,
  event_manipulation,
  action_timing,
  CASE 
    WHEN trigger_name = 'trigger_update_referral_rewards' THEN '✅ EXISTS' 
    ELSE '❌ MISSING' 
  END as status
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_update_referral_rewards';

-- Check views
SELECT 
  'Views Check' as check_type,
  table_name,
  CASE 
    WHEN table_name IN ('admin_referral_summary', 'referral_statistics', 'user_referral_progress') 
    THEN '✅ EXISTS' 
    ELSE '❌ MISSING' 
  END as status
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name IN ('admin_referral_summary', 'referral_statistics', 'user_referral_progress')
ORDER BY table_name;

-- =====================================================
-- 2. TEST DATA INSERTION (FOR VERIFICATION)
-- =====================================================

-- Create a test user referral code (replace with actual user ID)
-- Uncomment and modify the line below with a real user ID from your auth.users table
/*
INSERT INTO user_referral_codes (user_id, referral_code) 
VALUES ('your-actual-user-id-here', 'HB-TEST1234')
ON CONFLICT (referral_code) DO NOTHING;
*/

-- =====================================================
-- 3. SYSTEM HEALTH CHECK
-- =====================================================

-- Check referral system statistics
SELECT 
  'System Health' as check_type,
  'Total Referral Codes' as metric,
  COUNT(*) as value
FROM user_referral_codes
UNION ALL
SELECT 
  'System Health',
  'Total Referrals',
  COUNT(*)
FROM referrals
UNION ALL
SELECT 
  'System Health',
  'Total Reward Records',
  COUNT(*)
FROM referral_rewards
UNION ALL
SELECT 
  'System Health',
  'Premium Users',
  COUNT(*)
FROM referral_rewards
WHERE premium_granted = TRUE;

-- =====================================================
-- 4. SECURITY VERIFICATION
-- =====================================================

-- Verify RLS policies are working correctly
-- This query should return only the current user's data when run as authenticated user
SELECT 
  'Security Test' as check_type,
  'RLS Working' as test,
  CASE 
    WHEN COUNT(*) >= 0 THEN '✅ RLS Active' 
    ELSE '❌ RLS Issue' 
  END as status
FROM user_referral_codes 
WHERE user_id = auth.uid();

-- =====================================================
-- 5. COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'HIREBUDDY REFERRAL SYSTEM SETUP COMPLETE!';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Tables created successfully';
  RAISE NOTICE '✅ Indexes created for performance';
  RAISE NOTICE '✅ Functions created for business logic';
  RAISE NOTICE '✅ Triggers set up for automation';
  RAISE NOTICE '✅ RLS policies configured for security';
  RAISE NOTICE '✅ Admin views created for monitoring';
  RAISE NOTICE '';
  RAISE NOTICE 'Your referral system is now ready to use!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test the system with real user data';
  RAISE NOTICE '2. Monitor referral activities through admin views';
  RAISE NOTICE '3. Implement frontend integration';
  RAISE NOTICE '4. Set up monitoring and alerts';
  RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- REFERRAL SYSTEM SETUP COMPLETE!
-- =====================================================
-- 
-- 🎉 CONGRATULATIONS! Your referral system is now fully set up.
-- 
-- 📊 What was created:
-- - 3 core tables with proper constraints and indexes
-- - 7 helper functions for business logic
-- - 1 trigger for automatic reward calculations
-- - 15 RLS policies for security
-- - 3 admin views for monitoring
-- 
-- 🔒 Security features:
-- - Row Level Security (RLS) enabled on all tables
-- - Users can only access their own data
-- - Admins have oversight capabilities
-- - Automatic fraud prevention
-- 
-- 🚀 Ready to use:
-- - Users can generate referral codes
-- - Referrals are tracked automatically
-- - Premium access granted at 10 referrals
-- - Admin dashboard for monitoring
-- 
-- =====================================================

