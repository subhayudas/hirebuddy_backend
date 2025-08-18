import { APIGatewayProxyEvent, APIGatewayProxyResult } from '../types';
import { executeQuery } from '../lib/database';
import { successResponse, errorResponse, corsResponse, notFoundResponse, unauthorizedResponse } from '../lib/response';
import { requireAuth } from '../lib/auth';
import { z } from 'zod';

// Validation schemas
const jobQuerySchema = z.object({
  query: z.string().optional(),
  location: z.string().optional(),
  experience: z.string().optional(),
  remote: z.enum(['all', 'remote', 'onsite']).optional(),
  company: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional(),
  offset: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(0)).optional()
});

/**
 * Get jobs with filtering and pagination
 */
export const getJobs = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Parse and validate query parameters
    const queryParams = event.queryStringParameters || {};
    const validation = jobQuerySchema.safeParse(queryParams);
    
    if (!validation.success) {
      return errorResponse(`Invalid query parameters: ${validation.error.errors.map(e => e.message).join(', ')}`, 422);
    }

    const {
      query,
      location,
      experience,
      remote,
      company,
      sortBy = 'created_at',
      sortOrder = 'desc',
      offset = 0
    } = validation.data;

    // Require authentication
    const user = requireAuth(event);

    // Build query for jobs
    const { data: jobs, error } = await executeQuery(async (client) => {
      let queryBuilder = client
        .from('hirebuddy_job_board')
        .select('*', { count: 'exact' });

      // Apply text search filter
      if (query) {
        queryBuilder = queryBuilder.or(`job_title.ilike.%${query}%,company_name.ilike.%${query}%,job_description.ilike.%${query}%`);
      }

      // Apply location filter
      if (location) {
        queryBuilder = queryBuilder.or(`job_location.ilike.%${location}%,city.ilike.%${location}%,state.ilike.%${location}%`);
      }

      // Apply experience filter
      if (experience && experience !== 'any') {
        queryBuilder = queryBuilder.ilike('experience_required', `%${experience}%`);
      }

      // Apply remote filter
      if (remote === 'remote') {
        queryBuilder = queryBuilder.eq('remote_flag', true);
      } else if (remote === 'onsite') {
        queryBuilder = queryBuilder.eq('remote_flag', false);
      }

      // Apply company filter
      if (company) {
        queryBuilder = queryBuilder.ilike('company_name', `%${company}%`);
      }

      // Apply sorting
      queryBuilder = queryBuilder.order(sortBy, { ascending: sortOrder === 'asc' });

      return queryBuilder;
    });

    if (error) {
      console.error('Error fetching jobs:', error);
      return errorResponse('Failed to fetch jobs', 500);
    }

    return successResponse({
      jobs: jobs || [],
      pagination: {
        offset,
        total: jobs?.length || 0
      }
    }, 'Jobs retrieved successfully');

  } catch (error) {
    console.error('Get jobs error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Get single job by ID
 */
export const getJob = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Require authentication
    const user = requireAuth(event);

    const jobId = event.pathParameters?.id;
    if (!jobId) {
      return errorResponse('Job ID is required', 400);
    }

    // Get job from database
    const { data: job, error } = await executeQuery(async (client) =>
      client.from('hirebuddy_job_board').select('*').eq('job_id', jobId).single()
    );

    if (error) {
      console.error('Error fetching job:', error);
      return notFoundResponse('Job not found');
    }

    return successResponse(job, 'Job retrieved successfully');

  } catch (error) {
    console.error('Get job error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Get remote jobs
 */
export const getRemoteJobs = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const validation = jobQuerySchema.safeParse(queryParams);
    
    if (!validation.success) {
      return errorResponse(`Invalid query parameters: ${validation.error.errors.map(e => e.message).join(', ')}`, 422);
    }

    const {
      query,
      location,
      experience,
      company,
      sortBy = 'created_at',
      sortOrder = 'desc',
      offset = 0
    } = validation.data;

    // Require authentication
    const user = requireAuth(event);

    // Get remote jobs from both regular and exclusive tables
    const [regularJobs, exclusiveJobs] = await Promise.all([
      executeQuery(async (client) => {
        let queryBuilder = client
          .from('hirebuddy_job_board')
          .select('*', { count: 'exact' })
          .eq('remote_flag', true);

        if (query) {
          queryBuilder = queryBuilder.or(`job_title.ilike.%${query}%,company_name.ilike.%${query}%,job_description.ilike.%${query}%`);
        }

        if (location) {
          queryBuilder = queryBuilder.or(`job_location.ilike.%${location}%,city.ilike.%${location}%,state.ilike.%${location}%`);
        }

        if (experience && experience !== 'any') {
          queryBuilder = queryBuilder.ilike('experience_required', `%${experience}%`);
        }

        if (company) {
          queryBuilder = queryBuilder.ilike('company_name', `%${company}%`);
        }

        return queryBuilder.order(sortBy, { ascending: sortOrder === 'asc' });
      }),
      executeQuery(async (client) => {
        let queryBuilder = client
          .from('hirebuddy_exclusive_jobs')
          .select('*', { count: 'exact' })
          .eq('remote_flag', true);

        if (query) {
          queryBuilder = queryBuilder.or(`job_title.ilike.%${query}%,company_name.ilike.%${query}%,job_description.ilike.%${query}%`);
        }

        if (location) {
          queryBuilder = queryBuilder.or(`job_location.ilike.%${location}%,city.ilike.%${location}%,state.ilike.%${location}%`);
        }

        if (experience && experience !== 'any') {
          queryBuilder = queryBuilder.ilike('experience_required', `%${experience}%`);
        }

        if (company) {
          queryBuilder = queryBuilder.ilike('company_name', `%${company}%`);
        }

        return queryBuilder.order(sortBy, { ascending: sortOrder === 'asc' });
      })
    ]);

    if (regularJobs.error && exclusiveJobs.error) {
      console.error('Error fetching remote jobs:', regularJobs.error, exclusiveJobs.error);
      return errorResponse('Failed to fetch remote jobs', 500);
    }

    // Combine and sort results
    const allJobs = [
      ...(regularJobs.data || []),
      ...(exclusiveJobs.data || [])
    ];

    return successResponse({
      jobs: allJobs,
      pagination: {
        offset,
        total: allJobs.length
      }
    }, 'Remote jobs retrieved successfully');

  } catch (error) {
    console.error('Get remote jobs error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
};

/**
 * Get exclusive jobs
 */
export const getExclusiveJobs = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const validation = jobQuerySchema.safeParse(queryParams);
    
    if (!validation.success) {
      return errorResponse(`Invalid query parameters: ${validation.error.errors.map(e => e.message).join(', ')}`, 422);
    }

    const {
      query,
      location,
      experience,
      remote,
      company,
      sortBy = 'priority_level',
      sortOrder = 'asc',
      offset = 0
    } = validation.data;

    // Require authentication
    const user = requireAuth(event);

    // Get exclusive jobs
    const { data: jobs, error } = await executeQuery(async (client) => {
      let queryBuilder = client
        .from('hirebuddy_exclusive_jobs')
        .select('*', { count: 'exact' });

      if (query) {
        queryBuilder = queryBuilder.or(`job_title.ilike.%${query}%,company_name.ilike.%${query}%,job_description.ilike.%${query}%`);
      }

      if (location) {
        queryBuilder = queryBuilder.or(`job_location.ilike.%${location}%,city.ilike.%${location}%,state.ilike.%${location}%`);
      }

      if (experience && experience !== 'any') {
        queryBuilder = queryBuilder.ilike('experience_required', `%${experience}%`);
      }

      if (remote === 'remote') {
        queryBuilder = queryBuilder.eq('remote_flag', true);
      } else if (remote === 'onsite') {
        queryBuilder = queryBuilder.eq('remote_flag', false);
      }

      if (company) {
        queryBuilder = queryBuilder.ilike('company_name', `%${company}%`);
      }

      queryBuilder = queryBuilder.order(sortBy, { ascending: sortOrder === 'asc' });
      
      // Secondary sort by created_at for same priority jobs
      if (sortBy !== 'created_at') {
        queryBuilder = queryBuilder.order('created_at', { ascending: false });
      }

      return queryBuilder;
    });

    if (error) {
      console.error('Error fetching exclusive jobs:', error);
      return errorResponse('Failed to fetch exclusive jobs', 500);
    }

    return successResponse({
      jobs: jobs || [],
      pagination: {
        offset,
        total: jobs?.length || 0
      }
    }, 'Exclusive jobs retrieved successfully');

  } catch (error) {
    console.error('Get exclusive jobs error:', error);
    if (error instanceof Error && error.message === 'Authentication required') {
      return unauthorizedResponse();
    }
    return errorResponse('Internal server error', 500);
  }
}; 