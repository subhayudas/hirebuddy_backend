import { APIGatewayProxyEvent, APIGatewayProxyResult, Contact } from '../types';
import { executeQuery, getSupabaseClient } from '../lib/database';
import { successResponse, errorResponse, corsResponse, unauthorizedResponse, notFoundResponse } from '../lib/response';
import { requireAuth } from '../lib/auth';
import { z } from 'zod';

// Validation schemas
const contactSchema = z.object({
  full_name: z.string().optional(),
  first_name: z.string().optional(),
  company_name: z.string().optional(),
  linkedin_link: z.string().url().optional().or(z.literal('')),
  email: z.string().email().optional(),
  title: z.string().optional(),
  company_website_full: z.string().url().optional().or(z.literal(''))
});

/**
 * Get contacts for authenticated user
 */
export const getContacts = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Authentication removed for frontend compatibility
    // const user = requireAuth(event);

    // Get query parameters for filtering
    const availableForEmail = event.queryStringParameters?.availableForEmail === 'true';

    let query;
    if (availableForEmail) {
      // Get contacts available for email (no emails sent in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      query = async (client: any) =>
        client.from('email_database')
          .select('*')
          .not('email', 'is', null)
          .neq('email', '')
          .or(`email_sent_on.is.null,email_sent_on.lt.${sevenDaysAgo.toISOString()}`)
          .order('created_at', { ascending: false });
    } else {
      // Get all contacts
      query = async (client: any) =>
        client.from('email_database')
          .select('*')
          .order('created_at', { ascending: false });
    }

    const { data: contacts, error } = await executeQuery(query);

    if (error) {
      console.error('Error fetching contacts:', error);
      return errorResponse('Failed to fetch contacts', 500);
    }

    // Transform contacts to consistent format
    const contactsList = Array.isArray(contacts) ? contacts : [];
    const transformedContacts = contactsList.map((contact: any) => ({
      ...contact,
      name: contact.full_name || contact.first_name || contact.name || 'Unknown',
      company: contact.company_name || contact.company || undefined,
      company_website: contact.company_website_full || contact.company_website || undefined,
      email_sent: !!contact.email_sent_on,
      updated_at: contact.updated_at || contact.created_at,
      status: contact.status || 'active'
    }));

    return successResponse(transformedContacts, 'Contacts retrieved successfully');

  } catch (error) {
    console.error('Get contacts error:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Create a new contact
 */
export const createContact = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Authentication removed for frontend compatibility
    // const user = requireAuth(event);

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    
    // Validate input
    const validation = contactSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`, 422);
    }

    const contactData = validation.data;

    // Add contact to database
    const { data: contact, error } = await executeQuery(async (client) =>
      client.from('email_database')
        .insert([contactData])
        .select()
        .single()
    );

    if (error) {
      console.error('Error creating contact:', error);
      return errorResponse('Failed to create contact', 500);
    }

    return successResponse(contact, 'Contact created successfully', 201);

  } catch (error) {
    console.error('Create contact error:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Update a contact
 */
export const updateContact = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Authentication removed for frontend compatibility
    // const user = requireAuth(event);

    const contactId = event.pathParameters?.id;
    if (!contactId) {
      return errorResponse('Contact ID is required', 400);
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    
    // Validate input
    const validation = contactSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}`, 422);
    }

    const updates = validation.data;

    // Update contact in database
    const { data: contact, error } = await executeQuery(async (client) =>
      client.from('email_database')
        .update(updates)
        .eq('id', contactId)
        .select()
        .single()
    );

    if (error) {
      console.error('Error updating contact:', error);
      return notFoundResponse('Contact not found or failed to update');
    }

    return successResponse(contact, 'Contact updated successfully');

  } catch (error) {
    console.error('Update contact error:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Delete a contact
 */
export const deleteContact = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Authentication removed for frontend compatibility
    // const user = requireAuth(event);

    const contactId = event.pathParameters?.id;
    if (!contactId) {
      return errorResponse('Contact ID is required', 400);
    }

    // Delete contact from database
    const { error } = await executeQuery(async (client) =>
      client.from('email_database')
        .delete()
        .eq('id', contactId)
    );

    if (error) {
      console.error('Error deleting contact:', error);
      return notFoundResponse('Contact not found or failed to delete');
    }

    return successResponse({}, 'Contact deleted successfully');

  } catch (error) {
    console.error('Delete contact error:', error);
    return errorResponse('Internal server error', 500);
  }
}; 

/**
 * Search contacts by query across name/email/company
 */
