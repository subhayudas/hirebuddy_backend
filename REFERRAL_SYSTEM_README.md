# 🎯 HireBuddy Referral System - Complete Setup Guide

## 📋 Overview

This referral system allows users to refer friends to HireBuddy and earn premium access after reaching 10 successful referrals. The system is built with security, scalability, and ease of use in mind.

## 🚀 Quick Start

### Option 1: One-Click Setup (Recommended)
Run the master setup file in your Supabase database:
```sql
-- Run this single file to set up everything
\i 00_referral_setup_master.sql
```

### Option 2: Step-by-Step Setup
If you prefer to run files individually:
```sql
-- Run in order:
\i 01_referral_tables.sql      -- Creates tables and indexes
\i 02_referral_functions.sql   -- Creates helper functions
\i 03_referral_triggers.sql    -- Sets up triggers and RLS
\i 04_referral_views.sql       -- Creates admin views
\i 05_referral_verification.sql -- Verifies setup
```

## 🗄️ Database Schema

### Core Tables

#### 1. `user_referral_codes`
- Stores unique referral codes for each user
- Format: `HB-XXXXXXXX` (8 random hex characters)
- One active code per user

#### 2. `referrals`
- Tracks all referral relationships
- Status: `pending`, `completed`, `expired`
- Expires after 30 days if not completed

#### 3. `referral_rewards`
- Tracks user progress and premium status
- Automatically grants premium at 10 referrals
- One record per user

### Admin Views

#### 1. `admin_referral_summary`
- Complete overview of all users and their referral status
- Shows completed referrals, premium status, and counts

#### 2. `referral_statistics`
- System-wide statistics
- Total referrals, completion rates, unique users

#### 3. `user_referral_progress`
- User-friendly progress tracking
- Shows progress status and referrals needed for premium

## 🔒 Security Features

### Row Level Security (RLS)
- **Users can only access their own data**
- **Admins have oversight capabilities**
- **System operations protected**

### Anti-Fraud Measures
- **Self-referral prevention**
- **Duplicate email protection**
- **Referral code validation**
- **Automatic expiration**

## 📊 How It Works

### 1. User Gets Referral Code
```sql
-- Generate referral code for user
INSERT INTO user_referral_codes (user_id, referral_code) 
VALUES (auth.uid(), 'HB-A1B2C3D4');
```

### 2. User Shares Referral Code
- User shares code via email, social media, or direct link
- Code format: `HB-A1B2C3D4`

### 3. New User Uses Referral Code
```sql
-- Create referral when new user signs up
INSERT INTO referrals (referrer_id, referred_email, referral_code) 
VALUES (referrer_user_id, 'friend@example.com', 'HB-A1B2C3D4');
```

### 4. Referral Completion
```sql
-- Mark referral as completed when new user finishes onboarding
UPDATE referrals 
SET status = 'completed', completed_at = NOW() 
WHERE id = 'referral_id';
```

### 5. Automatic Premium Granting
- System automatically tracks completed referrals
- Premium access granted at 10 referrals
- No manual intervention required

## 🛠️ API Integration Examples

### Generate Referral Code
```typescript
// Backend function to generate referral code
const generateReferralCode = async (userId: string): Promise<string> => {
  const code = `HB-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
  
  await supabase
    .from('user_referral_codes')
    .insert({ user_id: userId, referral_code: code });
    
  return code;
};
```

### Apply Referral Code
```typescript
// Backend function to apply referral code
const applyReferralCode = async (code: string, userEmail: string): Promise<boolean> => {
  // Check if code is valid
  const { data: codeData } = await supabase
    .from('user_referral_codes')
    .select('user_id')
    .eq('referral_code', code)
    .eq('is_active', true)
    .single();
    
  if (!codeData) return false;
  
  // Create referral record
  const { error } = await supabase
    .from('referrals')
    .insert({
      referrer_id: codeData.user_id,
      referred_email: userEmail,
      referral_code: code
    });
    
  return !error;
};
```

### Get User Referral Stats
```typescript
// Get user's referral statistics
const getUserReferralStats = async (userId: string) => {
  const { data } = await supabase
    .from('referral_rewards')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  return data;
};
```

## 📈 Monitoring & Analytics

### Admin Dashboard Queries
```sql
-- Get top referrers
SELECT email, completed_referrals, premium_granted
FROM admin_referral_summary
ORDER BY completed_referrals DESC
LIMIT 10;

