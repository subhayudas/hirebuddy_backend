import { getEmailUsage, incrementEmailCount } from '../handlers/email';
import { executeQuery } from '../lib/database';
import { requireAuth } from '../lib/auth';
import { APIGatewayProxyEvent } from '../types';

// Mock dependencies
jest.mock('../lib/database');
jest.mock('../lib/auth');

const mockExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

// Helper function to create mock events
const createMockEvent = (
  method: string,
  path: string,
  body: any = null,
  queryParams: any = null,
  headers: any = {}
): APIGatewayProxyEvent => ({
  body: body ? JSON.stringify(body) : null,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer mock-token',
    ...headers
  },
  httpMethod: method,
  path,
  pathParameters: null,
  queryStringParameters: queryParams,
  requestContext: {
    requestId: 'test-request-id',
    stage: 'dev',
    httpMethod: method,
    path
  },
  isBase64Encoded: false
});

describe('Email Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockReturnValue({ id: 'test-user-id', email: 'test@example.com' });
  });

  describe('getEmailUsage', () => {
    it('should return email usage for existing user', async () => {
      const mockEmailRecord = {
        id: 'email-record-id',
        created_at: '2024-01-01T00:00:00Z',
        total_count: 50,
        user_id: 'test-user-id',
        email_limit: 125
      };

      mockExecuteQuery.mockResolvedValue({ data: mockEmailRecord, error: null });

      const event = createMockEvent('GET', '/email/usage');
      const result = await getEmailUsage(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual({
        used: 50,
        limit: 125,
        remaining: 75,
        percentage: 40,
        canSendEmail: true
      });
    });

    it('should create initial record and return usage for new user', async () => {
      // First call returns no existing record
      mockExecuteQuery
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ 
          data: {
            id: 'new-record-id',
            created_at: '2024-01-01T00:00:00Z',
            total_count: 0,
            user_id: 'test-user-id',
            email_limit: 125
          }, 
          error: null 
        });

      const event = createMockEvent('GET', '/email/usage');
      const result = await getEmailUsage(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual({
        used: 0,
        limit: 125,
        remaining: 125,
        percentage: 0,
        canSendEmail: true
      });
    });

    it('should handle database errors', async () => {
      mockExecuteQuery.mockResolvedValue({ data: null, error: 'Database connection failed' });

      const event = createMockEvent('GET', '/email/usage');
      const result = await getEmailUsage(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Failed to retrieve email usage');
    });

    it('should handle authentication errors', async () => {
      mockRequireAuth.mockImplementation(() => {
        throw new Error('Authentication required');
      });

      const event = createMockEvent('GET', '/email/usage');
      const result = await getEmailUsage(event);

      expect(result.statusCode).toBe(401);
    });

    it('should handle CORS preflight requests', async () => {
      const event = createMockEvent('OPTIONS', '/email/usage');
      const result = await getEmailUsage(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
    });
  });

  describe('incrementEmailCount', () => {
    it('should increment email count for existing user', async () => {
      const mockCurrentRecord = {
        id: 'email-record-id',
        created_at: '2024-01-01T00:00:00Z',
        total_count: 50,
        user_id: 'test-user-id',
        email_limit: 125
      };

      const mockUpdatedRecord = {
        ...mockCurrentRecord,
        total_count: 51
      };

      mockExecuteQuery
        .mockResolvedValueOnce({ data: mockCurrentRecord, error: null })
        .mockResolvedValueOnce({ data: mockUpdatedRecord, error: null });

      const event = createMockEvent('POST', '/email/increment', { count: 1 });
      const result = await incrementEmailCount(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual({
        previousCount: 50,
        newCount: 51,
        limit: 125,
        remaining: 74,
        canSendEmail: true
      });
    });

    it('should create initial record and increment for new user', async () => {
      const mockNewRecord = {
        id: 'new-record-id',
        created_at: '2024-01-01T00:00:00Z',
        total_count: 1,
        user_id: 'test-user-id',
        email_limit: 125
      };

      mockExecuteQuery
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: mockNewRecord, error: null });

      const event = createMockEvent('POST', '/email/increment', { count: 1 });
      const result = await incrementEmailCount(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual({
        previousCount: 0,
        newCount: 1,
        limit: 125,
        remaining: 124,
        canSendEmail: true
      });
    });

    it('should use default count of 1 when not specified', async () => {
      const mockCurrentRecord = {
        id: 'email-record-id',
        created_at: '2024-01-01T00:00:00Z',
        total_count: 50,
        user_id: 'test-user-id',
        email_limit: 125
      };

      const mockUpdatedRecord = {
        ...mockCurrentRecord,
        total_count: 51
      };

      mockExecuteQuery
        .mockResolvedValueOnce({ data: mockCurrentRecord, error: null })
        .mockResolvedValueOnce({ data: mockUpdatedRecord, error: null });

      const event = createMockEvent('POST', '/email/increment', {});
      const result = await incrementEmailCount(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.newCount).toBe(51);
    });

    it('should validate count parameter', async () => {
      const event = createMockEvent('POST', '/email/increment', { count: -1 });
      const result = await incrementEmailCount(event);

      expect(result.statusCode).toBe(422);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Validation failed');
    });

    it('should require request body', async () => {
      const event = createMockEvent('POST', '/email/increment');
      event.body = null;
      const result = await incrementEmailCount(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Request body is required');
    });

    it('should handle database errors during increment', async () => {
      mockExecuteQuery.mockResolvedValue({ data: null, error: 'Database update failed' });

      const event = createMockEvent('POST', '/email/increment', { count: 1 });
      const result = await incrementEmailCount(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Failed to retrieve current email count');
    });

    it('should handle authentication errors', async () => {
      mockRequireAuth.mockImplementation(() => {
        throw new Error('Authentication required');
      });

      const event = createMockEvent('POST', '/email/increment', { count: 1 });
      const result = await incrementEmailCount(event);

      expect(result.statusCode).toBe(401);
    });

    it('should handle CORS preflight requests', async () => {
      const event = createMockEvent('OPTIONS', '/email/increment');
      const result = await incrementEmailCount(event);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
    });

    it('should handle email limit exceeded scenario', async () => {
      const mockCurrentRecord = {
        id: 'email-record-id',
        created_at: '2024-01-01T00:00:00Z',
        total_count: 125,
        user_id: 'test-user-id',
        email_limit: 125
      };

      const mockUpdatedRecord = {
        ...mockCurrentRecord,
        total_count: 126
      };

      mockExecuteQuery
        .mockResolvedValueOnce({ data: mockCurrentRecord, error: null })
        .mockResolvedValueOnce({ data: mockUpdatedRecord, error: null });

      const event = createMockEvent('POST', '/email/increment', { count: 1 });
      const result = await incrementEmailCount(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.canSendEmail).toBe(false);
      expect(body.data.remaining).toBe(0);
    });
  });
});
