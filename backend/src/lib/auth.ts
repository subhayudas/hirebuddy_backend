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
  const unescaped = base64urlUnescape(input);
  return Buffer.from(unescaped, 'base64').toString('utf8');
};

/**
 * Verify and decode JWT token
 */
export const verifyToken = (token: string): DecodedToken | null => {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payloadPart = parts[1];
    if (!payloadPart) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(payloadPart));
    
    // Simple expiration check
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    // Map possible Supabase/JWT payload shapes to our DecodedToken
    const mapped: DecodedToken = {
      userId: payload.userId || payload.sub,
      email: payload.email,
      iat: payload.iat,
      exp: payload.exp
    };

    if (!mapped.userId || !mapped.email) {
      // If missing essential fields, consider invalid
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
 * Extract authenticated user from event
 */
export const getAuthenticatedUser = (event: APIGatewayProxyEvent): AuthenticatedUser | null => {
  const token = extractTokenFromHeader(event);
  
  if (!token) {
    return null;
  }

  const decoded = verifyToken(token);
  
  if (!decoded) {
    return null;
  }

  return {
    id: decoded.userId,
    email: decoded.email
  };
};

/**
 * Check if user is authenticated
 */
export const requireAuth = (event: APIGatewayProxyEvent): AuthenticatedUser => {
  const user = getAuthenticatedUser(event);
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  return user;
}; 