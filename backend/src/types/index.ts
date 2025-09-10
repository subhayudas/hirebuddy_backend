// AWS Lambda Event Types
export interface APIGatewayProxyEvent {
  body: string | null;
  headers: { [name: string]: string | undefined };
  httpMethod: string;
  path: string;
  pathParameters: { [name: string]: string | undefined } | null;
  queryStringParameters: { [name: string]: string | undefined } | null;
  requestContext: {
    requestId: string;
    stage: string;
    httpMethod: string;
    path: string;
    identity?: {
      sourceIp?: string;
      userAgent?: string;
    };
  };
  isBase64Encoded: boolean;
}

export interface APIGatewayProxyResult {
  statusCode: number;
  headers?: { [header: string]: boolean | number | string };
  body: string;
  isBase64Encoded?: boolean;
}

// JWT Types
export interface DecodedToken {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Database Types
export interface UserProfile {
  id?: string;
  user_id?: string;
  full_name?: string;
  title?: string;
  company?: string;
  location?: string;
  phone?: string;
  bio?: string;
  website?: string;
  github?: string;
  linkedin?: string;
  college?: string;
  skills?: string[];
  experience_years?: number;
  available_for_work?: boolean;
  profile_image_url?: string;
  resume_url?: string;
  resume_filename?: string;
  resume_uploaded_at?: string;
  created_at?: string;
  updated_at?: string;
  preferred_roles?: string[];
  experience_level?: 'student' | 'entry' | 'mid' | 'senior' | 'leadership';
  work_mode?: 'remote' | 'hybrid' | 'onsite';
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  career_goals?: string[];
  onboarding_completed?: boolean;
  onboarding_completed_at?: string;
  job_search_urgency?: 'rush' | 'open';
}

export interface Contact {
  id: string;
  created_at: string;
  full_name?: string | null;
  company_name?: string | null;
  linkedin_link?: string | null;
  email?: string | null;
  title?: string | null;
  first_name?: string | null;
  company_website_full?: string | null;
  email_sent_on?: string | null;
}

export interface JobApplication {
  id: string;
  user_id: string;
  user_email: string;
  job_id: string;
  job_title: string;
  company_name: string;
  job_type: 'exclusive' | 'regular';
  status: 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired';
  created_at: string;
  updated_at?: string;
  reviewed_at?: string;
  admin_notes?: string;
  reviewed_by?: string;
  // Profile data copied at application time
  full_name?: string;
  title?: string;
  company?: string;
  location?: string;
  phone?: string;
  bio?: string;
  website?: string;
  github?: string;
  linkedin?: string;
  college?: string;
  skills?: string[];
  experience_years?: number;
  available_for_work?: boolean;
  resume_url?: string;
  resume_filename?: string;
}

// Premium User Types
export interface PremiumUser {
  id: number;
  created_at: string;
  email: string;
  name: string;
  phone: string;
  zoom_id: string;
  designation: string;
  order_id: string;
  amount: number;
}

export interface PremiumUserCreate {
  email: string;
  name: string;
  phone: string;
  zoom_id: string;
  designation: string;
  order_id: string;
  amount: number;
}

export interface PremiumUserUpdate {
  name?: string;
  phone?: string;
  zoom_id?: string;
  designation?: string;
  order_id?: string;
  amount?: number;
}

// Email Usage Types
export interface EmailCountRecord {
  id: string;
  created_at: string;
  total_count: number;
  user_id: string;
  email_limit: number;
}

export interface EmailUsageResponse {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  canSendEmail: boolean;
}

export interface EmailIncrementRequest {
  count?: number;
}

export interface EmailIncrementResponse {
  previousCount: number;
  newCount: number;
  limit: number;
  remaining: number;
  canSendEmail: boolean;
}

// Referral System Types
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

export interface ReferralProgress {
  email: string;
  completed_referrals: number;
  progress_status: string;
  referrals_needed_for_premium: number;
}

// Referral API Request/Response Types
export interface GenerateReferralCodeRequest {
  userId?: string;
}

export interface GenerateReferralCodeResponse {
  referralCode: string;
  message: string;
  isNew: boolean;
  createdAt?: string;
}

export interface ApplyReferralCodeRequest {
  referralCode: string;
  userEmail: string;
  userId?: string;
}

export interface ApplyReferralCodeResponse {
  referralId: string;
  message: string;
  referrerId: string;
  expiresAt: string;
  createdAt: string;
}

export interface CompleteReferralRequest {
  referralId: string;
  completedBy?: string;
}

export interface CompleteReferralResponse {
  referral: Referral;
  message: string;
}

export interface ValidateReferralCodeResponse {
  valid: boolean;
  referralCode: string;
  message: string;
} 