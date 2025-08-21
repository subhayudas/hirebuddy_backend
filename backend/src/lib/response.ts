import { APIGatewayProxyResult, ApiResponse } from '../types';
import { getSecurityHeaders } from './security';

/**
 * Get CORS headers
 */
const getCorsHeaders = () => ({
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'
});

/**
 * Create a successful API response
 */
export const successResponse = <T>(data: T, message?: string, statusCode: number = 200): APIGatewayProxyResult => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(message && { message })
  };

  return {
    statusCode,
    headers: {
      ...getCorsHeaders(),
      'Content-Type': 'application/json',
      ...getSecurityHeaders()
    },
    body: JSON.stringify(response)
  };
};

/**
 * Create an error API response
 */
export const errorResponse = (error: string, statusCode: number = 400): APIGatewayProxyResult => {
  const response: ApiResponse = {
    success: false,
    error
  };

  return {
    statusCode,
    headers: {
      ...getCorsHeaders(),
      'Content-Type': 'application/json',
      ...getSecurityHeaders()
    },
    body: JSON.stringify(response)
  };
};

/**
 * Create a validation error response
 */
export const validationErrorResponse = (errors: string[]): APIGatewayProxyResult => {
  return errorResponse(`Validation failed: ${errors.join(', ')}`, 422);
};

/**
 * Create an unauthorized response
 */
export const unauthorizedResponse = (message: string = 'Unauthorized'): APIGatewayProxyResult => {
  const response: ApiResponse = {
    success: false,
    error: message
  };

  return {
    statusCode: 401,
    headers: {
      ...getCorsHeaders(),
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer',
      ...getSecurityHeaders()
    },
    body: JSON.stringify(response)
  };
};

/**
 * Create a not found response
 */
export const notFoundResponse = (message: string = 'Resource not found'): APIGatewayProxyResult => {
  return errorResponse(message, 404);
};

/**
 * Create an internal server error response
 */
export const internalErrorResponse = (message: string = 'Internal server error'): APIGatewayProxyResult => {
  return errorResponse(message, 500);
};

/**
 * Handle CORS preflight requests
 */
export const corsResponse = (): APIGatewayProxyResult => {
  return {
    statusCode: 200,
    headers: {
      ...getCorsHeaders(),
      'Content-Type': 'text/plain'
    },
    body: ''
  };
}; 