import { APIGatewayProxyEvent, APIGatewayProxyResult } from '../types';
import { testDatabaseConnection } from '../lib/database';
import { successResponse, errorResponse, corsResponse } from '../lib/response';

/**
 * Health check for database connection
 */
export const dbHealth = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    const result = await testDatabaseConnection();
    if (!result.success) {
      return errorResponse(`Database not healthy: ${result.message}`, 500);
    }

    return successResponse({ ok: true }, result.message);
  } catch (error) {
    console.error('DB health error:', error);
    return errorResponse('Internal server error', 500);
  }
};




