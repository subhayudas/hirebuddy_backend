import { getEmailStats, getContactsWithEmails, getConversationHistory, getConversationStats, logEmail, getFollowupsNeeded } from '../handlers/emailLog';

// Mock the dependencies
jest.mock('../lib/database');
jest.mock('../lib/response');
jest.mock('../lib/auth');

describe('Email Log Handlers', () => {
  const mockEvent = {
    httpMethod: 'GET',
    headers: { Authorization: 'Bearer test-token' },
    body: null,
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {
      requestId: 'test-request-id',
      stage: 'test',
      httpMethod: 'GET',
      path: '/test'
    },
    isBase64Encoded: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEmailStats', () => {
    it('should return email statistics', async () => {
      const mockExecuteQuery = require('../lib/database').executeQuery;
      mockExecuteQuery.mockResolvedValue({
        data: 10,
        error: null
      });

      const result = await getEmailStats(mockEvent);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('getContactsWithEmails', () => {
    it('should return contacts who have received emails', async () => {
      const mockExecuteQuery = require('../lib/database').executeQuery;
      mockExecuteQuery.mockResolvedValue({
        data: [
          { to: 'test@example.com', sent_at: '2024-01-01T00:00:00Z', subject: 'Test Email' }
        ],
        error: null
      });

      const result = await getContactsWithEmails(mockEvent);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('getConversationHistory', () => {
    it('should return conversation history for a contact', async () => {
      const mockEventWithParams = {
        ...mockEvent,
        pathParameters: { contactId: 'test@example.com' }
      };

      const mockExecuteQuery = require('../lib/database').executeQuery;
      mockExecuteQuery.mockResolvedValue({
        data: [
          { id: 1, to: 'test@example.com', sent_at: '2024-01-01T00:00:00Z', subject: 'Test Email' }
        ],
        error: null
      });

      const result = await getConversationHistory(mockEventWithParams);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('getConversationStats', () => {
    it('should return conversation statistics for a contact', async () => {
      const mockEventWithParams = {
        ...mockEvent,
        pathParameters: { contactId: 'test@example.com' }
      };

      const mockExecuteQuery = require('../lib/database').executeQuery;
      mockExecuteQuery.mockResolvedValue({
        data: [
          { sent_at: '2024-01-01T00:00:00Z' },
          { sent_at: '2024-01-02T00:00:00Z' }
        ],
        error: null
      });

      const result = await getConversationStats(mockEventWithParams);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('logEmail', () => {
    it('should log a new email', async () => {
      const mockEventWithBody = {
        ...mockEvent,
        httpMethod: 'POST',
        body: JSON.stringify({
          to: 'test@example.com',
          messageId: 'test-message-id',
          subject: 'Test Email'
        })
      };

      const mockExecuteQuery = require('../lib/database').executeQuery;
      mockExecuteQuery.mockResolvedValue({
        data: { id: 1, to: 'test@example.com', messageId: 'test-message-id' },
        error: null
      });

      const result = await logEmail(mockEventWithBody);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('getFollowupsNeeded', () => {
    it('should return contacts needing follow-up', async () => {
      const mockExecuteQuery = require('../lib/database').executeQuery;
      mockExecuteQuery.mockResolvedValue({
        data: [
          { to: 'test@example.com', sent_at: '2024-01-01T00:00:00Z', subject: 'Test Email' }
        ],
        error: null
      });

      const result = await getFollowupsNeeded(mockEvent);
      expect(result.statusCode).toBe(200);
    });
  });
});



