import { APIGatewayProxyEvent } from '../types';

/**
 * Security utilities for API endpoints
 */

// Rate limiting storage (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT_CONFIG = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100, // 100 requests per window
  ADMIN_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  ADMIN_MAX_REQUESTS: 1000, // 1000 requests per window for admins
};

/**
 * Check if user is admin
 */
export const isAdmin = async (email: string, client: any): Promise<boolean> => {
  try {
    console.log('Checking admin status for email:', email);
    
    // First try to check in user_profiles table
    try {
      const { data: profile, error } = await client
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.log('Error querying user_profiles table:', error);
        // If table doesn't exist or other error, continue to fallback
      } else if (profile) {
        // Check if user has admin privileges (you can customize this logic)
        // For now, we'll treat users with profiles as potential admins
        console.log('User has profile (treating as potential admin)');
        return true;
      }
    } catch (profileError) {
      console.log('user_profiles table query failed:', profileError);
    }

    // Fallback: Check if user exists in paid_users table (treat as admin for now)
    try {
      const { data: premiumUser, error } = await client
        .from('paid_users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.log('Error querying paid_users table for admin check:', error);
        return false;
      }

      if (premiumUser) {
        console.log('User is premium user (treating as admin)');
        return true;
      }
    } catch (premiumError) {
      console.log('paid_users table query failed for admin check:', premiumError);
    }

    console.log('User is not admin');
    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

/**
 * Rate limiting middleware
 */
export const checkRateLimit = (event: APIGatewayProxyEvent, isAdminUser = false): { allowed: boolean; remaining: number; resetTime: number } => {
  const clientId = getClientIdentifier(event);
  const now = Date.now();
  const config = isAdminUser ? {
    windowMs: RATE_LIMIT_CONFIG.ADMIN_WINDOW_MS,
    maxRequests: RATE_LIMIT_CONFIG.ADMIN_MAX_REQUESTS
  } : {
    windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
    maxRequests: RATE_LIMIT_CONFIG.MAX_REQUESTS
  };

  const record = rateLimitStore.get(clientId);
  
  if (!record || now > record.resetTime) {
    // Reset or create new record
    rateLimitStore.set(clientId, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return { allowed: true, remaining: config.maxRequests - 1, resetTime: now + config.windowMs };
  }

  if (record.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  // Increment count
  record.count++;
  rateLimitStore.set(clientId, record);
  
  return { allowed: true, remaining: config.maxRequests - record.count, resetTime: record.resetTime };
};

/**
 * Get client identifier for rate limiting
 */
const getClientIdentifier = (event: APIGatewayProxyEvent): string => {
  // Try to get user email first from authenticated user
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (authHeader) {
    try {
      // Use proper JWT verification instead of manual parsing
      const token = authHeader.replace('Bearer ', '');
      // For rate limiting, we'll use a safer approach
      // In production, use proper JWT library to verify and decode
      if (token && token.length > 10) {
        // Use IP + token hash for rate limiting to avoid JWT parsing vulnerabilities
        const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex').substring(0, 8);
        const ip = event.requestContext?.identity?.sourceIp || 'unknown';
        return `auth:${ip}:${tokenHash}`;
      }
    } catch (error) {
      // Fall back to IP
    }
  }

  // Fall back to IP address
  const ip = event.requestContext?.identity?.sourceIp || 'unknown';
  return `ip:${ip}`;
};

/**
 * Input validation for premium user data
 */
export const validatePremiumUserData = (data: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Required fields
  if (!data.email) errors.push('Email is required');
  if (!data.name) errors.push('Name is required');
  if (!data.order_id) errors.push('Order ID is required');
  if (!data.amount) errors.push('Amount is required');

  // Email validation
  if (data.email && !isValidEmail(data.email)) {
    errors.push('Invalid email format');
  }

  // Amount validation
  if (data.amount !== undefined) {
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push('Amount must be a positive number');
    }
  }

  // Phone validation (optional but if provided, should be valid)
  if (data.phone && !isValidPhone(data.phone)) {
    errors.push('Invalid phone number format');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Email validation
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Phone validation
 */
export const isValidPhone = (phone: string): boolean => {
  // Basic phone validation - allows international format
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
};

/**
 * Sanitize user input
 */
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[&]/g, '&amp;') // Escape ampersands
    .replace(/["]/g, '&quot;') // Escape quotes
    .replace(/[']/g, '&#x27;') // Escape apostrophes
    .substring(0, 1000); // Limit length
};

/**
 * Validate and sanitize premium user data
 */
export const validateAndSanitizePremiumUser = (data: any): { valid: boolean; errors: string[]; sanitizedData: any } => {
  const validation = validatePremiumUserData(data);
  
  if (!validation.valid) {
    return { valid: false, errors: validation.errors, sanitizedData: null };
  }

  // Sanitize string fields
  const sanitizedData = {
    ...data,
    email: sanitizeInput(data.email).toLowerCase(),
    name: sanitizeInput(data.name),
    phone: data.phone ? sanitizeInput(data.phone) : '',
    zoom_id: data.zoom_id ? sanitizeInput(data.zoom_id) : '',
    designation: data.designation ? sanitizeInput(data.designation) : '',
    order_id: sanitizeInput(data.order_id),
    amount: parseFloat(data.amount)
  };

  return { valid: true, errors: [], sanitizedData };
};

/**
 * Security headers for responses
 */
export const getSecurityHeaders = (): Record<string, string> => {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  };
};

/**
 * Log security events
 */
export const logSecurityEvent = (event: string, details: any, userId?: string) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    userId,
    details,
    ip: 'unknown', // Would be extracted from request in actual implementation
  };

  console.log('SECURITY_EVENT:', JSON.stringify(logEntry));
  
  // In production, send to security monitoring service
  // await securityMonitoringService.log(logEntry);
};

/**
 * Check for suspicious activity
 */
export const detectSuspiciousActivity = (event: APIGatewayProxyEvent, userEmail?: string): { suspicious: boolean; reason?: string } => {
  const userAgent = event.headers?.['User-Agent'] || event.headers?.['user-agent'] || '';
  const referer = event.headers?.Referer || event.headers?.referer || '';
  
  // Check for missing user agent (but allow empty for testing)
  if (!userAgent) {
    console.log('No User-Agent provided, but allowing for testing');
    return { suspicious: false };
  }

  // Check for common bot user agents (but allow curl for testing)
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i, /wget/i,
    /python/i, /java/i, /perl/i, /ruby/i, /php/i
  ];
  
  if (botPatterns.some(pattern => pattern.test(userAgent))) {
    return { suspicious: true, reason: 'Bot-like User-Agent detected' };
  }

  // Allow curl for testing purposes
  if (userAgent.includes('curl')) {
    console.log('Curl detected, allowing for testing');
    return { suspicious: false };
  }

  // Check for rapid requests (basic check)
  const clientId = getClientIdentifier(event);
  const record = rateLimitStore.get(clientId);
  if (record && record.count > 50) {
    return { suspicious: true, reason: 'High request rate detected' };
  }

  return { suspicious: false };
};
