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