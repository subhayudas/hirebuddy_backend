import { APIGatewayProxyEvent } from '../types';
import { 
  premiumUsersHandler, 
  checkPremiumStatus, 
  getPremiumData 
} from '../handlers/premium';
import { generateToken } from '../lib/auth';

// Mock data
const mockPremiumUser = {
  id: 1,
  created_at: '2024-01-15T10:30:00Z',
  email: 'test@example.com',
  name: 'Test User',
  phone: '+1234567890',
  zoom_id: 'test.user',
  designation: 'Software Engineer',
  order_id: 'order_123456',
  amount: 99.99
};

const mockAdminUser = {
  id: 'admin-123',
  email: 'admin@example.com'
};

const mockRegularUser = {
  id: 'user-123',
  email: 'user@example.com'
};

// Helper function to create mock events
const createMockEvent = (
  method: string,
  path: string,
  body?: any,
  queryParams?: Record<string, string>,
  headers?: Record<string, string>
): APIGatewayProxyEvent => {
  const token = generateToken(mockRegularUser);
  
  return {
    body: body ? JSON.stringify(body) : null,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...headers
    },
    httpMethod: method,
    path,
    pathParameters: null,
    queryStringParameters: queryParams || null,
    requestContext: {
      requestId: 'test-request-id',
      stage: 'dev',
      httpMethod: method,
      path
    },
    isBase64Encoded: false
  };
};

// Mock database functions
jest.mock('../lib/database', () => ({
  executeQuery: jest.fn()
}));

jest.mock('../lib/security', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 99, resetTime: Date.now() + 900000 }),
  isAdmin: jest.fn(),
  validateAndSanitizePremiumUser: jest.fn(),
  getSecurityHeaders: jest.fn().mockReturnValue({}),
  logSecurityEvent: jest.fn(),
  detectSuspiciousActivity: jest.fn().mockReturnValue({ suspicious: false })
}));

