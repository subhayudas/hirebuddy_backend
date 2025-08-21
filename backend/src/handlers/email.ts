import { APIGatewayProxyEvent, APIGatewayProxyResult, EmailCountRecord, EmailUsageResponse, EmailIncrementRequest, EmailIncrementResponse } from '../types';
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
    const { data: emailCounts, error } = await executeQuery<EmailCountRecord[]>(async (client) =>
      client.from('totalemailcounttable')
        .select('*')
        .eq('user_id', user.email)
    );

    if (error) {
      console.error('Database error in getEmailUsage:', error);
      return errorResponse('Failed to retrieve email usage', 500);
    }

    // Check if user has an email count record
    const emailCount = emailCounts && emailCounts.length > 0 ? emailCounts[0] : null;

    if (!emailCount) {
      // Create initial record if doesn't exist
      const { data: newRecord, error: insertError } = await executeQuery<EmailCountRecord>(async (client) =>
        client.from('totalemailcounttable')
          .insert({
            user_id: user.email,
            total_count: 0,
            email_limit: 125
          })
          .select()
          .single()
      );

      if (insertError) {
        console.error('Failed to create initial email record:', insertError);
        return errorResponse('Failed to initialize email usage', 500);
      }

      const usage: EmailUsageResponse = {
        used: 0,
        limit: 125,
        remaining: 125,
        percentage: 0,
        canSendEmail: true
      };

      return successResponse(usage, 'Email usage retrieved successfully');
    }

    const used = emailCount.total_count || 0;
    const limit = emailCount.email_limit || 125;
    const remaining = Math.max(0, limit - used);
    const percentage = (used / limit) * 100;
    const canSendEmail = remaining > 0;

    const usage: EmailUsageResponse = {
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
    const { data: currentCounts, error: selectError } = await executeQuery<EmailCountRecord[]>(async (client) =>
      client.from('totalemailcounttable')
        .select('*')
        .eq('user_id', user.email)
    );

    if (selectError) {
      console.error('Database error in incrementEmailCount:', selectError);
      return errorResponse('Failed to retrieve current email count', 500);
    }

    // Check if user has an email count record
    const currentCount = currentCounts && currentCounts.length > 0 ? currentCounts[0] : null;

    let previousCount = 0;
    let newCount = count;
    let limit = 125;

    if (!currentCount) {
      // Create initial record
      const { data: newRecord, error: insertError } = await executeQuery<EmailCountRecord>(async (client) =>
        client.from('totalemailcounttable')
          .insert({
            user_id: user.email,
            total_count: count,
            email_limit: 125
          })
          .select()
          .single()
      );

      if (insertError) {
        console.error('Failed to create initial email record:', insertError);
        return errorResponse('Failed to initialize email count', 500);
      }

      const response: EmailIncrementResponse = {
        previousCount: 0,
        newCount: count,
        limit: 125,
        remaining: Math.max(0, 125 - count),
        canSendEmail: (125 - count) > 0
      };

      return successResponse(response, 'Email count initialized and incremented');
    }

    // Update count
    previousCount = currentCount.total_count || 0;
    newCount = previousCount + count;
    limit = currentCount.email_limit || 125;

    const { data: updatedRecord, error: updateError } = await executeQuery<EmailCountRecord>(async (client) =>
      client.from('totalemailcounttable')
        .update({ total_count: newCount })
        .eq('user_id', user.email)
        .select()
        .single()
    );

    if (updateError) {
      console.error('Failed to update email count:', updateError);
      return errorResponse('Failed to increment email count', 500);
    }

    const remaining = Math.max(0, limit - newCount);
    const canSendEmail = remaining > 0;

    const response: EmailIncrementResponse = {
      previousCount,
      newCount,
      limit,
      remaining,
      canSendEmail
    };

    return successResponse(response, 'Email count incremented successfully');

  } catch (error) {
    console.error('Increment email count error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
}; 