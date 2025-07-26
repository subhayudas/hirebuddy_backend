import { APIGatewayProxyResult, ApiResponse } from '../types';

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
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Content-Type': 'application/json'
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
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Content-Type': 'application/json'
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
  return errorResponse(message, 401);
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
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: ''
  };
}; 