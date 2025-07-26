import { APIGatewayProxyEvent, APIGatewayProxyResult } from '../types';
import { executeQuery } from '../lib/database';
import { successResponse, errorResponse, corsResponse, unauthorizedResponse, notFoundResponse } from '../lib/response';
import { requireAuth } from '../lib/auth';
import { z } from 'zod';

// Validation schemas
const updateProfileSchema = z.object({
  full_name: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  github: z.string().optional(),
  linkedin: z.string().optional(),
  college: z.string().optional(),
  skills: z.array(z.string()).optional(),
  experience_years: z.number().min(0).optional(),
  available_for_work: z.boolean().optional(),
  preferred_roles: z.array(z.string()).optional(),
  experience_level: z.enum(['student', 'entry', 'mid', 'senior', 'leadership']).optional(),
  work_mode: z.enum(['remote', 'hybrid', 'onsite']).optional(),
  salary_min: z.number().min(0).optional(),
  salary_max: z.number().min(0).optional(),
  salary_currency: z.string().optional(),
  career_goals: z.array(z.string()).optional(),
  job_search_urgency: z.enum(['rush', 'open']).optional()
});

/**
 * Get user profile
 */
export const getProfile = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    // Get user profile from database
    const { data: profile, error } = await executeQuery(async (client) =>
      client.from('user_profiles').select('*').eq('user_id', user.id).single()
    );

    if (error) {
      console.error('Error fetching profile:', error);
      return notFoundResponse('Profile not found');
    }

    return successResponse(profile, 'Profile retrieved successfully');

  } catch (error) {
    console.error('Get profile error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Update user profile
 */
export const updateProfile = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    
    // Validate input
    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`, 422);
    }

    const updates = validation.data;

    // Update profile in database
    const { data: updatedProfile, error } = await executeQuery(async (client) =>
      client.from('user_profiles')
        .upsert({
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
    );

    if (error) {
      console.error('Error updating profile:', error);
      return errorResponse('Failed to update profile', 500);
    }

    return successResponse(updatedProfile, 'Profile updated successfully');

  } catch (error) {
    console.error('Update profile error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Upload profile image
 */
export const uploadProfileImage = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    // Note: In a real implementation, you would handle file upload here
    // This could involve uploading to S3 or using Supabase Storage
    // For now, we'll return a placeholder response

    return errorResponse('File upload not implemented in this version. Use Supabase Storage directly from frontend for now.', 501);

  } catch (error) {
    console.error('Upload profile image error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Upload resume
 */
export const uploadResume = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    // Note: In a real implementation, you would handle file upload here
    // This could involve uploading to S3 or using Supabase Storage
    // For now, we'll return a placeholder response

    return errorResponse('File upload not implemented in this version. Use Supabase Storage directly from frontend for now.', 501);

  } catch (error) {
    console.error('Upload resume error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
}; 