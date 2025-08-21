import { APIGatewayProxyEvent, APIGatewayProxyResult } from '../types';
import { executeQuery } from '../lib/database';
import { successResponse, errorResponse, corsResponse, unauthorizedResponse } from '../lib/response';
import { requireAuth, getAuthenticatedUser } from '../lib/auth';
import { 
  checkRateLimit, 
  isAdmin, 
  validateAndSanitizePremiumUser, 
  getSecurityHeaders, 
  logSecurityEvent, 
  detectSuspiciousActivity 
} from '../lib/security';

// Premium User interface based on the migration document
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

/**
 * Main CRUD operations for premium users
 */
export const premiumUsersHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Premium users handler called with method:', event.httpMethod);
    console.log('Request headers:', JSON.stringify(event.headers, null, 2));

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Check for suspicious activity
    const suspiciousCheck = detectSuspiciousActivity(event);
    if (suspiciousCheck.suspicious) {
      logSecurityEvent('suspicious_activity_detected', {
        reason: suspiciousCheck.reason,
        path: event.path,
        method: event.httpMethod
      });
      return errorResponse('Access denied', 403);
    }

    // Try to get authenticated user with better error handling
    let user;
    try {
      user = requireAuth(event);
      console.log('User authenticated:', { id: user.id, email: user.email });
    } catch (authError) {
      console.error('Authentication failed:', authError);
      return unauthorizedResponse('Authentication required. Please log in again.');
    }

    // Check if user is admin for rate limiting
    const adminCheck = await executeQuery(async (client) => {
      const isAdminUser = await isAdmin(user.email, client);
      return { data: isAdminUser, error: null };
    });

    if (adminCheck.error) {
      console.error('Error checking admin status:', adminCheck.error);
      // Continue without admin check rather than failing
    }

    // Rate limiting with admin status
    const rateLimit = checkRateLimit(event, adminCheck.data || false);
    if (!rateLimit.allowed) {
      logSecurityEvent('rate_limit_exceeded', {
        userEmail: user.email,
        isAdmin: adminCheck.data
      });
      return errorResponse('Rate limit exceeded', 429);
    }

    switch (event.httpMethod) {
      case 'GET':
        return await handleGet(event, user);
      case 'POST':
        return await handlePost(event, user);
      case 'PUT':
        return await handlePut(event, user);
      case 'DELETE':
        return await handleDelete(event, user);
      default:
        return errorResponse('Method not allowed', 405);
    }

  } catch (error) {
    console.error('Premium users handler error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse('Authentication required. Please log in again.');
    }
    return errorResponse('Internal server error', 500);
  }
};

// GET - Check premium status or get user data
async function handleGet(event: APIGatewayProxyEvent, user: any): Promise<APIGatewayProxyResult> {
  try {
    console.log('Handling GET request for premium users');
    const queryParams = event.queryStringParameters || {};
    const { email, getAll } = queryParams;

    console.log('Query parameters:', { email, getAll });

    // Admin endpoint to get all premium users
    if (getAll === 'true') {
      console.log('Admin request to get all premium users');
      // Check if user is admin using security utility
      const adminCheck = await executeQuery(async (client) => {
        const isAdminUser = await isAdmin(user.email, client);
        return { data: isAdminUser, error: null };
      });

      if (!adminCheck.data) {
        console.log('Non-admin user attempted to access admin endpoint:', user.email);
        logSecurityEvent('unauthorized_admin_access_attempt', {
          userEmail: user.email,
          endpoint: '/premium/users?getAll=true'
        });
        return errorResponse('Admin access required', 403);
      }

      const { data, error } = await executeQuery(async (client) =>
        client.from('paid_users')
          .select('*')
          .order('created_at', { ascending: false })
      );

      if (error) {
        console.error('Error fetching all premium users:', error);
        return errorResponse('Failed to fetch premium users', 500);
      }

      console.log('Successfully fetched all premium users, count:', data?.length || 0);
      return successResponse(data || [], 'Premium users retrieved successfully');
    }

    // Get specific user data or check status
    const targetEmail = email || user.email;
    console.log('Fetching premium data for email:', targetEmail);
    
    const { data, error } = await executeQuery(async (client) =>
      client.from('paid_users')
        .select('*')
        .eq('email', targetEmail)
        .maybeSingle()
    );

    if (error) {
      console.error('Error fetching premium user:', error);
      return errorResponse('Failed to fetch premium user', 500);
    }

    console.log('Premium user found:', !!data);
    return successResponse({
      data: data || null,
      isPremium: !!data
    }, 'Premium status checked successfully');

  } catch (error) {
    console.error('Error in GET premium users:', error);
    return errorResponse('Internal server error', 500);
  }
}

