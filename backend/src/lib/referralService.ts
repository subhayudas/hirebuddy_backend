import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './database';
import { randomUUID } from 'crypto';

export interface ReferralCode {
  id: string;
  user_id: string;
  referral_code: string;
  is_active: boolean;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_email: string;
  referral_code_id: string;
  status: 'pending' | 'completed' | 'expired';
  created_at: string;
  completed_at?: string;
  expires_at: string;
}

export interface ReferralReward {
  id: string;
  user_id: string;
  completed_referrals: number;
  premium_granted: boolean;
  premium_granted_at?: string;
  premium_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ReferralStats {
  user: {
    id: string;
    referralCode: string | null;
    codeCreatedAt: string | null;
  };
  rewards: {
    completedReferrals: number;
    premiumGranted: boolean;
    premiumGrantedAt: string | null;
    premiumExpiresAt: string | null;
  };
  statistics: {
    totalReferrals: number;
    completedReferrals: number;
    pendingReferrals: number;
    expiredReferrals: number;
    referralsNeededForPremium: number;
    progressPercentage: number;
  };
  referrals: Referral[];
}

export interface AdminReferralSummary {
  email: string;
  completed_referrals: number;
  premium_granted: boolean;
  premium_granted_at?: string;
  premium_expires_at?: string;
  total_referrals: number;
  completed_count: number;
  pending_count: number;
  expired_count: number;
}

export interface ReferralStatistics {
  total_referrals: number;
  completed_referrals: number;
  pending_referrals: number;
  expired_referrals: number;
  unique_referrers: number;
  unique_referred_emails: number;
}

/**
 * Referral Service Class
 * Handles all referral-related database operations
 */
export class ReferralService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Generate a unique referral code for a user
   */
  async generateReferralCode(userId: string): Promise<{ referralCode: string; isNew: boolean }> {
    // Check if user already has an active referral code
    const { data: existingCode, error: checkError } = await this.supabase
      .from('user_referral_codes')
      .select('referral_code')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Failed to check existing referral code: ${checkError.message}`);
    }

    // If user already has an active code, return it
    if (existingCode) {
      return {
        referralCode: existingCode.referral_code,
        isNew: false
      };
    }

    // Generate new referral code
    const referralCode = `HB-${randomUUID().substring(0, 8).toUpperCase()}`;

    // Insert new referral code
    const { data: newCode, error: insertError } = await this.supabase
      .from('user_referral_codes')
      .insert({
        user_id: userId,
        referral_code: referralCode,
        is_active: true
      })
      .select('referral_code, created_at')
      .single();

    if (insertError) {
      throw new Error(`Failed to create referral code: ${insertError.message}`);
    }

    return {
      referralCode: newCode.referral_code,
      isNew: true
    };
  }

  /**
   * Apply a referral code during user signup
   */
  async applyReferralCode(referralCode: string, userEmail: string): Promise<{ referralId: string; referrerId: string }> {
    // Validate referral code format
    if (!/^HB-[A-F0-9]{8}$/.test(referralCode)) {
      throw new Error('Invalid referral code format');
    }

    // Get referral code details
    const { data: codeData, error: codeError } = await this.supabase
      .from('user_referral_codes')
      .select('id, user_id, referral_code')
      .eq('referral_code', referralCode)
      .eq('is_active', true)
      .single();

    if (codeError || !codeData) {
      throw new Error('Invalid or inactive referral code');
    }

    // Check if user is trying to refer themselves
    // Note: Self-referral prevention is handled by the database function
    // We'll rely on the database constraints for this check
    const { data: referrerData, error: referrerError } = await this.supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', codeData.user_id)
      .single();

    if (referrerError || !referrerData) {
      throw new Error('Referrer not found');
    }

    // Check if email was already referred
    const { data: existingReferral, error: existingError } = await this.supabase
      .from('referrals')
      .select('id')
      .eq('referred_email', userEmail)
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      throw new Error(`Failed to validate referral: ${existingError.message}`);
    }

    if (existingReferral) {
      throw new Error('This email has already been referred');
    }

    // Create referral record
    const { data: newReferral, error: insertError } = await this.supabase
      .from('referrals')
      .insert({
        referrer_id: codeData.user_id,
        referred_email: userEmail,
        referral_code_id: codeData.id,
        status: 'pending'
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to create referral: ${insertError.message}`);
    }

    return {
      referralId: newReferral.id,
      referrerId: codeData.user_id
    };
  }

  /**
   * Get user's referral statistics
   */
  async getUserReferralStats(userId: string): Promise<ReferralStats> {
    // Get user's referral rewards
    const { data: rewards, error: rewardsError } = await this.supabase
      .from('referral_rewards')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (rewardsError && rewardsError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch referral rewards: ${rewardsError.message}`);
    }

    // Get user's referral code
    const { data: referralCode, error: codeError } = await this.supabase
      .from('user_referral_codes')
      .select('referral_code, created_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    // Get detailed referral statistics
    const { data: referrals, error: referralsError } = await this.supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false });

    if (referralsError) {
      throw new Error(`Failed to fetch referrals: ${referralsError.message}`);
    }

    // Calculate statistics
    const totalReferrals = referrals?.length || 0;
    const completedReferrals = referrals?.filter(r => r.status === 'completed').length || 0;
    const pendingReferrals = referrals?.filter(r => r.status === 'pending').length || 0;
    const expiredReferrals = referrals?.filter(r => r.status === 'expired').length || 0;

    return {
      user: {
        id: userId,
        referralCode: referralCode?.referral_code || null,
        codeCreatedAt: referralCode?.created_at || null
      },
      rewards: {
        completedReferrals: rewards?.completed_referrals || 0,
        premiumGranted: rewards?.premium_granted || false,
        premiumGrantedAt: rewards?.premium_granted_at || null,
        premiumExpiresAt: rewards?.premium_expires_at || null
      },
      statistics: {
        totalReferrals,
        completedReferrals,
        pendingReferrals,
        expiredReferrals,
        referralsNeededForPremium: Math.max(0, 10 - (rewards?.completed_referrals || 0)),
        progressPercentage: Math.min(100, ((rewards?.completed_referrals || 0) / 10) * 100)
      },
      referrals: referrals || []
    };
  }

  /**
   * Complete a referral
   */
  async completeReferral(referralId: string): Promise<Referral> {
    // Check if referral exists and is pending
    const { data: referral, error: referralError } = await this.supabase
      .from('referrals')
      .select('*')
      .eq('id', referralId)
      .eq('status', 'pending')
      .single();

    if (referralError || !referral) {
      throw new Error('Referral not found or already completed');
    }

    // Check if referral has expired
    if (new Date(referral.expires_at) < new Date()) {
      throw new Error('Referral has expired');
    }

    // Update referral status to completed
    const { data: updatedReferral, error: updateError } = await this.supabase
      .from('referrals')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', referralId)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(`Failed to complete referral: ${updateError.message}`);
    }

    return updatedReferral;
  }

  /**
   * Get admin referral summary
   */
  async getAdminReferralSummary(): Promise<AdminReferralSummary[]> {
    const { data: summary, error: summaryError } = await this.supabase
      .from('admin_referral_summary')
      .select('*')
      .order('completed_referrals', { ascending: false });

    if (summaryError) {
      throw new Error(`Failed to fetch admin summary: ${summaryError.message}`);
    }

    return summary || [];
  }

  /**
   * Get referral statistics
   */
  async getReferralStatistics(): Promise<ReferralStatistics> {
    const { data: stats, error: statsError } = await this.supabase
      .from('referral_statistics')
      .select('*')
      .single();

    if (statsError) {
      throw new Error(`Failed to fetch referral statistics: ${statsError.message}`);
    }

    return stats || {
      total_referrals: 0,
      completed_referrals: 0,
      pending_referrals: 0,
      expired_referrals: 0,
      unique_referrers: 0,
      unique_referred_emails: 0
    };
  }

  /**
   * Validate referral code
   */
  async validateReferralCode(referralCode: string): Promise<boolean> {
    // Validate format
    if (!/^HB-[A-F0-9]{8}$/.test(referralCode)) {
      return false;
    }

    // Check if referral code is valid and active
    const { data: codeData, error: codeError } = await this.supabase
      .from('user_referral_codes')
      .select('referral_code')
      .eq('referral_code', referralCode)
      .eq('is_active', true)
      .single();

    return !codeError && !!codeData;
  }

  /**
   * Get user's referral progress
   */
  async getUserReferralProgress(userEmail: string): Promise<any> {
    const { data: progress, error: progressError } = await this.supabase
      .from('user_referral_progress')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (progressError && progressError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch referral progress: ${progressError.message}`);
    }

    return progress || {
      email: userEmail,
      completed_referrals: 0,
      progress_status: 'Just Beginning',
      referrals_needed_for_premium: 10
    };
  }

  /**
   * Check if user has premium access
   */
  async hasPremiumAccess(userId: string): Promise<boolean> {
    const { data: rewards, error: rewardsError } = await this.supabase
      .from('referral_rewards')
      .select('premium_granted, premium_expires_at')
      .eq('user_id', userId)
      .single();

    if (rewardsError || !rewards) {
      return false;
    }

    if (!rewards.premium_granted) {
      return false;
    }

    // Check if premium has expired
    if (rewards.premium_expires_at && new Date(rewards.premium_expires_at) < new Date()) {
      return false;
    }

    return true;
  }

  /**
   * Get referral code by user ID
   */
  async getReferralCodeByUserId(userId: string): Promise<string | null> {
    const { data: codeData, error: codeError } = await this.supabase
      .from('user_referral_codes')
      .select('referral_code')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (codeError || !codeData) {
      return null;
    }

    return codeData.referral_code;
  }

  /**
   * Get referrals by user ID
   */
  async getReferralsByUserId(userId: string): Promise<Referral[]> {
    const { data: referrals, error: referralsError } = await this.supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false });

    if (referralsError) {
      throw new Error(`Failed to fetch referrals: ${referralsError.message}`);
    }

    return referrals || [];
  }

  /**
   * Expire old pending referrals
   */
  async expireOldReferrals(): Promise<number> {
    const { data: expiredReferrals, error: expireError } = await this.supabase
      .from('referrals')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (expireError) {
      throw new Error(`Failed to expire old referrals: ${expireError.message}`);
    }

    return expiredReferrals?.length || 0;
  }
}

// Export singleton instance
export const referralService = new ReferralService();
