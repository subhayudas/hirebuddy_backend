-- =====================================================
-- HIREBUDDY REFERRAL SYSTEM - PART 3: TRIGGERS & RLS
-- =====================================================
-- This file creates triggers and sets up Row Level Security
-- Run this file after 02_referral_functions.sql
-- =====================================================

-- =====================================================
-- 1. TRIGGERS
-- =====================================================

-- Trigger for automatic referral rewards updates
DROP TRIGGER IF EXISTS trigger_update_referral_rewards ON referrals;
CREATE TRIGGER trigger_update_referral_rewards
  AFTER INSERT OR UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_referral_rewards();

-- =====================================================
-- 2. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE user_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. RLS POLICIES
-- =====================================================

-- User Referral Codes Policies
CREATE POLICY "users_view_own_referral_codes" ON user_referral_codes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_create_own_referral_codes" ON user_referral_codes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_referral_codes" ON user_referral_codes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_referral_codes" ON user_referral_codes
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "admins_view_all_referral_codes" ON user_referral_codes
  FOR SELECT USING (is_admin());

-- Referrals Policies
CREATE POLICY "referrers_view_own_referrals" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id);

CREATE POLICY "referred_users_view_own_referrals" ON referrals
  FOR SELECT USING (
    referred_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "users_create_valid_referrals" ON referrals
  FOR INSERT WITH CHECK (
    auth.uid() = referrer_id 
    AND can_use_referral_code(referral_code, referred_email)
  );

CREATE POLICY "users_update_own_referrals" ON referrals
  FOR UPDATE USING (can_manage_referral(id));

CREATE POLICY "users_delete_own_referrals" ON referrals
  FOR DELETE USING (can_manage_referral(id));

CREATE POLICY "admins_view_all_referrals" ON referrals
  FOR SELECT USING (is_admin());

CREATE POLICY "admins_update_all_referrals" ON referrals
  FOR UPDATE USING (is_admin());

-- Referral Rewards Policies
CREATE POLICY "users_view_own_rewards" ON referral_rewards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_rewards" ON referral_rewards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_cannot_insert_rewards" ON referral_rewards
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "users_cannot_delete_rewards" ON referral_rewards
  FOR DELETE USING (FALSE);

CREATE POLICY "admins_view_all_rewards" ON referral_rewards
  FOR SELECT USING (is_admin());

CREATE POLICY "admins_update_all_rewards" ON referral_rewards
  FOR UPDATE USING (is_admin());

CREATE POLICY "system_manage_rewards" ON referral_rewards
  FOR ALL USING (current_setting('role') = 'service_role');

-- =====================================================
-- TRIGGERS AND RLS SETUP COMPLETE
-- =====================================================
-- Run the next file: 04_referral_views.sql
-- =====================================================

