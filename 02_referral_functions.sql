-- =====================================================
-- HIREBUDDY REFERRAL SYSTEM - PART 2: HELPER FUNCTIONS
-- =====================================================
-- This file creates helper functions and trigger functions
-- Run this file after 01_referral_tables.sql
-- =====================================================

-- =====================================================
-- 1. HELPER FUNCTIONS
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
-- 2. TRIGGER FUNCTIONS
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
-- FUNCTIONS CREATED SUCCESSFULLY
-- =====================================================
-- Run the next file: 03_referral_triggers.sql
-- =====================================================

