import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase client with service role key for backend operations
 * This bypasses RLS and provides full database access for server-side operations
 */
export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return supabaseClient;
};

/**
 * Test database connection
 */
export const testDatabaseConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('email_database').select('id').limit(1);
    
    if (error) {
      console.error('Database connection test failed:', error);
      return { success: false, message: `Database connection failed: ${error.message}` };
    }

    return { success: true, message: 'Database connection successful' };
  } catch (error) {
    console.error('Database connection test error:', error);
    return { success: false, message: `Database connection error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
};

/**
 * Execute a query with error handling
 */
export const executeQuery = async <T>(
  queryFn: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: string | null }> => {
  try {
    const client = getSupabaseClient();
    const result = await queryFn(client);
    
    if (result.error) {
      console.error('Query error:', result.error);
      return { data: null, error: result.error.message || 'Database query failed' };
    }
    
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Query execution error:', error);
    return { data: null, error: error instanceof Error ? error.message : 'Unknown database error' };
  }
}; 