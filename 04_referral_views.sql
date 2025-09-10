-- =====================================================
-- HIREBUDDY REFERRAL SYSTEM - PART 4: ADMIN VIEWS
-- =====================================================
-- This file creates admin views and verification queries
-- Run this file after 03_referral_triggers.sql
-- =====================================================

-- =====================================================
-- 1. ADMIN VIEWS
-- =====================================================

-- Admin referral summary view
CREATE OR REPLACE VIEW admin_referral_summary AS
SELECT 
  u.email,
  rr.completed_referrals,
  rr.premium_granted,
  rr.premium_granted_at,
  COUNT(r.id) as total_referrals,
  COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_count,
  COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN r.status = 'expired' THEN 1 END) as expired_count
FROM auth.users u
LEFT JOIN referral_rewards rr ON u.id = rr.user_id
LEFT JOIN referrals r ON u.id = r.referrer_id
GROUP BY u.id, u.email, rr.completed_referrals, rr.premium_granted, rr.premium_granted_at
ORDER BY rr.completed_referrals DESC;

-- Referral statistics view
CREATE OR REPLACE VIEW referral_statistics AS
SELECT 
  COUNT(*) as total_referrals,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_referrals,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_referrals,
  COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_referrals,
  COUNT(DISTINCT referrer_id) as unique_referrers,
  COUNT(DISTINCT referred_email) as unique_referred_emails
FROM referrals;

-- User referral progress view
CREATE OR REPLACE VIEW user_referral_progress AS
SELECT 
  u.email,
  COALESCE(rr.completed_referrals, 0) as completed_referrals,
  CASE 
    WHEN COALESCE(rr.completed_referrals, 0) >= 10 THEN 'Premium Unlocked'
    WHEN COALESCE(rr.completed_referrals, 0) >= 7 THEN 'Almost There!'
    WHEN COALESCE(rr.completed_referrals, 0) >= 5 THEN 'Halfway!'
    WHEN COALESCE(rr.completed_referrals, 0) >= 2 THEN 'Getting Started'
    ELSE 'Just Beginning'
  END as progress_status,
  GREATEST(0, 10 - COALESCE(rr.completed_referrals, 0)) as referrals_needed_for_premium
FROM auth.users u
LEFT JOIN referral_rewards rr ON u.id = rr.user_id
ORDER BY rr.completed_referrals DESC NULLS LAST;

-- =====================================================
-- 2. VERIFICATION QUERIES
-- =====================================================

-- Verify tables were created
-- Run this query to check if all tables exist:
/*
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_referral_codes', 'referrals', 'referral_rewards')
ORDER BY table_name;
*/

-- Verify RLS is enabled
-- Run this query to check RLS status:
/*
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('user_referral_codes', 'referrals', 'referral_rewards');
*/

-- Verify policies were created
-- Run this query to check RLS policies:
/*
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename IN ('user_referral_codes', 'referrals', 'referral_rewards')
ORDER BY tablename, policyname;
*/

-- Verify functions were created
-- Run this query to check functions:
/*
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('is_admin', 'owns_referral', 'can_manage_referral', 
                     'is_valid_referral_code', 'can_use_referral_code', 
                     'has_premium_access', 'update_referral_rewards')
ORDER BY routine_name;
*/

-- =====================================================
-- 3. SAMPLE DATA INSERTION (OPTIONAL - FOR TESTING)
-- =====================================================

-- Uncomment and modify these lines if you want to test with sample data
-- Make sure to replace 'sample-user-id-here' with actual user IDs from your auth.users table

/*
-- Insert sample referral codes for testing
INSERT INTO user_referral_codes (user_id, referral_code) VALUES 
  ('sample-user-id-1', 'HB-A1B2C3D4'),
  ('sample-user-id-2', 'HB-E5F6G7H8');

-- Insert sample referrals for testing
INSERT INTO referrals (referrer_id, referred_email, referral_code) VALUES 
  ('sample-user-id-1', 'friend1@example.com', 'HB-A1B2C3D4'),
  ('sample-user-id-1', 'friend2@example.com', 'HB-A1B2C3D4'),
  ('sample-user-id-2', 'friend3@example.com', 'HB-E5F6G7H8');
*/
-- =====================================================
-- ADMIN VIEWS CREATED SUCCESSFULLY
-- =====================================================
-- Run the final file: 05_referral_verification.sql
-- =====================================================