// POST - Add new premium user
async function handlePost(event: APIGatewayProxyEvent, user: any): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const userData: Partial<PremiumUser> = JSON.parse(event.body);

    // Validate and sanitize input
    const validation = validateAndSanitizePremiumUser(userData);
    if (!validation.valid) {
      logSecurityEvent('invalid_premium_user_data', {
        userEmail: user.email,
        errors: validation.errors
      });
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    const sanitizedData = validation.sanitizedData;

    // Check if user already exists
    const { data: existingUser, error: checkError } = await executeQuery(async (client) =>
      client.from('paid_users')
        .select('id')
        .eq('email', sanitizedData.email)
        .single()
    );

    const checkErrorMessage = checkError && typeof checkError === 'object' && 'message' in checkError ? String((checkError as any).message) : '';
    if (checkError && !checkErrorMessage.includes('No rows returned')) {
      console.error('Error checking existing user:', checkError);
      return errorResponse('Failed to check existing user', 500);
    }

    if (existingUser) {
      return errorResponse('Premium user already exists', 409);
    }

    // Insert new premium user
    const { data, error } = await executeQuery(async (client) =>
      client.from('paid_users')
        .insert([sanitizedData])
        .select()
        .single()
    );

    if (error) {
      console.error('Error adding premium user:', error);
      return errorResponse('Failed to add premium user', 500);
    }

    return successResponse(data, 'Premium user added successfully', 201);

  } catch (error) {
    console.error('Error in POST premium users:', error);
    return errorResponse('Internal server error', 500);
  }
}

// PUT - Update premium user
async function handlePut(event: APIGatewayProxyEvent, user: any): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const { id, ...updates } = JSON.parse(event.body);

    if (!id || typeof id !== 'number' || id <= 0) {
      return errorResponse('Valid User ID is required', 400);
    }

    // Validate update data if provided
    if (Object.keys(updates).length > 0) {
      const validation = validateAndSanitizePremiumUser({ ...updates, email: 'temp@example.com', name: 'temp', order_id: 'temp', amount: 1 });
      if (!validation.valid) {
        logSecurityEvent('invalid_premium_user_update_data', {
          userEmail: user.email,
          targetUserId: id,
          errors: validation.errors
        });
        return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
      }
    }

    // Check if user exists
    const { data: existingUser } = await executeQuery(async (client) =>
      client.from('paid_users')
        .select('id, email')
        .eq('id', id)
        .single()
    );

    if (!existingUser) {
      return errorResponse('Premium user not found', 404);
    }

    // Check admin access or own user access
    const adminCheck = await executeQuery(async (client) => {
      const isAdminUser = await isAdmin(user.email, client);
      return { data: isAdminUser, error: null };
    });

    const existingUserEmail = existingUser && typeof existingUser === 'object' && 'email' in existingUser ? String((existingUser as any).email) : '';
    if (!adminCheck.data && existingUserEmail && existingUserEmail !== user.email) {
      logSecurityEvent('unauthorized_premium_user_update_attempt', {
        userEmail: user.email,
        targetUserId: id
      });
      return errorResponse('Access denied', 403);
    }

    // Update user
    const { data, error } = await executeQuery(async (client) =>
      client.from('paid_users')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    );

    if (error) {
      console.error('Error updating premium user:', error);
      return errorResponse('Failed to update premium user', 500);
    }

    return successResponse(data, 'Premium user updated successfully');

  } catch (error) {
    console.error('Error in PUT premium users:', error);
    return errorResponse('Internal server error', 500);
  }
}

