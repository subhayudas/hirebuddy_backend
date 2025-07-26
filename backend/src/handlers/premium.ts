import { APIGatewayProxyEvent, APIGatewayProxyResult } from '../types';
import { executeQuery } from '../lib/database';
import { successResponse, errorResponse, corsResponse, unauthorizedResponse } from '../lib/response';
import { requireAuth } from '../lib/auth';

/**
 * Check premium status
 */
export const checkPremiumStatus = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    // Check if user exists in paid_users table
    const { data: premiumUser } = await executeQuery(async (client) =>
      client.from('paid_users')
        .select('*')
        .eq('email', user.email)
        .single()
    );

    const isPremium = !!premiumUser;

    return successResponse({ isPremium }, 'Premium status checked successfully');

  } catch (error) {
    console.error('Check premium status error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Get premium user data
 */
export const getPremiumData = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    // Get premium user data
    const { data: premiumData } = await executeQuery(async (client) =>
      client.from('paid_users')
        .select('*')
        .eq('email', user.email)
        .single()
    );

    if (!premiumData) {
      return errorResponse('Premium subscription not found', 404);
    }

    return successResponse(premiumData, 'Premium data retrieved successfully');

  } catch (error) {
    console.error('Get premium data error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
}; 