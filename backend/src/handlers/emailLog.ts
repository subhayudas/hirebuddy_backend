import { APIGatewayProxyEvent, APIGatewayProxyResult } from '../types';
import { executeQuery } from '../lib/database';
import { successResponse, errorResponse, corsResponse, unauthorizedResponse } from '../lib/response';
import { requireAuth } from '../lib/auth';
import { z } from 'zod';

// Validation schemas
const emailLogCreateSchema = z.object({
  to: z.string().email(),
  messageId: z.string(),
  threadId: z.string().optional(),
  reference: z.string().optional(),
  subject: z.string().optional()
});

/**
 * Get email statistics (total sent, monthly counts)
 */
export const getEmailStats = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    // Get total emails sent
    const { data: totalSentResult } = await executeQuery(async (client) => {
      const result = await client.from('useremaillog')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.email);
      return { data: result.count || 0, error: result.error };
    });

    // Get current month and last month dates
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get emails this month
    const { data: thisMonthResult } = await executeQuery(async (client) => {
      const result = await client.from('useremaillog')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.email)
        .gte('sent_at', startOfMonth.toISOString());
      return { data: result.count || 0, error: result.error };
    });

    // Get emails last month
    const { data: lastMonthResult } = await executeQuery(async (client) => {
      const result = await client.from('useremaillog')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.email)
        .gte('sent_at', startOfLastMonth.toISOString())
        .lte('sent_at', endOfLastMonth.toISOString());
      return { data: result.count || 0, error: result.error };
    });

    // Get monthly counts for the last 12 months
    const { data: monthlyData } = await executeQuery(async (client) => {
      const result = await client.from('useremaillog')
        .select('sent_at')
        .eq('user_id', user.email)
        .gte('sent_at', new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString());
      return { data: result.data, error: result.error };
    });

    // Process monthly counts
    const monthlyCounts: { [month: string]: number } = {};
    if (monthlyData) {
      monthlyData.forEach((log: any) => {
        const date = new Date(log.sent_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
      });
    }

    const stats = {
      totalSent: totalSentResult || 0,
      monthlyCounts,
      thisMonth: thisMonthResult || 0,
      lastMonth: lastMonthResult || 0
    };

    return successResponse(stats, 'Email statistics retrieved successfully');

  } catch (error) {
    console.error('Get email stats error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Get contacts who have received emails
 */
export const getContactsWithEmails = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    // Get all email logs with recipient information
    const { data: emailLogs, error } = await executeQuery(async (client) => {
      const result = await client.from('useremaillog')
        .select('to, sent_at, subject')
        .eq('user_id', user.email)
        .not('to', 'is', null)
        .order('sent_at', { ascending: false });
      return { data: result.data, error: result.error };
    });

    if (error) {
      console.error('Database error in getContactsWithEmails:', error);
      return errorResponse('Failed to retrieve contacts with emails', 500);
    }

    // Group by email and get latest information
    const contactMap = new Map<string, any>();
    
    if (emailLogs) {
      emailLogs.forEach((log: any) => {
        if (log.to) {
          if (!contactMap.has(log.to)) {
            contactMap.set(log.to, {
              email: log.to,
              lastEmailSent: log.sent_at,
              emailCount: 1,
              lastSubject: log.subject
            });
          } else {
            const contact = contactMap.get(log.to);
            contact.emailCount += 1;
            // Keep the most recent subject
            if (log.subject && !contact.lastSubject) {
              contact.lastSubject = log.subject;
            }
          }
        }
      });
    }

    const contacts = Array.from(contactMap.values());

    return successResponse(contacts, 'Contacts with emails retrieved successfully');

  } catch (error) {
    console.error('Get contacts with emails error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Get conversation history for a specific contact
 */
export const getConversationHistory = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    const contactId = event.pathParameters?.contactId;
    if (!contactId) {
      return errorResponse('Contact ID is required', 400);
    }

    // Get all email logs for this contact
    const { data: emailLogs, error } = await executeQuery(async (client) => {
      const result = await client.from('useremaillog')
        .select('*')
        .eq('user_id', user.email)
        .eq('to', contactId)
        .order('sent_at', { ascending: true });
      return { data: result.data, error: result.error };
    });

    if (error) {
      console.error('Database error in getConversationHistory:', error);
      return errorResponse('Failed to retrieve conversation history', 500);
    }

    if (!emailLogs || emailLogs.length === 0) {
      return successResponse({
        logs: [],
        totalEmails: 0,
        firstEmailDate: '',
        lastEmailDate: ''
      }, 'No conversation history found');
    }

    const totalEmails = emailLogs.length;
    const firstEmailDate = emailLogs[0]?.sent_at || '';
    const lastEmailDate = emailLogs[emailLogs.length - 1]?.sent_at || '';

    const history = {
      logs: emailLogs,
      totalEmails,
      firstEmailDate,
      lastEmailDate
    };

    return successResponse(history, 'Conversation history retrieved successfully');

  } catch (error) {
    console.error('Get conversation history error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Get conversation statistics for a specific contact
 */
export const getConversationStats = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    const contactId = event.pathParameters?.contactId;
    if (!contactId) {
      return errorResponse('Contact ID is required', 400);
    }

    // Get all email logs for this contact
    const { data: emailLogs, error } = await executeQuery(async (client) => {
      const result = await client.from('useremaillog')
        .select('sent_at')
        .eq('user_id', user.email)
        .eq('to', contactId)
        .order('sent_at', { ascending: true });
      return { data: result.data, error: result.error };
    });

    if (error) {
      console.error('Database error in getConversationStats:', error);
      return errorResponse('Failed to retrieve conversation statistics', 500);
    }

    if (!emailLogs || emailLogs.length === 0) {
      return successResponse({
        totalEmails: 0,
        firstEmailDate: '',
        lastEmailDate: '',
        averageEmailsPerDay: 0,
        daysSinceLastEmail: 0
      }, 'No conversation statistics found');
    }

    const totalEmails = emailLogs.length;
    const firstEmailDate = emailLogs[0]?.sent_at || '';
    const lastEmailDate = emailLogs[emailLogs.length - 1]?.sent_at || '';

    // Calculate average emails per day
    const firstDate = new Date(firstEmailDate);
    const lastDate = new Date(lastEmailDate);
    const daysDiff = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
    const averageEmailsPerDay = totalEmails / daysDiff;

    // Calculate days since last email
    const now = new Date();
    const daysSinceLastEmail = Math.ceil((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    const stats = {
      totalEmails,
      firstEmailDate,
      lastEmailDate,
      averageEmailsPerDay: Math.round(averageEmailsPerDay * 100) / 100,
      daysSinceLastEmail
    };

    return successResponse(stats, 'Conversation statistics retrieved successfully');

  } catch (error) {
    console.error('Get conversation stats error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Log a new email to useremaillog table
 */
export const logEmail = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    
    // Validate input
    const validation = emailLogCreateSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`, 422);
    }

    const { to, messageId, threadId, reference, subject } = validation.data;

    // Insert new email log
    const { data: newLog, error } = await executeQuery(async (client) => {
      const result = await client.from('useremaillog')
        .insert({
          to,
          user_id: user.email,
          messageId,
          threadId,
          reference,
          subject
        })
        .select()
        .single();
      return { data: result.data, error: result.error };
    });

    if (error) {
      console.error('Database error in logEmail:', error);
      return errorResponse('Failed to log email', 500);
    }

    return successResponse(newLog, 'Email logged successfully');

  } catch (error) {
    console.error('Log email error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Get contacts needing follow-up emails (emails sent more than 7 days ago)
 */
export const getFollowupsNeeded = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    // Get all email logs with recipient information
    const { data: emailLogs, error } = await executeQuery(async (client) => {
      const result = await client.from('useremaillog')
        .select('to, sent_at, subject')
        .eq('user_id', user.email)
        .not('to', 'is', null)
        .order('sent_at', { ascending: false });
      return { data: result.data, error: result.error };
    });

    if (error) {
      console.error('Database error in getFollowupsNeeded:', error);
      return errorResponse('Failed to retrieve follow-up contacts', 500);
    }

    // Group by email and find contacts needing follow-up
    const contactMap = new Map<string, any>();
    const now = new Date();
    
    if (emailLogs) {
      emailLogs.forEach((log: any) => {
        if (log.to) {
          if (!contactMap.has(log.to)) {
            const lastEmailDate = new Date(log.sent_at);
            const daysSinceLastEmail = Math.ceil((now.getTime() - lastEmailDate.getTime()) / (1000 * 60 * 60 * 24));
            
            contactMap.set(log.to, {
              email: log.to,
              lastEmailSent: log.sent_at,
              daysSinceLastEmail,
              emailCount: 1,
              lastSubject: log.subject
            });
          } else {
            const contact = contactMap.get(log.to);
            contact.emailCount += 1;
            // Keep the most recent subject
            if (log.subject && !contact.lastSubject) {
              contact.lastSubject = log.subject;
            }
          }
        }
      });
    }

    // Filter contacts that need follow-up (more than 7 days since last email)
    const followupContacts = Array.from(contactMap.values())
      .filter((contact: any) => contact.daysSinceLastEmail > 7)
      .sort((a: any, b: any) => b.daysSinceLastEmail - a.daysSinceLastEmail);

    return successResponse(followupContacts, 'Follow-up contacts retrieved successfully');

  } catch (error) {
    console.error('Get followups needed error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};
