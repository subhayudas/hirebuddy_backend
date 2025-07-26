import { APIGatewayProxyEvent, APIGatewayProxyResult } from '../types';
import { executeQuery } from '../lib/database';
import { successResponse, errorResponse, corsResponse, unauthorizedResponse } from '../lib/response';
import { requireAuth } from '../lib/auth';
import { z } from 'zod';

// Validation schemas
const incrementEmailSchema = z.object({
  count: z.number().min(1).optional().default(1)
});

/**
 * Get email usage statistics
 */
export const getEmailUsage = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    // Get email count record
    const { data: emailCount } = await executeQuery(async (client) =>
      client.from('totalemailcounttable')
        .select('*')
        .eq('user_id', user.id)
        .single()
    );

    if (!emailCount) {
      // Create initial record if doesn't exist
      const { data: newRecord } = await executeQuery(async (client) =>
        client.from('totalemailcounttable')
          .insert({
            user_id: user.id,
            total_count: 0,
            email_limit: 125
          })
          .select()
          .single()
      );

      const usage = {
        used: 0,
        limit: 125,
        remaining: 125,
        percentage: 0,
        canSendEmail: true
      };

      return successResponse(usage, 'Email usage retrieved successfully');
    }

    const emailRecord = emailCount as any;
    const used = emailRecord?.total_count || 0;
    const limit = emailRecord?.email_limit || 125;
    const remaining = Math.max(0, limit - used);
    const percentage = (used / limit) * 100;
    const canSendEmail = remaining > 0;

    const usage = {
      used,
      limit,
      remaining,
      percentage,
      canSendEmail
    };

    return successResponse(usage, 'Email usage retrieved successfully');

  } catch (error) {
    console.error('Get email usage error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Increment email count
 */
export const incrementEmailCount = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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
    const validation = incrementEmailSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`, 422);
    }

    const { count } = validation.data;

    // Get current email count
    const { data: currentCount } = await executeQuery(async (client) =>
      client.from('totalemailcounttable')
        .select('*')
        .eq('user_id', user.id)
        .single()
    );

    if (!currentCount) {
      // Create initial record
      const { data: newRecord } = await executeQuery(async (client) =>
        client.from('totalemailcounttable')
          .insert({
            user_id: user.id,
            total_count: count,
            email_limit: 125
          })
          .select()
          .single()
      );

      return successResponse(newRecord, 'Email count initialized and incremented');
    }

    // Update count
    const currentRecord = currentCount as any;
    const newCount = (currentRecord?.total_count || 0) + count;
    const { data: updatedRecord } = await executeQuery(async (client) =>
      client.from('totalemailcounttable')
        .update({ total_count: newCount })
        .eq('user_id', user.id)
        .select()
        .single()
    );

    return successResponse(updatedRecord, 'Email count incremented successfully');

  } catch (error) {
    console.error('Increment email count error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
}; 