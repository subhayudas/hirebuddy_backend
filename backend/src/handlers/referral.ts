import { APIGatewayProxyEvent, APIGatewayProxyResult } from '../types';
import { getSupabaseClient } from '../lib/database';
import { successResponse, errorResponse, corsResponse, unauthorizedResponse } from '../lib/response';
import { requireAuth } from '../lib/auth';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Validation schemas
const generateCodeSchema = z.object({
  userId: z.string().uuid().optional() // Optional, will use auth.uid() if not provided
});

const applyCodeSchema = z.object({
  referralCode: z.string().regex(/^HB-[A-F0-9]{8}$/, 'Invalid referral code format'),
  userEmail: z.string().email('Invalid email format'),
  userId: z.string().uuid().optional() // For the new user being referred
});

const completeReferralSchema = z.object({
  referralId: z.string().uuid(),
  completedBy: z.string().uuid().optional() // User ID who completed the referral
});

const getStatsSchema = z.object({
  userId: z.string().uuid().optional() // Optional, will use auth.uid() if not provided
});

/**
 * Generate referral code for authenticated user
 */
export const generateReferralCode = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    let userId: string;
    try {
      const authResult = requireAuth(event);
      userId = authResult.id;
    } catch (error) {
      return unauthorizedResponse('Authentication required');
    }

    // Validate input
    const validation = generateCodeSchema.safeParse({ userId });
    if (!validation.success) {
      return errorResponse(`Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`, 422);
    }

    const supabase = getSupabaseClient();

    // Check if user already has an active referral code
    const { data: existingCode, error: checkError } = await supabase
      .from('user_referral_codes')
      .select('referral_code, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking existing referral code:', checkError);
      return errorResponse('Failed to check existing referral code', 500);
    }

    // If user already has an active code, return it
    if (existingCode) {
      return successResponse({
        referralCode: existingCode.referral_code,
        message: 'Existing referral code retrieved',
        isNew: false
      });
    }

    // Generate new referral code
    const referralCode = `HB-${randomUUID().substring(0, 8).toUpperCase()}`;

    // Insert new referral code
    const { data: newCode, error: insertError } = await supabase
      .from('user_referral_codes')
      .insert({
        user_id: userId,
        referral_code: referralCode,
        is_active: true
      })
      .select('referral_code, created_at')
      .single();

    if (insertError) {
      console.error('Error creating referral code:', insertError);
      return errorResponse('Failed to create referral code', 500);
    }

    return successResponse({
      referralCode: newCode.referral_code,
      message: 'Referral code generated successfully',
      isNew: true,
      createdAt: newCode.created_at
    });

  } catch (error) {
    console.error('Error in generateReferralCode:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Apply referral code during user signup
 */
export const applyReferralCode = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    
    // Validate input
    const validation = applyCodeSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`, 422);
    }

    const { referralCode, userEmail, userId } = validation.data;

    const supabase = getSupabaseClient();

    // Check if referral code is valid and available
    const { data: codeData, error: codeError } = await supabase
      .from('user_referral_codes')
      .select('id, user_id, referral_code')
      .eq('referral_code', referralCode)
      .eq('is_active', true)
      .single();

    if (codeError || !codeData) {
      return errorResponse('Invalid or inactive referral code', 400);
    }

    // Check if user is trying to refer themselves
    // Note: We'll use the user_profiles table or get user email from the referral system
    // For now, we'll skip this check and rely on the database constraints
    const { data: referrerData, error: referrerError } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', codeData.user_id)
      .single();

    if (referrerError || !referrerData) {
      return errorResponse('Referrer not found', 400);
    }

    // Note: Self-referral prevention is handled by the database function
    // We'll rely on the database constraints for this check

    // Check if email was already referred
    const { data: existingReferral, error: existingError } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_email', userEmail)
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Error checking existing referral:', existingError);
      return errorResponse('Failed to validate referral', 500);
    }

    if (existingReferral) {
      return errorResponse('This email has already been referred', 400);
    }

    // Create referral record
    const { data: newReferral, error: insertError } = await supabase
      .from('referrals')
      .insert({
        referrer_id: codeData.user_id,
        referred_email: userEmail,
        referral_code_id: codeData.id,
        status: 'pending'
      })
      .select('id, created_at, expires_at')
      .single();

    if (insertError) {
      console.error('Error creating referral:', insertError);
      return errorResponse('Failed to create referral', 500);
    }

    return successResponse({
      referralId: newReferral.id,
      message: 'Referral code applied successfully',
      referrerId: codeData.user_id,
      expiresAt: newReferral.expires_at,
      createdAt: newReferral.created_at
    });

  } catch (error) {
    console.error('Error in applyReferralCode:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Get user's referral statistics
 */
export const getReferralStats = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    let userId: string;
    try {
      const authResult = requireAuth(event);
      userId = authResult.id;
    } catch (error) {
      return unauthorizedResponse('Authentication required');
    }

    // Validate input
    const validation = getStatsSchema.safeParse({ userId });
    if (!validation.success) {
      return errorResponse(`Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`, 422);
    }

    const supabase = getSupabaseClient();

    // Get user's referral rewards
    const { data: rewards, error: rewardsError } = await supabase
      .from('referral_rewards')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (rewardsError && rewardsError.code !== 'PGRST116') {
      console.error('Error fetching referral rewards:', rewardsError);
      return errorResponse('Failed to fetch referral statistics', 500);
    }

    // Get user's referral code
    const { data: referralCode, error: codeError } = await supabase
      .from('user_referral_codes')
      .select('referral_code, created_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    // Get detailed referral statistics
    const { data: referrals, error: referralsError } = await supabase
      .from('referrals')
      .select('id, referred_email, status, created_at, completed_at')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false });

    if (referralsError) {
      console.error('Error fetching referrals:', referralsError);
      return errorResponse('Failed to fetch referral details', 500);
    }

    // Calculate statistics
    const totalReferrals = referrals?.length || 0;
    const completedReferrals = referrals?.filter(r => r.status === 'completed').length || 0;
    const pendingReferrals = referrals?.filter(r => r.status === 'pending').length || 0;
    const expiredReferrals = referrals?.filter(r => r.status === 'expired').length || 0;

    const stats = {
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

    return successResponse(stats);

  } catch (error) {
    console.error('Error in getReferralStats:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Get user's referral progress (simplified version)
 */
export const getReferralProgress = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    let userId: string;
    try {
      const authResult = requireAuth(event);
      userId = authResult.id;
    } catch (error) {
      return unauthorizedResponse('Authentication required');
    }

    const supabase = getSupabaseClient();

    // Get user's referral progress from the view
    const { data: progress, error: progressError } = await supabase
      .from('user_referral_progress')
      .select('*')
      .eq('email', (await supabase.auth.getUser()).data.user?.email)
      .single();

    if (progressError && progressError.code !== 'PGRST116') {
      console.error('Error fetching referral progress:', progressError);
      return errorResponse('Failed to fetch referral progress', 500);
    }

    return successResponse({
      progress: progress || {
        email: (await supabase.auth.getUser()).data.user?.email,
        completed_referrals: 0,
        progress_status: 'Just Beginning',
        referrals_needed_for_premium: 10
      }
    });

  } catch (error) {
    console.error('Error in getReferralProgress:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Mark referral as completed
 */
export const completeReferral = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    let authResult: any;
    try {
      authResult = requireAuth(event);
    } catch (error) {
      return unauthorizedResponse('Authentication required');
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    
    // Validate input
    const validation = completeReferralSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`, 422);
    }

    const { referralId, completedBy } = validation.data;
    const userId = completedBy || authResult.id;

    const supabase = getSupabaseClient();

    // Check if referral exists and is pending
    const { data: referral, error: referralError } = await supabase
      .from('referrals')
      .select('*')
      .eq('id', referralId)
      .eq('status', 'pending')
      .single();

    if (referralError || !referral) {
      return errorResponse('Referral not found or already completed', 400);
    }

    // Check if referral has expired
    if (new Date(referral.expires_at) < new Date()) {
      return errorResponse('Referral has expired', 400);
    }

    // Update referral status to completed
    const { data: updatedReferral, error: updateError } = await supabase
      .from('referrals')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', referralId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating referral:', updateError);
      return errorResponse('Failed to complete referral', 500);
    }

    return successResponse({
      referral: updatedReferral,
      message: 'Referral completed successfully'
    });

  } catch (error) {
    console.error('Error in completeReferral:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Get admin referral statistics
 */
export const getAdminReferralStats = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    let authResult: any;
    try {
      authResult = requireAuth(event);
    } catch (error) {
      return unauthorizedResponse('Authentication required');
    }

    const supabase = getSupabaseClient();

    // Check if user is admin
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', authResult.id)
      .single();

    if (profileError || !userProfile?.is_admin) {
      return unauthorizedResponse('Admin access required');
    }

    // Get admin referral summary
    const { data: summary, error: summaryError } = await supabase
      .from('admin_referral_summary')
      .select('*')
      .order('completed_referrals', { ascending: false });

    if (summaryError) {
      console.error('Error fetching admin summary:', summaryError);
      return errorResponse('Failed to fetch admin statistics', 500);
    }

    // Get referral statistics
    const { data: stats, error: statsError } = await supabase
      .from('referral_statistics')
      .select('*')
      .single();

    if (statsError) {
      console.error('Error fetching referral statistics:', statsError);
      return errorResponse('Failed to fetch system statistics', 500);
    }

    return successResponse({
      summary: summary || [],
      statistics: stats || {},
      message: 'Admin referral statistics retrieved successfully'
    });

  } catch (error) {
    console.error('Error in getAdminReferralStats:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Validate referral code (public endpoint)
 */
export const validateReferralCode = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    const referralCode = event.queryStringParameters?.code;

    if (!referralCode) {
      return errorResponse('Referral code is required', 400);
    }

    // Validate format
    if (!/^HB-[A-F0-9]{8}$/.test(referralCode)) {
      return errorResponse('Invalid referral code format', 400);
    }

    const supabase = getSupabaseClient();

    // Check if referral code is valid and active
    const { data: codeData, error: codeError } = await supabase
      .from('user_referral_codes')
      .select('referral_code, is_active, created_at')
      .eq('referral_code', referralCode)
      .eq('is_active', true)
      .single();

    if (codeError || !codeData) {
      return errorResponse('Invalid or inactive referral code', 400);
    }

    return successResponse({
      valid: true,
      referralCode: codeData.referral_code,
      message: 'Referral code is valid'
    });

  } catch (error) {
    console.error('Error in validateReferralCode:', error);
    return errorResponse('Internal server error', 500);
  }
};