describe('Premium API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /premium/users', () => {
    it('should get current user premium data', async () => {
      const event = createMockEvent('GET', '/premium/users');
      
      // Mock database response
      const { executeQuery } = require('../lib/database');
      executeQuery.mockResolvedValue({
        data: mockPremiumUser,
        error: null
      });

      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.data).toEqual(mockPremiumUser);
      expect(body.data.isPremium).toBe(true);
    });

    it('should get specific user premium data', async () => {
      const event = createMockEvent('GET', '/premium/users', null, { email: 'specific@example.com' });
      
      const { executeQuery } = require('../lib/database');
      executeQuery.mockResolvedValue({
        data: mockPremiumUser,
        error: null
      });

      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.data).toEqual(mockPremiumUser);
    });

    it('should get all premium users for admin', async () => {
      const event = createMockEvent('GET', '/premium/users', null, { getAll: 'true' });
      
      const { executeQuery } = require('../lib/database');
      const { isAdmin } = require('../lib/security');
      
      isAdmin.mockResolvedValue(true);
      executeQuery
        .mockResolvedValueOnce({ data: true, error: null }) // Admin check
        .mockResolvedValueOnce({ data: [mockPremiumUser], error: null }); // Get all users

      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([mockPremiumUser]);
    });

    it('should deny admin access to non-admin users', async () => {
      const event = createMockEvent('GET', '/premium/users', null, { getAll: 'true' });
      
      const { executeQuery } = require('../lib/database');
      const { isAdmin } = require('../lib/security');
      
      isAdmin.mockResolvedValue(false);
      executeQuery.mockResolvedValue({ data: false, error: null });

      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Admin access required');
    });
  });

  describe('POST /premium/users', () => {
    it('should add new premium user', async () => {
      const newUserData = {
        email: 'newuser@example.com',
        name: 'New User',
        phone: '+1987654321',
        zoom_id: 'new.user',
        designation: 'Product Manager',
        order_id: 'order_789012',
        amount: 149.99
      };

      const event = createMockEvent('POST', '/premium/users', newUserData);
      
      const { executeQuery } = require('../lib/database');
      const { validateAndSanitizePremiumUser } = require('../lib/security');
      
      validateAndSanitizePremiumUser.mockReturnValue({
        valid: true,
        errors: [],
        sanitizedData: newUserData
      });

      executeQuery
        .mockResolvedValueOnce({ data: null, error: null }) // Check existing user
        .mockResolvedValueOnce({ data: { ...newUserData, id: 2, created_at: '2024-01-15T11:00:00Z' }, error: null }); // Insert user

      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe(newUserData.email);
    });

    it('should reject invalid user data', async () => {
      const invalidUserData = {
        email: 'invalid-email',
        name: '',
        amount: -100
      };

      const event = createMockEvent('POST', '/premium/users', invalidUserData);
      
      const { validateAndSanitizePremiumUser } = require('../lib/security');
      
      validateAndSanitizePremiumUser.mockReturnValue({
        valid: false,
        errors: ['Invalid email format', 'Name is required', 'Amount must be positive'],
        sanitizedData: null
      });

      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Validation failed');
    });

    it('should reject duplicate user', async () => {
      const existingUserData = {
        email: 'existing@example.com',
        name: 'Existing User',
        order_id: 'order_123',
        amount: 99.99
      };

      const event = createMockEvent('POST', '/premium/users', existingUserData);
      
      const { executeQuery } = require('../lib/database');
      const { validateAndSanitizePremiumUser } = require('../lib/security');
      
      validateAndSanitizePremiumUser.mockReturnValue({
        valid: true,
        errors: [],
        sanitizedData: existingUserData
      });

      executeQuery.mockResolvedValue({ data: { id: 1 }, error: null }); // User exists

      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Premium user already exists');
    });
  });

  describe('PUT /premium/users', () => {
    it('should update premium user data', async () => {
      const updateData = {
        id: 1,
        name: 'Updated Name',
        designation: 'Senior Engineer'
      };

      const event = createMockEvent('PUT', '/premium/users', updateData);
      
      const { executeQuery } = require('../lib/database');
      const { isAdmin } = require('../lib/security');
      
      isAdmin.mockResolvedValue(false);
      executeQuery
        .mockResolvedValueOnce({ data: { id: 1, email: 'user@example.com' }, error: null }) // Check existing user
        .mockResolvedValueOnce({ data: { ...mockPremiumUser, ...updateData }, error: null }); // Update user

      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Updated Name');
    });

    it('should allow admin to update any user', async () => {
      const updateData = {
        id: 999,
        name: 'Admin Updated Name'
      };

      const event = createMockEvent('PUT', '/premium/users', updateData);
      
      const { executeQuery } = require('../lib/database');
      const { isAdmin } = require('../lib/security');
      
      isAdmin.mockResolvedValue(true);
      executeQuery
        .mockResolvedValueOnce({ data: { id: 999, email: 'other@example.com' }, error: null }) // Check existing user
        .mockResolvedValueOnce({ data: { ...mockPremiumUser, ...updateData, id: 999 }, error: null }); // Update user

      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should deny unauthorized updates', async () => {
      const updateData = {
        id: 999,
        name: 'Unauthorized Update'
      };

      const event = createMockEvent('PUT', '/premium/users', updateData);
      
      const { executeQuery } = require('../lib/database');
      const { isAdmin } = require('../lib/security');
      
      isAdmin.mockResolvedValue(false);
      executeQuery.mockResolvedValue({ data: { id: 999, email: 'other@example.com' }, error: null }); // Different user

      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Access denied');
    });
  });

  describe('DELETE /premium/users', () => {
    it('should delete premium user for admin', async () => {
      const event = createMockEvent('DELETE', '/premium/users', null, { id: '1' });
      
      const { executeQuery } = require('../lib/database');
      const { isAdmin } = require('../lib/security');
      
      isAdmin.mockResolvedValue(true);
      executeQuery
        .mockResolvedValueOnce({ data: { id: 1, email: 'user@example.com' }, error: null }) // Check existing user
        .mockResolvedValueOnce({ data: null, error: null }); // Delete user

      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Premium user removed successfully');
    });

    it('should deny deletion for non-admin users', async () => {
      const event = createMockEvent('DELETE', '/premium/users', null, { id: '1' });
      
      const { executeQuery } = require('../lib/database');
      const { isAdmin } = require('../lib/security');
      
      isAdmin.mockResolvedValue(false);
      executeQuery.mockResolvedValue({ data: { id: 1, email: 'user@example.com' }, error: null });

      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Admin access required');
    });
  });

  describe('GET /premium/check', () => {
    it('should check premium status', async () => {
      const event = createMockEvent('GET', '/premium/check', null, { email: 'test@example.com' });
      
      const { executeQuery } = require('../lib/database');
      executeQuery.mockResolvedValue({
        data: { id: 1 },
        error: null
      });

      const response = await checkPremiumStatus(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.isPremium).toBe(true);
    });

    it('should return false for non-premium user', async () => {
      const event = createMockEvent('GET', '/premium/check', null, { email: 'nonpremium@example.com' });
      
      const { executeQuery } = require('../lib/database');
      executeQuery.mockResolvedValue({
        data: null,
        error: 'No rows returned'
      });

      const response = await checkPremiumStatus(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.isPremium).toBe(false);
    });

    it('should require email parameter', async () => {
      const event = createMockEvent('GET', '/premium/check');
      
      const response = await checkPremiumStatus(event);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Email parameter is required');
    });
  });

  describe('GET /premium/data (legacy)', () => {
    it('should get current user premium data', async () => {
      const event = createMockEvent('GET', '/premium/data');
      
      const { executeQuery } = require('../lib/database');
      executeQuery.mockResolvedValue({
        data: mockPremiumUser,
        error: null
      });

      const response = await getPremiumData(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockPremiumUser);
    });

    it('should return 404 for non-premium user', async () => {
      const event = createMockEvent('GET', '/premium/data');
      
      const { executeQuery } = require('../lib/database');
      executeQuery.mockResolvedValue({
        data: null,
        error: 'No rows returned'
      });

      const response = await getPremiumData(event);
      
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Premium subscription not found');
    });
  });

  describe('Security Tests', () => {
    it('should reject requests without authentication', async () => {
      const event = createMockEvent('GET', '/premium/users');
      event.headers = {}; // Remove Authorization header
      
      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(401);
    });

    it('should handle rate limiting', async () => {
      const { checkRateLimit } = require('../lib/security');
      checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 900000 });

      const event = createMockEvent('GET', '/premium/users');
      
      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Rate limit exceeded');
    });

    it('should detect suspicious activity', async () => {
      const { detectSuspiciousActivity } = require('../lib/security');
      detectSuspiciousActivity.mockReturnValue({ suspicious: true, reason: 'Bot-like User-Agent detected' });

      const event = createMockEvent('GET', '/premium/users');
      
      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Access denied');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const event = createMockEvent('GET', '/premium/users');
      
      const { executeQuery } = require('../lib/database');
      executeQuery.mockResolvedValue({
        data: null,
        error: 'Database connection failed'
      });

      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Internal server error');
    });

    it('should handle invalid JSON in request body', async () => {
      const event = createMockEvent('POST', '/premium/users', 'invalid json');
      event.body = 'invalid json';
      
      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should handle missing request body for POST', async () => {
      const event = createMockEvent('POST', '/premium/users');
      event.body = null;
      
      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Request body is required');
    });
  });
});