// DELETE - Remove premium user
async function handleDelete(event: APIGatewayProxyEvent, user: any): Promise<APIGatewayProxyResult> {
  try {
    const queryParams = event.queryStringParameters || {};
    const { id } = queryParams;

    if (!id || isNaN(parseInt(id)) || parseInt(id) <= 0) {
      return errorResponse('Valid User ID is required', 400);
    }

    const userId = parseInt(id);

    // Check if user exists
    const { data: existingUser } = await executeQuery(async (client) =>
      client.from('paid_users')
        .select('id, email')
        .eq('id', id)
        .single()
    );

    if (!existingUser) {
      return errorResponse('Premium user not found', 404);
    }

    // Check admin access
    const adminCheck = await executeQuery(async (client) => {
      const isAdminUser = await isAdmin(user.email, client);
      return { data: isAdminUser, error: null };
    });

    if (!adminCheck.data) {
      logSecurityEvent('unauthorized_premium_user_deletion_attempt', {
        userEmail: user.email,
        targetUserId: userId
      });
      return errorResponse('Admin access required', 403);
    }

    // Delete user
    const { error } = await executeQuery(async (client) =>
      client.from('paid_users')
        .delete()
        .eq('id', userId)
    );

    if (error) {
      console.error('Error removing premium user:', error);
      return errorResponse('Failed to remove premium user', 500);
    }

    return successResponse({ message: 'Premium user removed successfully' }, 'Premium user removed successfully');

  } catch (error) {
    console.error('Error in DELETE premium users:', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * Quick premium status check endpoint
 */
export const checkPremiumStatus = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    if (event.httpMethod !== 'GET') {
      return errorResponse('Method not allowed', 405);
    }

    const queryParams = event.queryStringParameters || {};
    const { email } = queryParams;

    if (!email) {
      return errorResponse('Email parameter is required', 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse('Invalid email format', 400);
    }

    const { data, error } = await executeQuery(async (client) =>
      client.from('paid_users')
        .select('id')
        .eq('email', email)
        .maybeSingle()
    );

    if (error) {
      console.error('Error checking premium status:', error);
      return errorResponse('Failed to check premium status', 500);
    }

    return successResponse({ isPremium: !!data }, 'Premium status checked successfully');

  } catch (error) {
    console.error('Error in premium check API:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Get premium user data (existing endpoint for backward compatibility)
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
    const { data: premiumData, error } = await executeQuery(async (client) =>
      client.from('paid_users')
        .select('*')
        .eq('email', user.email)
        .single()
    );

    if (error) {
      // Check if it's a "no rows" error (which is expected for non-premium users)
      const errorMessage = error && typeof error === 'object' && 'message' in error ? String((error as any).message) : '';
      if (errorMessage.includes('No rows returned')) {
        return errorResponse('Premium subscription not found', 404);
      }
      console.error('Get premium data error:', error);
      return errorResponse('Failed to fetch premium data', 500);
    }

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

/**
 * Test endpoint to verify authentication and database connectivity
 */
export const testPremiumEndpoint = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Test premium endpoint called');
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    if (event.httpMethod !== 'GET') {
      return errorResponse('Method not allowed', 405);
    }

    // Try to get authenticated user
    let user;
    try {
      user = requireAuth(event);
      console.log('User authenticated in test endpoint:', { id: user.id, email: user.email });
    } catch (authError) {
      console.error('Authentication failed in test endpoint:', authError);
      return unauthorizedResponse('Authentication required. Please log in again.');
    }

    // Test database connection
    const { data, error } = await executeQuery(async (client) => {
      // Try to access the paid_users table
      const result = await client.from('paid_users').select('count').limit(1);
      return { data: result, error: null };
    });

    if (error) {
      console.error('Database test failed:', error);
      return errorResponse(`Database connection failed: ${error}`, 500);
    }

    return successResponse({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email
      },
      database: 'connected',
      timestamp: new Date().toISOString()
    }, 'Test endpoint working correctly');

  } catch (error) {
    console.error('Test endpoint error:', error);
    return errorResponse('Internal server error', 500);
  }
}; 

/**
 * Simple health check endpoint (no authentication required)
 */
export const premiumHealthCheck = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Premium health check endpoint called');
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    if (event.httpMethod !== 'GET') {
      return errorResponse('Method not allowed', 405);
    }

    // Test database connection without authentication
    const { data, error } = await executeQuery(async (client) => {
      // Try to access the paid_users table
      const result = await client.from('paid_users').select('count').limit(1);
      return { data: result, error: null };
    });

    if (error) {
      console.error('Database health check failed:', error);
      return errorResponse(`Database connection failed: ${error}`, 500);
    }

    return successResponse({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      endpoint: '/premium/health'
    }, 'Premium health check passed');

  } catch (error) {
    console.error('Premium health check error:', error);
    return errorResponse('Internal server error', 500);
  }
}; 