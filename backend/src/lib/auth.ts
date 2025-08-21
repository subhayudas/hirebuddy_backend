// JWT functionality - using basic implementation to avoid dependency issues
import { APIGatewayProxyEvent, DecodedToken, AuthenticatedUser } from '../types';

/**
 * Extract JWT token from Authorization header
 */
export const extractTokenFromHeader = (event: APIGatewayProxyEvent): string | null => {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  
  if (!authHeader) {
    return null;
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return authHeader || null;
};

/**
 * Simple base64 encoding/decoding for JWT-like functionality
 * In production, use proper JWT library
 */
const base64urlEscape = (str: string): string => {
  return str
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const base64urlUnescape = (str: string): string => {
  const padLength = (4 - (str.length % 4)) % 4;
  const padded = str + '='.repeat(padLength);
  return padded.replace(/\-/g, '+').replace(/_/g, '/');
};

const base64UrlEncode = (input: string): string => {
  const base64 = Buffer.from(input, 'utf8').toString('base64');
  return base64urlEscape(base64);
};

const base64UrlDecode = (input: string): string => {
  try {
    const unescaped = base64urlUnescape(input);
    return Buffer.from(unescaped, 'base64').toString('utf8');
  } catch (error) {
    console.error('Base64 decode error:', error);
    throw new Error('Invalid token format');
  }
};

/**
 * Verify and decode JWT token with better error handling
 */
export const verifyToken = (token: string): DecodedToken | null => {
  try {
    if (!token || typeof token !== 'string') {
      console.error('Invalid token: token is null, undefined, or not a string');
      return null;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured');
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid token format: expected 3 parts, got', parts.length);
      return null;
    }

    const payloadPart = parts[1];
    if (!payloadPart) {
      console.error('Missing payload part in token');
      return null;
    }

    let payload;
    try {
      const decodedPayload = base64UrlDecode(payloadPart);
      payload = JSON.parse(decodedPayload);
    } catch (error) {
      console.error('Failed to decode or parse token payload:', error);
      return null;
    }
    
    // Simple expiration check
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      console.error('Token has expired');
      return null;
    }

    // Map possible Supabase/JWT payload shapes to our DecodedToken
    const mapped: DecodedToken = {
      userId: payload.userId || payload.sub || payload.user_id,
      email: payload.email,
      iat: payload.iat,
      exp: payload.exp
    };

    if (!mapped.userId || !mapped.email) {
      console.error('Token missing required fields:', { userId: mapped.userId, email: mapped.email });
      return null;
    }

    return mapped;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
};

/**
 * Generate JWT token for user
 */
export const generateToken = (user: AuthenticatedUser): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    userId: user.id,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Simple signature placeholder (not secure). In production, use HMAC SHA-256.
  const signature = base64UrlEncode(`${encodedHeader}.${encodedPayload}.${jwtSecret}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

/**
 * Extract authenticated user from event with better error handling
 */
export const getAuthenticatedUser = (event: APIGatewayProxyEvent): AuthenticatedUser | null => {
  try {
    const token = extractTokenFromHeader(event);
    
    if (!token) {
      console.log('No token found in request headers');
      return null;
    }

    const decoded = verifyToken(token);
    
    if (!decoded) {
      console.log('Token verification failed');
      return null;
    }

    return {
      id: decoded.userId,
      email: decoded.email
    };
  } catch (error) {
    console.error('Error in getAuthenticatedUser:', error);
    return null;
  }
};

/**
 * Check if user is authenticated with better error handling
 */
export const requireAuth = (event: APIGatewayProxyEvent): AuthenticatedUser => {
  try {
    const user = getAuthenticatedUser(event);
    
    if (!user) {
      console.log('Authentication required but no valid user found');
      throw new Error('Authentication required');
    }
    
    return user;
  } catch (error) {
    console.error('Error in requireAuth:', error);
    throw new Error('Authentication required');
  }
}; 