-- Get system statistics
SELECT * FROM referral_statistics;

-- Get users close to premium
SELECT email, completed_referrals, referrals_needed_for_premium
FROM user_referral_progress
WHERE completed_referrals >= 7
ORDER BY completed_referrals DESC;
```

### User Progress Tracking
```sql
-- Get user's referral progress
SELECT 
  completed_referrals,
  CASE 
    WHEN completed_referrals >= 10 THEN 'Premium Unlocked!'
    ELSE CONCAT(10 - completed_referrals, ' more referrals needed')
  END as status
FROM referral_rewards
WHERE user_id = auth.uid();
```

## 🔧 Maintenance & Troubleshooting

### Check System Health
```sql
-- Run verification queries
SELECT * FROM admin_referral_summary;
SELECT * FROM referral_statistics;
SELECT * FROM user_referral_progress;
```

### Common Issues & Solutions

#### Issue: Referral codes not generating
**Solution:** Check if `uuid-ossp` extension is enabled
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

#### Issue: RLS blocking operations
**Solution:** Verify RLS policies are correct
```sql
SELECT * FROM pg_policies WHERE tablename = 'user_referral_codes';
```

#### Issue: Triggers not working
**Solution:** Check trigger function exists
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'trigger_update_referral_rewards';
```

### Performance Optimization
```sql
-- Add additional indexes if needed
CREATE INDEX CONCURRENTLY idx_referrals_created_at 
ON referrals(created_at);

CREATE INDEX CONCURRENTLY idx_referral_rewards_updated_at 
ON referral_rewards(updated_at);
```

## 🚀 Next Steps

### 1. Frontend Integration
- Add referral code input field to signup
- Create referral dashboard for users
- Implement referral sharing functionality

### 2. Email Notifications
- Send welcome emails to referred users
- Notify referrers when referrals complete
- Alert users when premium is unlocked

### 3. Advanced Features
- Referral tiers (bronze, silver, gold)
- Time-limited referral bonuses
- Social media integration
- Referral leaderboards

### 4. Monitoring & Alerts
- Set up automated fraud detection
- Monitor referral conversion rates
- Track premium activation metrics

## 📚 File Structure

```
referral_system/
├── 00_referral_setup_master.sql    # Complete setup (recommended)
├── 01_referral_tables.sql          # Tables and indexes
├── 02_referral_functions.sql       # Helper functions
├── 03_referral_triggers.sql        # Triggers and RLS
├── 04_referral_views.sql           # Admin views
├── 05_referral_verification.sql    # Verification queries
└── REFERRAL_SYSTEM_README.md       # This file
```

## ✅ Verification Checklist

After running the setup, verify:

- [ ] All 3 tables created successfully
- [ ] RLS enabled on all tables
- [ ] 15 RLS policies created
- [ ] 7 helper functions working
- [ ] 1 trigger active
- [ ] 3 admin views accessible
- [ ] Sample data can be inserted
- [ ] Referral codes generate correctly
- [ ] Premium access granted at 10 referrals

## 🆘 Support

If you encounter issues:

1. **Check the verification file** (`05_referral_verification.sql`)
2. **Review RLS policies** for permission issues
3. **Verify trigger function** exists and is working
4. **Check database logs** for error messages
5. **Ensure all files were run in order**

## 🎉 Congratulations!

Your referral system is now ready to use! Users can start referring friends, and the system will automatically track progress and grant premium access at 10 successful referrals.

---

**Built with ❤️ for HireBuddy**
**Security-first design with comprehensive RLS policies**
**Automatic reward calculations and fraud prevention**

