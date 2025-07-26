import { APIGatewayProxyEvent, APIGatewayProxyResult } from '../types';
import { executeQuery } from '../lib/database';
import { successResponse, errorResponse, corsResponse, unauthorizedResponse } from '../lib/response';
import { requireAuth } from '../lib/auth';

/**
 * Get dashboard statistics
 */
export const getDashboardStats = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    // Get user applications count
    const { data: applications } = await executeQuery(async (client) =>
      client.from('hirebuddy_job_applications')
        .select('*')
        .eq('user_id', user.id)
    );

    // Calculate basic stats
    const stats = {
      totalApplications: applications?.length || 0,
      interviewInvites: 0, // Could be calculated based on status
      profileViews: Math.floor(Math.random() * 100) + 50, // Placeholder
      weeklyApplications: 0, // Could be filtered by date
      weeklyGoal: 15,
      applicationsByStatus: {
        applied: 0,
        screening: 0,
        interview_scheduled: 0,
        interviewed: 0,
        technical_assessment: 0,
        final_round: 0,
        offer_received: 0,
        accepted: 0,
        rejected: 0,
        withdrawn: 0,
      },
      weeklyTrend: [0, 1, 2, 1, 3, 2, 1], // Placeholder data
    };

    return successResponse(stats, 'Dashboard stats retrieved successfully');

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Get recent activity
 */
export const getRecentActivity = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    // Get recent applications as activity
    const { data: recentApplications } = await executeQuery(async (client) =>
      client.from('hirebuddy_job_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
    );

    // Transform to activity format
    const activities = (recentApplications || []).map((app: any) => ({
      id: app.id,
      type: 'application',
      title: `Applied to ${app.job_title}`,
      description: `at ${app.company_name}`,
      timestamp: app.created_at,
      status: app.status,
    }));

    return successResponse(activities, 'Recent activity retrieved successfully');

  } catch (error) {
    console.error('Get recent activity error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
}; 