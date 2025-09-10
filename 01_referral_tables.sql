-- =====================================================
-- HIREBUDDY REFERRAL SYSTEM - PART 1: CORE TABLES
-- =====================================================
-- This file creates the core referral system tables and indexes
-- Run this file first in your Supabase database
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
-- TABLES CREATED SUCCESSFULLY
-- =====================================================
-- Run the next file: 02_referral_functions.sql
-- =====================================================

