import { APIGatewayProxyEvent, APIGatewayProxyResult, UserProfile } from '../types';
import { executeQuery } from '../lib/database';
import { successResponse, errorResponse, corsResponse, unauthorizedResponse } from '../lib/response';
import { requireAuth } from '../lib/auth';
import { z } from 'zod';

// Validation schemas
const createApplicationSchema = z.object({
  job_id: z.string().min(1, 'Job ID is required'),
  job_title: z.string().min(1, 'Job title is required'),
  company_name: z.string().min(1, 'Company name is required'),
  job_type: z.enum(['exclusive', 'regular']).optional().default('regular'),
  // Profile data will be copied from user's profile
});

const updateApplicationStatusSchema = z.object({
  status: z.enum(['pending', 'reviewed', 'shortlisted', 'rejected', 'hired']),
  admin_notes: z.string().optional(),
  reviewed_by: z.string().optional()
});

/**
 * Create a new job application
 */
export const createApplication = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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
    const validation = createApplicationSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`, 422);
    }

    const { job_id, job_title, company_name, job_type } = validation.data;

    // Check if user already applied to this job
    const { data: existingApplication } = await executeQuery(async (client) =>
      client.from('hirebuddy_job_applications')
        .select('id')
        .eq('user_id', user.id)
        .eq('job_id', job_id)
        .single()
    );

    if (existingApplication) {
      return errorResponse('You have already applied to this job', 409);
    }

    // Get user profile to copy data
    const { data: userProfile } = await executeQuery(async (client) =>
      client.from('user_profiles').select('*').eq('user_id', user.id).single()
    );

    const profile = userProfile as UserProfile | null;

    // Create application with user profile data
    const applicationData = {
      user_id: user.id,
      user_email: user.email,
      job_id,
      job_title,
      company_name,
      job_type,
      status: 'pending',
      
      // Copy user profile data
      full_name: profile?.full_name || null,
      title: profile?.title || null,
      company: profile?.company || null,
      location: profile?.location || null,
      phone: profile?.phone || null,
      bio: profile?.bio || null,
      website: profile?.website || null,
      github: profile?.github || null,
      linkedin: profile?.linkedin || null,
      college: profile?.college || null,
      skills: profile?.skills || null,
      experience_years: profile?.experience_years || 0,
      available_for_work: profile?.available_for_work || false,
      resume_url: profile?.resume_url || null,
      resume_filename: profile?.resume_filename || null,
    };

    const { data: application, error } = await executeQuery(async (client) =>
      client.from('hirebuddy_job_applications')
        .insert(applicationData)
        .select()
        .single()
    );

    if (error) {
      console.error('Error creating application:', error);
      return errorResponse('Failed to create application', 500);
    }

    return successResponse(application, 'Application created successfully', 201);

  } catch (error) {
    console.error('Create application error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Get user's job applications
 */
export const getUserApplications = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    // Get user's applications
    const { data: applications, error } = await executeQuery(async (client) =>
      client.from('hirebuddy_job_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
    );

    if (error) {
      console.error('Error fetching user applications:', error);
      return errorResponse('Failed to fetch applications', 500);
    }

    return successResponse(applications || [], 'Applications retrieved successfully');

  } catch (error) {
    console.error('Get user applications error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Update application status (Admin only)
 */
export const updateApplicationStatus = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    const applicationId = event.pathParameters?.id;
    if (!applicationId) {
      return errorResponse('Application ID is required', 400);
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    
    // Validate input
    const validation = updateApplicationStatusSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`, 422);
    }

    const { status, admin_notes, reviewed_by } = validation.data;

    // Note: In a real implementation, you would check if user is admin
    // For now, we'll allow any authenticated user to update status

    const updateData = {
      status,
      reviewed_at: new Date().toISOString(),
      ...(admin_notes && { admin_notes }),
      ...(reviewed_by && { reviewed_by })
    };

    const { data: updatedApplication, error } = await executeQuery(async (client) =>
      client.from('hirebuddy_job_applications')
        .update(updateData)
        .eq('id', applicationId)
        .select()
        .single()
    );

    if (error) {
      console.error('Error updating application status:', error);
      return errorResponse('Failed to update application status', 500);
    }

    return successResponse(updatedApplication, 'Application status updated successfully');

  } catch (error) {
    console.error('Update application status error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
}; 