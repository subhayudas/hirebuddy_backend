-- =====================================================
-- HIREBUDDY REFERRAL SYSTEM DATABASE MIGRATION
-- =====================================================
-- This file creates all necessary tables, indexes, RLS policies,
-- triggers, and functions for the referral system.
-- Run this file in your Supabase database to set up the system.
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. CORE REFERRAL TABLES
-- =====================================================

-- User Referral Codes Table
CREATE TABLE IF NOT EXISTS user_referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint for referral code format (HB-XXXXXXXX)
  CONSTRAINT referral_code_format CHECK (referral_code ~ '^HB-[A-F0-9]{8}$')
);

-- Referrals Table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_email TEXT NOT NULL,
  referral_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  
  -- Basic constraints
  CONSTRAINT referral_email_valid CHECK (referred_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT referral_expires_future CHECK (expires_at > created_at)
);

-- Referral Rewards Table
CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_referrals INTEGER DEFAULT 0 CHECK (completed_referrals >= 0),
  premium_granted BOOLEAN DEFAULT FALSE,
  premium_granted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user
  CONSTRAINT unique_user_reward UNIQUE (user_id)
);

-- =====================================================
-- 2. INDEXES FOR PERFORMANCE
-- =====================================================

-- User Referral Codes Indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON user_referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON user_referral_codes(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_active ON user_referral_codes(is_active, created_at);

-- Referrals Indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_email ON referrals(referred_email);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status, created_at);
CREATE INDEX IF NOT EXISTS idx_referrals_expires ON referrals(expires_at) WHERE status = 'pending';

-- Referral Rewards Indexes
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user_id ON referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_premium ON referral_rewards(premium_granted, premium_granted_at);

-- =====================================================
-- 3. HELPER FUNCTIONS
-- =====================================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.user_id = user_uuid 
    AND user_profiles.is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user owns the referral
CREATE OR REPLACE FUNCTION owns_referral(referral_uuid UUID, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM referrals 
    WHERE id = referral_uuid 
    AND (referrer_id = user_uuid OR referred_email = (
      SELECT email FROM auth.users WHERE id = user_uuid
    ))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can manage referral (as referrer)
CREATE OR REPLACE FUNCTION can_manage_referral(referral_uuid UUID, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM referrals 
    WHERE id = referral_uuid 
    AND referrer_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if referral code is valid and available
CREATE OR REPLACE FUNCTION is_valid_referral_code(code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_referral_codes 
    WHERE referral_code = code 
    AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can use referral code
CREATE OR REPLACE FUNCTION can_use_referral_code(code TEXT, user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  code_owner_id UUID;
BEGIN
  -- Get the owner of the referral code
  SELECT user_id INTO code_owner_id
  FROM user_referral_codes 
  WHERE referral_code = code AND is_active = TRUE;
  
  -- Check if code exists and is active
  IF code_owner_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user is trying to refer themselves
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = code_owner_id AND email = user_email
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Check if email was already referred
  IF EXISTS (
    SELECT 1 FROM referrals 
    WHERE referred_email = user_email
  ) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has premium access
CREATE OR REPLACE FUNCTION has_premium_access(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM referral_rewards 
    WHERE user_id = user_uuid 
    AND premium_granted = TRUE
    AND (premium_expires_at IS NULL OR premium_expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. TRIGGER FUNCTIONS
-- =====================================================

-- Function to automatically update referral rewards
CREATE OR REPLACE FUNCTION update_referral_rewards()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Create reward record if doesn't exist
    INSERT INTO referral_rewards (user_id, completed_referrals)
    VALUES (NEW.referrer_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'completed' THEN
      -- Increment completed referrals
      UPDATE referral_rewards SET
        completed_referrals = completed_referrals + 1,
        updated_at = NOW()
      WHERE user_id = NEW.referrer_id;
      
      -- Check if premium should be granted (10 referrals)
      UPDATE referral_rewards SET
        premium_granted = TRUE,
        premium_granted_at = NOW()
      WHERE user_id = NEW.referrer_id 
        AND completed_referrals >= 10 
        AND premium_granted = FALSE;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

-- Trigger for automatic referral rewards updates
DROP TRIGGER IF EXISTS trigger_update_referral_rewards ON referrals;
CREATE TRIGGER trigger_update_referral_rewards
  AFTER INSERT OR UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_referral_rewards();

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE user_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. RLS POLICIES
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
-- 8. ADMIN VIEWS
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

-- =====================================================
-- 9. SAMPLE DATA INSERTION (OPTIONAL)
-- =====================================================

-- Insert sample referral codes for testing (uncomment if needed)
-- INSERT INTO user_referral_codes (user_id, referral_code) VALUES 
--   ('sample-user-id-1', 'HB-A1B2C3D4'),
--   ('sample-user-id-2', 'HB-E5F6G7H8');

-- =====================================================
-- 10. VERIFICATION QUERIES
-- =====================================================

-- Verify tables were created
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_referral_codes', 'referrals', 'referral_rewards')
ORDER BY table_name;

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('user_referral_codes', 'referrals', 'referral_rewards');

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename IN ('user_referral_codes', 'referrals', 'referral_rewards')
ORDER BY tablename, policyname;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Your referral system database is now ready!
-- 
-- Tables created:
-- - user_referral_codes: Store user referral codes
-- - referrals: Track referral relationships
-- - referral_rewards: Track rewards and premium status
--
-- Features enabled:
-- - Row Level Security (RLS)
-- - Automatic reward calculations
-- - Admin oversight capabilities
-- - Referral validation
-- - Premium access control
-- =====================================================

