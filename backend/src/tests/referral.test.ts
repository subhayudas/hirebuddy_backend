import { APIGatewayProxyEvent } from '../types';
import {
  generateReferralCode,
  applyReferralCode,
  getReferralStats,
  getReferralProgress,
  completeReferral,
  getAdminReferralStats,
  validateReferralCode
} from '../handlers/referral';
import { referralService } from '../lib/referralService';

// Mock the dependencies
jest.mock('../lib/database');
jest.mock('../lib/auth');
jest.mock('../lib/response');

const mockGetSupabaseClient = require('../lib/database').getSupabaseClient;
const mockRequireAuth = require('../lib/auth').requireAuth;
const mockSuccessResponse = require('../lib/response').successResponse;
const mockErrorResponse = require('../lib/response').errorResponse;
const mockCorsResponse = require('../lib/response').corsResponse;
const mockUnauthorizedResponse = require('../lib/response').unauthorizedResponse;

describe('Referral System API Tests', () => {
  let mockSupabase: any;
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      order: jest.fn().mockReturnThis(),
      auth: {
        getUser: jest.fn()
      }
    };

    mockGetSupabaseClient.mockReturnValue(mockSupabase);

    // Mock event
    mockEvent = {
      body: null,
      headers: {},
      httpMethod: 'POST',
      path: '/referral/generate-code',
      pathParameters: null,
      queryStringParameters: null,
      requestContext: {
        requestId: 'test-request-id',
        stage: 'test',
        httpMethod: 'POST',
        path: '/referral/generate-code'
      },
      isBase64Encoded: false
    };
  });

  describe('generateReferralCode', () => {
    it('should generate a new referral code for authenticated user', async () => {
      // Mock authentication
      mockRequireAuth.mockResolvedValue({ success: true, userId: 'user-123' });

      // Mock no existing code
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      // Mock successful code creation
      mockSupabase.single.mockResolvedValueOnce({
        data: { referral_code: 'HB-A1B2C3D4', created_at: '2024-01-01T00:00:00Z' },
        error: null
      });

      mockSuccessResponse.mockReturnValue({ statusCode: 200, body: 'success' });

      const result = await generateReferralCode(mockEvent);

      expect(mockRequireAuth).toHaveBeenCalledWith(mockEvent);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_referral_codes');
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        referral_code: expect.stringMatching(/^HB-[A-F0-9]{8}$/),
        is_active: true
      });
      expect(mockSuccessResponse).toHaveBeenCalledWith({
        referralCode: 'HB-A1B2C3D4',
        message: 'Referral code generated successfully',
        isNew: true,
        createdAt: '2024-01-01T00:00:00Z'
      });
      expect(result.statusCode).toBe(200);
    });

    it('should return existing referral code if user already has one', async () => {
      // Mock authentication
      mockRequireAuth.mockResolvedValue({ success: true, userId: 'user-123' });

      // Mock existing code
      mockSupabase.single.mockResolvedValueOnce({
        data: { referral_code: 'HB-EXISTING', is_active: true },
        error: null
      });

      mockSuccessResponse.mockReturnValue({ statusCode: 200, body: 'success' });

      const result = await generateReferralCode(mockEvent);

      expect(mockSuccessResponse).toHaveBeenCalledWith({
        referralCode: 'HB-EXISTING',
        message: 'Existing referral code retrieved',
        isNew: false
      });
      expect(result.statusCode).toBe(200);
    });

    it('should return unauthorized for unauthenticated user', async () => {
      mockRequireAuth.mockResolvedValue({ success: false, error: 'Authentication required' });
      mockUnauthorizedResponse.mockReturnValue({ statusCode: 401, body: 'unauthorized' });

      const result = await generateReferralCode(mockEvent);

      expect(mockUnauthorizedResponse).toHaveBeenCalledWith('Authentication required');
      expect(result.statusCode).toBe(401);
    });
  });

  describe('applyReferralCode', () => {
    beforeEach(() => {
      mockEvent.body = JSON.stringify({
        referralCode: 'HB-A1B2C3D4',
        userEmail: 'test@example.com'
      });
    });

    it('should apply referral code successfully', async () => {
      // Mock valid referral code
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'code-123', user_id: 'referrer-123', referral_code: 'HB-A1B2C3D4' },
        error: null
      });

      // Mock referrer email check
      mockSupabase.single.mockResolvedValueOnce({
        data: { email: 'referrer@example.com' },
        error: null
      });

      // Mock no existing referral
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }
      });

      // Mock successful referral creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'referral-123',
          created_at: '2024-01-01T00:00:00Z',
          expires_at: '2024-01-31T00:00:00Z'
        },
        error: null
      });

      mockSuccessResponse.mockReturnValue({ statusCode: 200, body: 'success' });

      const result = await applyReferralCode(mockEvent);

      expect(mockSupabase.from).toHaveBeenCalledWith('user_referral_codes');
      expect(mockSupabase.from).toHaveBeenCalledWith('auth.users');
      expect(mockSupabase.from).toHaveBeenCalledWith('referrals');
      expect(mockSuccessResponse).toHaveBeenCalledWith({
        referralId: 'referral-123',
        message: 'Referral code applied successfully',
        referrerId: 'referrer-123',
        expiresAt: '2024-01-31T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z'
      });
      expect(result.statusCode).toBe(200);
    });

    it('should reject self-referral', async () => {
      // Mock valid referral code
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'code-123', user_id: 'referrer-123', referral_code: 'HB-A1B2C3D4' },
        error: null
      });

      // Mock referrer email same as user email
      mockSupabase.single.mockResolvedValueOnce({
        data: { email: 'test@example.com' },
        error: null
      });

      mockErrorResponse.mockReturnValue({ statusCode: 400, body: 'error' });

      const result = await applyReferralCode(mockEvent);

      expect(mockErrorResponse).toHaveBeenCalledWith('Cannot refer yourself', 400);
      expect(result.statusCode).toBe(400);
    });

    it('should reject invalid referral code', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' }
      });

      mockErrorResponse.mockReturnValue({ statusCode: 400, body: 'error' });

      const result = await applyReferralCode(mockEvent);

      expect(mockErrorResponse).toHaveBeenCalledWith('Invalid or inactive referral code', 400);
      expect(result.statusCode).toBe(400);
    });
  });

  describe('getReferralStats', () => {
    it('should return user referral statistics', async () => {
      // Mock authentication
      mockRequireAuth.mockResolvedValue({ success: true, userId: 'user-123' });

      // Mock referral rewards
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          completed_referrals: 5,
          premium_granted: false,
          premium_granted_at: null,
          premium_expires_at: null
        },
        error: null
      });

      // Mock referral code
      mockSupabase.single.mockResolvedValueOnce({
        data: { referral_code: 'HB-A1B2C3D4', created_at: '2024-01-01T00:00:00Z' },
        error: null
      });

      // Mock referrals list
      mockSupabase.order.mockResolvedValueOnce({
        data: [
          { id: 'ref-1', referred_email: 'user1@example.com', status: 'completed', created_at: '2024-01-01T00:00:00Z', completed_at: '2024-01-02T00:00:00Z' },
          { id: 'ref-2', referred_email: 'user2@example.com', status: 'pending', created_at: '2024-01-03T00:00:00Z', completed_at: null }
        ],
        error: null
      });

      mockSuccessResponse.mockReturnValue({ statusCode: 200, body: 'success' });

      const result = await getReferralStats(mockEvent);

      expect(mockSuccessResponse).toHaveBeenCalledWith({
        user: {
          id: 'user-123',
          referralCode: 'HB-A1B2C3D4',
          codeCreatedAt: '2024-01-01T00:00:00Z'
        },
        rewards: {
          completedReferrals: 5,
          premiumGranted: false,
          premiumGrantedAt: null,
          premiumExpiresAt: null
        },
        statistics: {
          totalReferrals: 2,
          completedReferrals: 1,
          pendingReferrals: 1,
          expiredReferrals: 0,
          referralsNeededForPremium: 5,
          progressPercentage: 50
        },
        referrals: expect.any(Array)
      });
      expect(result.statusCode).toBe(200);
    });
  });

  describe('validateReferralCode', () => {
    it('should validate referral code successfully', async () => {
      mockEvent.httpMethod = 'GET';
      mockEvent.queryStringParameters = { code: 'HB-A1B2C3D4' };

      mockSupabase.single.mockResolvedValueOnce({
        data: { referral_code: 'HB-A1B2C3D4' },
        error: null
      });

      mockSuccessResponse.mockReturnValue({ statusCode: 200, body: 'success' });

      const result = await validateReferralCode(mockEvent);

      expect(mockSuccessResponse).toHaveBeenCalledWith({
        valid: true,
        referralCode: 'HB-A1B2C3D4',
        message: 'Referral code is valid'
      });
      expect(result.statusCode).toBe(200);
    });

    it('should reject invalid referral code format', async () => {
      mockEvent.httpMethod = 'GET';
      mockEvent.queryStringParameters = { code: 'INVALID-CODE' };

      mockErrorResponse.mockReturnValue({ statusCode: 400, body: 'error' });

      const result = await validateReferralCode(mockEvent);

      expect(mockErrorResponse).toHaveBeenCalledWith('Invalid referral code format', 400);
      expect(result.statusCode).toBe(400);
    });
  });

  describe('completeReferral', () => {
    beforeEach(() => {
      mockEvent.body = JSON.stringify({
        referralId: 'referral-123'
      });
    });

    it('should complete referral successfully', async () => {
      // Mock authentication
      mockRequireAuth.mockResolvedValue({ success: true, userId: 'user-123' });

      // Mock pending referral
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'referral-123',
          status: 'pending',
          expires_at: '2024-12-31T00:00:00Z'
        },
        error: null
      });

      // Mock successful update
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'referral-123',
          status: 'completed',
          completed_at: '2024-01-01T00:00:00Z'
        },
        error: null
      });

      mockSuccessResponse.mockReturnValue({ statusCode: 200, body: 'success' });

      const result = await completeReferral(mockEvent);

      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'completed',
        completed_at: expect.any(String)
      });
      expect(mockSuccessResponse).toHaveBeenCalledWith({
        referral: expect.any(Object),
        message: 'Referral completed successfully'
      });
      expect(result.statusCode).toBe(200);
    });

    it('should reject expired referral', async () => {
      // Mock authentication
      mockRequireAuth.mockResolvedValue({ success: true, userId: 'user-123' });

      // Mock expired referral
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'referral-123',
          status: 'pending',
          expires_at: '2023-01-01T00:00:00Z' // Past date
        },
        error: null
      });

      mockErrorResponse.mockReturnValue({ statusCode: 400, body: 'error' });

      const result = await completeReferral(mockEvent);

      expect(mockErrorResponse).toHaveBeenCalledWith('Referral has expired', 400);
      expect(result.statusCode).toBe(400);
    });
  });

  describe('getAdminReferralStats', () => {
    it('should return admin statistics for admin user', async () => {
      // Mock authentication
      mockRequireAuth.mockResolvedValue({ success: true, userId: 'admin-123' });

      // Mock admin check
      mockSupabase.single.mockResolvedValueOnce({
        data: { is_admin: true },
        error: null
      });

      // Mock admin summary
      mockSupabase.order.mockResolvedValueOnce({
        data: [
          {
            email: 'user1@example.com',
            completed_referrals: 10,
            premium_granted: true,
            total_referrals: 12,
            completed_count: 10,
            pending_count: 2,
            expired_count: 0
          }
        ],
        error: null
      });

      // Mock statistics
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          total_referrals: 100,
          completed_referrals: 50,
          pending_referrals: 30,
          expired_referrals: 20,
          unique_referrers: 25,
          unique_referred_emails: 80
        },
        error: null
      });

      mockSuccessResponse.mockReturnValue({ statusCode: 200, body: 'success' });

      const result = await getAdminReferralStats(mockEvent);

      expect(mockSuccessResponse).toHaveBeenCalledWith({
        summary: expect.any(Array),
        statistics: expect.any(Object),
        message: 'Admin referral statistics retrieved successfully'
      });
      expect(result.statusCode).toBe(200);
    });

    it('should reject non-admin user', async () => {
      // Mock authentication
      mockRequireAuth.mockResolvedValue({ success: true, userId: 'user-123' });

      // Mock non-admin check
      mockSupabase.single.mockResolvedValueOnce({
        data: { is_admin: false },
        error: null
      });

      mockUnauthorizedResponse.mockReturnValue({ statusCode: 401, body: 'unauthorized' });

      const result = await getAdminReferralStats(mockEvent);

      expect(mockUnauthorizedResponse).toHaveBeenCalledWith('Admin access required');
      expect(result.statusCode).toBe(401);
    });
  });
});

