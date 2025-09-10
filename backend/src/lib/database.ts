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
    
    // Test email_database table
    const { data: emailData, error: emailError } = await client.from('email_database').select('id').limit(1);
    
    if (emailError) {
      console.error('Email database connection test failed:', emailError);
      return { success: false, message: `Email database connection failed: ${emailError.message}` };
    }

    // Test paid_users table
    const { data: paidUsersData, error: paidUsersError } = await client.from('paid_users').select('id').limit(1);
    
    if (paidUsersError) {
      console.error('Paid users table connection test failed:', paidUsersError);
      return { success: false, message: `Paid users table connection failed: ${paidUsersError.message}` };
    }

    // Test totalemailcounttable
    const { data: emailCountData, error: emailCountError } = await client.from('totalemailcounttable').select('id').limit(1);
    
    if (emailCountError) {
      console.error('Total email count table connection test failed:', emailCountError);
      return { success: false, message: `Total email count table connection failed: ${emailCountError.message}` };
    }

    // Test referral system tables
    const { data: referralCodesData, error: referralCodesError } = await client.from('user_referral_codes').select('id').limit(1);
    
    if (referralCodesError) {
      console.error('User referral codes table connection test failed:', referralCodesError);
      return { success: false, message: `User referral codes table connection failed: ${referralCodesError.message}` };
    }

    const { data: referralsData, error: referralsError } = await client.from('referrals').select('id').limit(1);
    
    if (referralsError) {
      console.error('Referrals table connection test failed:', referralsError);
      return { success: false, message: `Referrals table connection failed: ${referralsError.message}` };
    }

    const { data: referralRewardsData, error: referralRewardsError } = await client.from('referral_rewards').select('id').limit(1);
    
    if (referralRewardsError) {
      console.error('Referral rewards table connection test failed:', referralRewardsError);
      return { success: false, message: `Referral rewards table connection failed: ${referralRewardsError.message}` };
    }

    return { success: true, message: 'Database connection successful (all tables accessible including referral system)' };
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