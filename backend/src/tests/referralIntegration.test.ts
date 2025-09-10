import { APIGatewayProxyEvent } from '../types';
import { referralHealthCheck, testReferralSystem } from '../handlers/referralHealth';
import { referralService } from '../lib/referralService';

// Mock the dependencies
jest.mock('../lib/database');
jest.mock('../lib/response');

const mockGetSupabaseClient = require('../lib/database').getSupabaseClient;
const mockSuccessResponse = require('../lib/response').successResponse;
const mockErrorResponse = require('../lib/response').errorResponse;
const mockCorsResponse = require('../lib/response').corsResponse;

describe('Referral System Integration Tests', () => {
  let mockSupabase: any;
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
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
      rpc: jest.fn().mockReturnThis()
    };

    mockGetSupabaseClient.mockReturnValue(mockSupabase);

    // Mock event
    mockEvent = {
      body: null,
      headers: {},
      httpMethod: 'GET',
      path: '/referral/health',
      pathParameters: null,
      queryStringParameters: null,
      requestContext: {
        requestId: 'test-request-id',
        stage: 'test',
        httpMethod: 'GET',
        path: '/referral/health'
      },
      isBase64Encoded: false
    };
  });

  describe('referralHealthCheck', () => {
    it('should return healthy status when all components are working', async () => {
      // Mock successful responses for all tables and views
      mockSupabase.single.mockResolvedValue({ data: { id: 'test' }, error: null });
      mockSupabase.order.mockResolvedValue({ data: [], error: null });
      mockSupabase.rpc.mockResolvedValue({ data: false, error: null });

      mockSuccessResponse.mockReturnValue({ statusCode: 200, body: 'success' });

      const result = await referralHealthCheck(mockEvent);

      expect(mockSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'referral-system',
          status: 'healthy',
          checks: expect.objectContaining({
            tables: expect.objectContaining({
              'user_referral_codes': expect.objectContaining({ status: 'healthy' }),
              'referrals': expect.objectContaining({ status: 'healthy' }),
              'referral_rewards': expect.objectContaining({ status: 'healthy' })
            }),
            views: expect.objectContaining({
              'admin_referral_summary': expect.objectContaining({ status: 'healthy' }),
              'referral_statistics': expect.objectContaining({ status: 'healthy' }),
              'user_referral_progress': expect.objectContaining({ status: 'healthy' })
            })
          })
        }),
        undefined,
        200
      );
      expect(result.statusCode).toBe(200);
    });

    it('should return unhealthy status when some components fail', async () => {
      // Mock some failures
      mockSupabase.single
        .mockResolvedValueOnce({ data: { id: 'test' }, error: null }) // user_referral_codes - success
        .mockResolvedValueOnce({ data: null, error: { message: 'Table not found' } }) // referrals - fail
        .mockResolvedValueOnce({ data: { id: 'test' }, error: null }) // referral_rewards - success
        .mockResolvedValueOnce({ data: [], error: null }) // admin_referral_summary - success
        .mockResolvedValueOnce({ data: [], error: null }) // referral_statistics - success
        .mockResolvedValueOnce({ data: [], error: null }); // user_referral_progress - success

      mockSupabase.order.mockResolvedValue({ data: [], error: null });
      mockSupabase.rpc.mockResolvedValue({ data: false, error: null });

      mockSuccessResponse.mockReturnValue({ statusCode: 503, body: 'unhealthy' });

      const result = await referralHealthCheck(mockEvent);

      expect(mockSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'referral-system',
          status: 'unhealthy'
        }),
        undefined,
        503
      );
      expect(result.statusCode).toBe(503);
    });
  });

  describe('testReferralSystem', () => {
    it('should return success when all tests pass', async () => {
      // Mock successful responses
      mockSupabase.single.mockResolvedValue({ data: { count: 0 }, error: null });
      mockSupabase.order.mockResolvedValue({ data: [], error: null });

      mockSuccessResponse.mockReturnValue({ statusCode: 200, body: 'success' });

      const result = await testReferralSystem(mockEvent);

      expect(mockSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'referral-system-test',
          status: 'success',
          results: expect.objectContaining({
            databaseConnection: 'success',
            tableAccess: expect.objectContaining({
              'user_referral_codes': 'success',
              'referrals': 'success',
              'referral_rewards': 'success'
            })
          })
        }),
        undefined,
        200
      );
      expect(result.statusCode).toBe(200);
    });

    it('should return failure when some tests fail', async () => {
      // Mock some failures
      mockSupabase.single
        .mockResolvedValueOnce({ data: { count: 0 }, error: null }) // database connection - success
        .mockResolvedValueOnce({ data: { id: 'test' }, error: null }) // user_referral_codes - success
        .mockResolvedValueOnce({ data: null, error: { message: 'Table not found' } }) // referrals - fail
        .mockResolvedValueOnce({ data: { id: 'test' }, error: null }) // referral_rewards - success
        .mockResolvedValueOnce({ data: [], error: null }) // admin_referral_summary - success
        .mockResolvedValueOnce({ data: [], error: null }) // referral_statistics - success
        .mockResolvedValueOnce({ data: [], error: null }); // user_referral_progress - success

      mockSupabase.order.mockResolvedValue({ data: [], error: null });

      mockSuccessResponse.mockReturnValue({ statusCode: 503, body: 'failed' });

      const result = await testReferralSystem(mockEvent);

      expect(mockSuccessResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'referral-system-test',
          status: 'failed'
        }),
        undefined,
        503
      );
      expect(result.statusCode).toBe(503);
    });
  });

  describe('ReferralService Integration', () => {
    it('should generate referral code successfully', async () => {
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

    it('should validate referral code format correctly', async () => {
      // Test valid format
      const validResult = await referralService.validateReferralCode('HB-A1B2C3D4');
      expect(validResult).toBe(true);

      // Test invalid format
      const invalidResult = await referralService.validateReferralCode('INVALID-CODE');
      expect(invalidResult).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' }
      });

      await expect(referralService.generateReferralCode('user-123'))
        .rejects.toThrow('Failed to check existing referral code: Database connection failed');
    });
  });

  describe('Database Connection Integration', () => {
    it('should test all referral tables in database connection test', async () => {
      const { testDatabaseConnection } = require('../lib/database');

      // Mock successful responses for all tables
      mockSupabase.single.mockResolvedValue({ data: { id: 'test' }, error: null });
      mockSupabase.order.mockResolvedValue({ data: [], error: null });

      const result = await testDatabaseConnection();

      expect(result).toEqual({
        success: true,
        message: 'Database connection successful (all tables accessible including referral system)'
      });
    });

    it('should handle referral table connection failures', async () => {
      const { testDatabaseConnection } = require('../lib/database');

      // Mock failure for referral tables
      mockSupabase.single
        .mockResolvedValueOnce({ data: { id: 'test' }, error: null }) // email_database - success
        .mockResolvedValueOnce({ data: { id: 'test' }, error: null }) // paid_users - success
        .mockResolvedValueOnce({ data: { id: 'test' }, error: null }) // totalemailcounttable - success
        .mockResolvedValueOnce({ data: null, error: { message: 'Table not found' } }); // user_referral_codes - fail

      const result = await testDatabaseConnection();

      expect(result).toEqual({
        success: false,
        message: 'User referral codes table connection failed: Table not found'
      });
    });
  });
});