describe('ReferralService Tests', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      order: jest.fn().mockReturnThis()
    };
    mockGetSupabaseClient.mockReturnValue(mockSupabase);
  });

  describe('generateReferralCode', () => {
    it('should generate new referral code', async () => {
      // Mock no existing code
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      // Mock successful creation
      mockSupabase.single.mockResolvedValueOnce({
        data: { referral_code: 'HB-A1B2C3D4', created_at: '2024-01-01T00:00:00Z' },
        error: null
      });

      const result = await referralService.generateReferralCode('user-123');

      expect(result).toEqual({
        referralCode: 'HB-A1B2C3D4',
        isNew: true
      });
    });

    it('should return existing code if available', async () => {
      // Mock existing code
      mockSupabase.single.mockResolvedValueOnce({
        data: { referral_code: 'HB-EXISTING' },
        error: null
      });

      const result = await referralService.generateReferralCode('user-123');

      expect(result).toEqual({
        referralCode: 'HB-EXISTING',
        isNew: false
      });
    });
  });

  describe('validateReferralCode', () => {
    it('should validate correct referral code format', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { referral_code: 'HB-A1B2C3D4' },
        error: null
      });

      const result = await referralService.validateReferralCode('HB-A1B2C3D4');

      expect(result).toBe(true);
    });

    it('should reject invalid format', async () => {
      const result = await referralService.validateReferralCode('INVALID-CODE');

      expect(result).toBe(false);
    });
  });
});