export const searchContacts = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Authentication removed for frontend compatibility
    // const user = requireAuth(event);

    const q = event.queryStringParameters?.query?.trim();
    if (!q) {
      return errorResponse('Query parameter "query" is required', 400);
    }

    const orFilter = `full_name.ilike.%${q}%,first_name.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%`;

    const { data: contacts, error } = await executeQuery(async (client) =>
      client
        .from('email_database')
        .select('*')
        .or(orFilter)
        .order('created_at', { ascending: false })
    );

    if (error) {
      console.error('Error searching contacts:', error);
      return errorResponse('Failed to search contacts', 500);
    }

    const contactsList = Array.isArray(contacts) ? contacts : [];
    const transformed = contactsList.map((contact: any) => ({
      ...contact,
      name: contact.full_name || contact.first_name || contact.name || 'Unknown',
      company: contact.company_name || contact.company || undefined,
      company_website: contact.company_website_full || contact.company_website || undefined,
      email_sent: !!contact.email_sent_on,
      updated_at: contact.updated_at || contact.created_at,
      status: contact.status || 'active'
    }));

    return successResponse(transformed, 'Contacts search results');
  } catch (error) {
    console.error('Search contacts error:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * List contacts with non-empty email
 */
export const getContactsWithEmail = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Authentication removed for frontend compatibility
    // const user = requireAuth(event);

    const { data: contacts, error } = await executeQuery(async (client) =>
      client
        .from('email_database')
        .select('*')
        .not('email', 'is', null)
        .neq('email', '')
        .order('created_at', { ascending: false })
    );

    if (error) {
      console.error('Error fetching contacts with email:', error);
      return errorResponse('Failed to fetch contacts with email', 500);
    }

    const contactsList = Array.isArray(contacts) ? contacts : [];
    const transformed = contactsList.map((contact: any) => ({
      ...contact,
      name: contact.full_name || contact.first_name || contact.name || 'Unknown',
      company: contact.company_name || contact.company || undefined,
      company_website: contact.company_website_full || contact.company_website || undefined,
      email_sent: !!contact.email_sent_on,
      updated_at: contact.updated_at || contact.created_at,
      status: contact.status || 'active'
    }));

    return successResponse(transformed, 'Contacts with email retrieved successfully');
  } catch (error) {
    console.error('Get contacts with email error:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * List contacts available for email (non-empty email and email_sent_on is null or older than 7 days)
 */
export const getContactsAvailableForEmail = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Authentication removed for frontend compatibility
    // const user = requireAuth(event);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: contacts, error } = await executeQuery(async (client) =>
      client
        .from('email_database')
        .select('*')
        .not('email', 'is', null)
        .neq('email', '')
        .or(`email_sent_on.is.null,email_sent_on.lt.${sevenDaysAgo.toISOString()}`)
        .order('created_at', { ascending: false })
    );

    if (error) {
      console.error('Error fetching contacts available for email:', error);
      return errorResponse('Failed to fetch contacts available for email', 500);
    }

    const contactsList = Array.isArray(contacts) ? contacts : [];
    const transformed = contactsList.map((contact: any) => ({
      ...contact,
      name: contact.full_name || contact.first_name || contact.name || 'Unknown',
      company: contact.company_name || contact.company || undefined,
      company_website: contact.company_website_full || contact.company_website || undefined,
      email_sent: !!contact.email_sent_on,
      updated_at: contact.updated_at || contact.created_at,
      status: contact.status || 'active'
    }));

    return successResponse(transformed, 'Contacts available for email retrieved successfully');
  } catch (error) {
    console.error('Get contacts available for email error:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Mark a contact as email sent (sets email_sent_on = now)
 */
export const markContactEmailSent = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Authentication removed for frontend compatibility
    // const user = requireAuth(event);

    const contactId = event.pathParameters?.id;
    if (!contactId) {
      return errorResponse('Contact ID is required', 400);
    }

    const nowIso = new Date().toISOString();
    const { data: contact, error } = await executeQuery(async (client) =>
      client
        .from('email_database')
        .update({ email_sent_on: nowIso })
        .eq('id', contactId)
        .select()
        .single()
    );

    if (error) {
      console.error('Error marking contact email sent:', error);
      return notFoundResponse('Contact not found or failed to update');
    }

    return successResponse(contact, 'Contact email_sent_on updated');
  } catch (error) {
    console.error('Mark contact email sent error:', error);
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Get total contacts count
 */
export const getContactsCount = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Authentication removed for frontend compatibility
    // const user = requireAuth(event);

    const client = getSupabaseClient();
    const { count, error } = await client
      .from('email_database')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error getting contacts count:', error);
      return errorResponse('Failed to get contacts count', 500);
    }

    return successResponse({ count: count || 0 }, 'Contacts count retrieved successfully');
  } catch (error) {
    console.error('Get contacts count error:', error);
    return errorResponse('Internal server error', 500);
  }
};