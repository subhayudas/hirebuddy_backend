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
      // Return response indicating no record exists - no auto-creation
      const usage: EmailUsageResponse = {
        used: 0,
        limit: 0,
        remaining: 0,
        percentage: 0,
        canSendEmail: false
      };

      return successResponse(usage, 'No email usage record found. Please contact support for initialization.');
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

    if (!currentCount) {
      // Return error - no auto-creation allowed
      return errorResponse('No email usage record found. Please contact support for initialization.', 404);
    }

    // Update count
    const previousCount = currentCount.total_count || 0;
    const newCount = previousCount + count;
    const limit = currentCount.email_limit || 125;

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

/**
 * Initialize email record for a user (Admin/Server-side only)
 * This function should only be called from server-side operations, not from client requests
 */
export const initializeEmailRecord = async (userId: string, emailLimit: number = 125): Promise<{ success: boolean; data?: EmailCountRecord; error?: string }> => {
  try {
    // Check if record already exists
    const { data: existingRecords, error: selectError } = await executeQuery<EmailCountRecord[]>(async (client) =>
      client.from('totalemailcounttable')
        .select('*')
        .eq('user_id', userId)
    );

    if (selectError) {
      console.error('Database error checking existing email record:', selectError);
      return { success: false, error: 'Failed to check existing email record' };
    }

    // If record already exists, return it
    if (existingRecords && existingRecords.length > 0 && existingRecords[0]) {
      return { success: true, data: existingRecords[0] };
    }

    // Create new record
    const { data: newRecord, error: insertError } = await executeQuery<EmailCountRecord>(async (client) =>
      client.from('totalemailcounttable')
        .insert({
          user_id: userId,
          total_count: 0,
          email_limit: emailLimit
        })
        .select()
        .single()
    );

    if (insertError) {
      console.error('Failed to create email record:', insertError);
      return { success: false, error: 'Failed to create email record' };
    }

    if (!newRecord) {
      return { success: false, error: 'Failed to create email record - no data returned' };
    }

    return { success: true, data: newRecord };
  } catch (error) {
    console.error('Initialize email record error:', error);
    return { success: false, error: 'Internal server error' };
  }
};

/**
 * Update email limit for a user (Admin/Server-side only)
 */
export const updateEmailLimit = async (userId: string, newLimit: number): Promise<{ success: boolean; data?: EmailCountRecord; error?: string }> => {
  try {
    const { data: updatedRecord, error: updateError } = await executeQuery<EmailCountRecord>(async (client) =>
      client.from('totalemailcounttable')
        .update({ email_limit: newLimit })
        .eq('user_id', userId)
        .select()
        .single()
    );

    if (updateError) {
      console.error('Failed to update email limit:', updateError);
      return { success: false, error: 'Failed to update email limit' };
    }

    if (!updatedRecord) {
      return { success: false, error: 'Failed to update email limit - no data returned' };
    }

    return { success: true, data: updatedRecord };
  } catch (error) {
    console.error('Update email limit error:', error);
    return { success: false, error: 'Internal server error' };
  }
}; 