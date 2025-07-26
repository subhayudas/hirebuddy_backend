import { APIGatewayProxyEvent, APIGatewayProxyResult } from '../types';
import { getSupabaseClient, executeQuery } from '../lib/database';
import { successResponse, errorResponse, corsResponse, unauthorizedResponse } from '../lib/response';
import { generateToken, requireAuth } from '../lib/auth';
import { z } from 'zod';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().optional()
});

/**
 * User login endpoint
 */
export const login = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    
    // Validate input
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`, 422);
    }

    const { email, password } = validation.data;

    // Use Supabase Auth for authentication
    const supabase = getSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user) {
      return unauthorizedResponse('Invalid email or password');
    }

    // Get user profile
    const { data: profile } = await executeQuery(async (client) => 
      client.from('user_profiles').select('*').eq('user_id', authData.user.id).single()
    );

    // Generate custom JWT token for API access
    const token = generateToken({
      id: authData.user.id,
      email: authData.user.email!
    });

    return successResponse({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        ...authData.user.user_metadata
      },
      profile,
      token,
      session: authData.session
    }, 'Login successful');

  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * User signup endpoint
 */
export const signup = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    
    // Validate input
    const validation = signupSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`, 422);
    }

    const { email, password, fullName } = validation.data;

    // Use Supabase Auth for signup
    const supabase = getSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (authError) {
      return errorResponse(authError.message, 400);
    }

    if (!authData.user) {
      return errorResponse('Failed to create user', 400);
    }

    // Create initial user profile
    const { error: profileError } = await executeQuery(async (client) =>
      client.from('user_profiles').insert({
        user_id: authData.user!.id,
        full_name: fullName || null,
        onboarding_completed: false
      })
    );

    if (profileError) {
      console.error('Failed to create user profile:', profileError);
      // Continue anyway, profile can be created later
    }

    // Generate custom JWT token
    const token = generateToken({
      id: authData.user.id,
      email: authData.user.email!
    });

    return successResponse({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        ...authData.user.user_metadata
      },
      token,
      session: authData.session
    }, 'Signup successful');

  } catch (error) {
    console.error('Signup error:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Token refresh endpoint
 */
export const refresh = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    const { refreshToken } = body;

    if (!refreshToken) {
      return errorResponse('Refresh token is required', 400);
    }

    // Use Supabase Auth to refresh session
    const supabase = getSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (authError || !authData.user) {
      return unauthorizedResponse('Invalid refresh token');
    }

    // Generate new custom JWT token
    const token = generateToken({
      id: authData.user.id,
      email: authData.user.email!
    });

    return successResponse({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        ...authData.user.user_metadata
      },
      token,
      session: authData.session
    }, 'Token refreshed successfully');

  } catch (error) {
    console.error('Refresh error:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * User logout endpoint
 */
export const logout = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Get authenticated user (optional for logout)
    try {
      const user = requireAuth(event);
      console.log(`User ${user.email} logging out`);
    } catch {
      // Continue with logout even if token is invalid
    }

    // Note: With stateless JWT tokens, logout is mainly handled client-side
    // The client should remove the token from storage
    // For enhanced security, you could implement a token blacklist

    return successResponse({}, 'Logout successful');

  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse('Internal server error', 500);
  }
}; 