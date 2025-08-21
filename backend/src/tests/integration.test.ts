import { APIGatewayProxyEvent } from '../types';
import { 
  premiumUsersHandler, 
  checkPremiumStatus, 
  getPremiumData 
} from '../handlers/premium';
import { PremiumApiService } from '../lib/premiumApiService';
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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

describe('Premium API Integration Tests', () => {
  let premiumService: PremiumApiService;

  beforeEach(() => {
    jest.clearAllMocks();
    premiumService = new PremiumApiService('http://localhost:3001/dev');
    premiumService.setAuthToken('test-token');
  });

  describe('Complete Flow Tests', () => {
    it('should handle complete premium user lifecycle', async () => {
      const { executeQuery } = require('../lib/database');
      const { validateAndSanitizePremiumUser } = require('../lib/security');

      // Mock validation
      validateAndSanitizePremiumUser.mockReturnValue({
        valid: true,
        errors: [],
        sanitizedData: mockPremiumUser
      });

      // Mock database responses
      executeQuery
        .mockResolvedValueOnce({ data: false, error: null }) // Admin check
        .mockResolvedValueOnce({ data: null, error: null }) // Check existing user
        .mockResolvedValueOnce({ data: mockPremiumUser, error: null }) // Insert user
        .mockResolvedValueOnce({ data: mockPremiumUser, error: null }) // Get user data
        .mockResolvedValueOnce({ data: false, error: null }) // Admin check for update
        .mockResolvedValueOnce({ data: { id: 1, email: 'test@example.com' }, error: null }) // Check existing for update
        .mockResolvedValueOnce({ data: { ...mockPremiumUser, name: 'Updated Name' }, error: null }) // Update user
        .mockResolvedValueOnce({ data: true, error: null }) // Admin check for delete
        .mockResolvedValueOnce({ data: { id: 1, email: 'test@example.com' }, error: null }) // Check existing for delete
        .mockResolvedValueOnce({ data: null, error: null }); // Delete user

      // 1. Add premium user
      const addEvent = createMockEvent('POST', '/premium/users', mockPremiumUser);
      const addResponse = await premiumUsersHandler(addEvent);
      
      expect(addResponse.statusCode).toBe(201);
      const addBody = JSON.parse(addResponse.body);
      expect(addBody.success).toBe(true);
      expect(addBody.data.email).toBe(mockPremiumUser.email);

      // 2. Get premium user data
      const getEvent = createMockEvent('GET', '/premium/users', null, { email: 'test@example.com' });
      const getResponse = await premiumUsersHandler(getEvent);
      
      expect(getResponse.statusCode).toBe(200);
      const getBody = JSON.parse(getResponse.body);
      expect(getBody.success).toBe(true);
      expect(getBody.data.data.email).toBe(mockPremiumUser.email);

      // 3. Update premium user
      const updateEvent = createMockEvent('PUT', '/premium/users', { id: 1, name: 'Updated Name' });
      const updateResponse = await premiumUsersHandler(updateEvent);
      
      expect(updateResponse.statusCode).toBe(200);
      const updateBody = JSON.parse(updateResponse.body);
      expect(updateBody.success).toBe(true);
      expect(updateBody.data.name).toBe('Updated Name');

      // 4. Delete premium user (admin only)
      const deleteEvent = createMockEvent('DELETE', '/premium/users', null, { id: '1' });
      const deleteResponse = await premiumUsersHandler(deleteEvent);
      
      expect(deleteResponse.statusCode).toBe(200);
      const deleteBody = JSON.parse(deleteResponse.body);
      expect(deleteBody.success).toBe(true);
    });

    it('should handle frontend API service integration', async () => {
      // Mock fetch for frontend service
      global.fetch = jest.fn();

      // Mock successful responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { isPremium: true } })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { data: mockPremiumUser, isPremium: true } })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({ success: true, data: mockPremiumUser })
        });

      // Test frontend service methods
      const isPremium = await premiumService.isPremiumUser('test@example.com');
      expect(isPremium).toBe(true);

      const premiumData = await premiumService.getPremiumUserData('test@example.com');
      expect(premiumData).toEqual(mockPremiumUser);

      const newUser = await premiumService.addPremiumUser({
        email: 'newuser@example.com',
        name: 'New User',
        phone: '+1987654321',
        zoom_id: 'new.user',
        designation: 'Product Manager',
        order_id: 'order_789012',
        amount: 149.99
      });
      expect(newUser).toEqual(mockPremiumUser);
    });
  });

  describe('Security Tests', () => {
    it('should reject requests with suspicious user agents', async () => {
      const { detectSuspiciousActivity } = require('../lib/security');
      detectSuspiciousActivity.mockReturnValue({ suspicious: true, reason: 'Bot-like User-Agent detected' });

      const event = createMockEvent('GET', '/premium/users');
      event.headers['User-Agent'] = 'curl/7.68.0';

      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Access denied');
    });

    it('should handle rate limiting correctly', async () => {
      const { checkRateLimit } = require('../lib/security');
      checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 900000 });

      const event = createMockEvent('GET', '/premium/users');
      
      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Rate limit exceeded');
    });

    it('should validate input data properly', async () => {
      const { validateAndSanitizePremiumUser } = require('../lib/security');
      validateAndSanitizePremiumUser.mockReturnValue({
        valid: false,
        errors: ['Invalid email format', 'Amount must be positive'],
        sanitizedData: null
      });

      const invalidData = {
        email: 'invalid-email',
        name: '',
        amount: -100
      };

      const event = createMockEvent('POST', '/premium/users', invalidData);
      
      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Validation failed');
    });

    it('should sanitize input data', async () => {
      const { validateAndSanitizePremiumUser } = require('../lib/security');
      
      const maliciousData = {
        email: 'test@example.com',
        name: '<script>alert("xss")</script>',
        phone: '+1234567890',
        zoom_id: 'test.user',
        designation: 'Engineer',
        order_id: 'order_123',
        amount: 99.99
      };

      const sanitizedData = {
        ...maliciousData,
        name: 'alert("xss")' // Should be sanitized
      };

      validateAndSanitizePremiumUser.mockReturnValue({
        valid: true,
        errors: [],
        sanitizedData
      });

      const event = createMockEvent('POST', '/premium/users', maliciousData);
      
      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe('alert("xss")'); // Sanitized
    });
  });

  describe('Database Integration Tests', () => {
    it('should handle database connection errors gracefully', async () => {
      const { executeQuery } = require('../lib/database');
      executeQuery.mockResolvedValue({
        data: null,
        error: 'Database connection failed'
      });

      const event = createMockEvent('GET', '/premium/users');
      
      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Internal server error');
    });

    it('should handle "no rows" errors correctly for non-premium users', async () => {
      const { executeQuery } = require('../lib/database');
      executeQuery.mockResolvedValue({
        data: null,
        error: { message: 'No rows returned' }
      });

      const event = createMockEvent('GET', '/premium/check', null, { email: 'nonpremium@example.com' });
      
      const response = await checkPremiumStatus(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.isPremium).toBe(false);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle malformed JSON gracefully', async () => {
      const event = createMockEvent('POST', '/premium/users');
      event.body = 'invalid json';
      
      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should handle missing authentication', async () => {
      const event = createMockEvent('GET', '/premium/users');
      delete event.headers.Authorization;
      
      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should handle invalid user ID in DELETE', async () => {
      const event = createMockEvent('DELETE', '/premium/users', null, { id: 'invalid' });
      
      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Valid User ID is required');
    });

    it('should handle invalid email format in check endpoint', async () => {
      const event = createMockEvent('GET', '/premium/check', null, { email: 'invalid-email' });
      
      const response = await checkPremiumStatus(event);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid email format');
    });
  });

  describe('CORS and Headers Tests', () => {
    it('should include proper CORS headers in all responses', async () => {
      const { executeQuery } = require('../lib/database');
      executeQuery.mockResolvedValue({
        data: mockPremiumUser,
        error: null
      });

      const event = createMockEvent('GET', '/premium/users');
      
      const response = await premiumUsersHandler(event);
      
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Headers');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(response.headers).toHaveProperty('Content-Type');
    });

    it('should handle CORS preflight requests', async () => {
      const event = createMockEvent('OPTIONS', '/premium/users');
      
      const response = await premiumUsersHandler(event);
      
      expect(response.statusCode).toBe(200);
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(response.body).toBe('');
    });
  });
});
