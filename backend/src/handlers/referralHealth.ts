import { APIGatewayProxyEvent, APIGatewayProxyResult } from '../types';
import { getSupabaseClient } from '../lib/database';
import { successResponse, errorResponse, corsResponse } from '../lib/response';

/**
 * Health check for referral system database tables and functions
 */
export const referralHealthCheck = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    const supabase = getSupabaseClient();
    const healthChecks: {
      tables: { [key: string]: { status: string; error: string | null } };
      functions: { [key: string]: { status: string; error: string | null } };
      views: { [key: string]: { status: string; error: string | null } };
      triggers: { [key: string]: { status: string; error: string | null } };
      policies: { [key: string]: { status: string; error: string | null } };
      overall: string;
    } = {
      tables: {},
      functions: {},
      views: {},
      triggers: {},
      policies: {},
      overall: 'healthy'
    };

    // Test referral system tables
    try {
      const { data: referralCodesData, error: referralCodesError } = await supabase
        .from('user_referral_codes')
        .select('id')
        .limit(1);
      
      healthChecks.tables['user_referral_codes'] = {
        status: referralCodesError ? 'error' : 'healthy',
        error: referralCodesError?.message || null
      };
    } catch (error) {
      healthChecks.tables['user_referral_codes'] = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    try {
      const { data: referralsData, error: referralsError } = await supabase
        .from('referrals')
        .select('id')
        .limit(1);
      
      healthChecks.tables['referrals'] = {
        status: referralsError ? 'error' : 'healthy',
        error: referralsError?.message || null
      };
    } catch (error) {
      healthChecks.tables['referrals'] = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    try {
      const { data: referralRewardsData, error: referralRewardsError } = await supabase
        .from('referral_rewards')
        .select('id')
        .limit(1);
      
      healthChecks.tables['referral_rewards'] = {
        status: referralRewardsError ? 'error' : 'healthy',
        error: referralRewardsError?.message || null
      };
    } catch (error) {
      healthChecks.tables['referral_rewards'] = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test referral system views
    try {
      const { data: adminSummaryData, error: adminSummaryError } = await supabase
        .from('admin_referral_summary')
        .select('email')
        .limit(1);
      
      healthChecks.views['admin_referral_summary'] = {
        status: adminSummaryError ? 'error' : 'healthy',
        error: adminSummaryError?.message || null
      };
    } catch (error) {
      healthChecks.views['admin_referral_summary'] = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    try {
      const { data: statisticsData, error: statisticsError } = await supabase
        .from('referral_statistics')
        .select('total_referrals')
        .limit(1);
      
      healthChecks.views['referral_statistics'] = {
        status: statisticsError ? 'error' : 'healthy',
        error: statisticsError?.message || null
      };
    } catch (error) {
      healthChecks.views['referral_statistics'] = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    try {
      const { data: progressData, error: progressError } = await supabase
        .from('user_referral_progress')
        .select('email')
        .limit(1);
      
      healthChecks.views['user_referral_progress'] = {
        status: progressError ? 'error' : 'healthy',
        error: progressError?.message || null
      };
    } catch (error) {
      healthChecks.views['user_referral_progress'] = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test referral system functions (if accessible)
    try {
      // Test if we can call the referral functions
      const { data: functionTestData, error: functionTestError } = await supabase
        .rpc('referral_is_admin', { user_uuid: '00000000-0000-0000-0000-000000000000' });
      
      healthChecks.functions['referral_is_admin'] = {
        status: functionTestError ? 'error' : 'healthy',
        error: functionTestError?.message || null
      };
    } catch (error) {
      healthChecks.functions['referral_is_admin'] = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Check if any component is unhealthy
    const allChecks = [
      ...Object.values(healthChecks.tables),
      ...Object.values(healthChecks.views),
      ...Object.values(healthChecks.functions)
    ];
    
    const hasErrors = allChecks.some((check: { status: string; error: string | null }) => check.status === 'error');
    healthChecks.overall = hasErrors ? 'unhealthy' : 'healthy';

    const statusCode = hasErrors ? 503 : 200;

    return successResponse({
      service: 'referral-system',
      status: healthChecks.overall,
      timestamp: new Date().toISOString(),
      checks: healthChecks,
      message: hasErrors ? 'Some referral system components are unhealthy' : 'All referral system components are healthy'
    }, undefined, statusCode);

  } catch (error) {
    console.error('Error in referral health check:', error);
    return errorResponse('Referral system health check failed', 500);
  }
};

/**
 * Test referral system functionality
 */
export const testReferralSystem = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return corsResponse();
    }

    const supabase = getSupabaseClient();
    const testResults: {
      databaseConnection: string;
      tableAccess: { [key: string]: string };
      functionAccess: { [key: string]: string };
      overall: string;
    } = {
      databaseConnection: 'unknown',
      tableAccess: {},
      functionAccess: {},
      overall: 'unknown'
    };

    // Test database connection
    try {
      const { data, error } = await supabase.from('user_referral_codes').select('count').limit(1);
      testResults.databaseConnection = error ? 'failed' : 'success';
    } catch (error) {
      testResults.databaseConnection = 'failed';
    }

    // Test table access
    const tables = ['user_referral_codes', 'referrals', 'referral_rewards'];
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('id').limit(1);
        testResults.tableAccess[table] = error ? 'failed' : 'success';
      } catch (error) {
        testResults.tableAccess[table] = 'failed';
      }
    }

    // Test view access
    const views = ['admin_referral_summary', 'referral_statistics', 'user_referral_progress'];
    for (const view of views) {
      try {
        const { data, error } = await supabase.from(view).select('*').limit(1);
        testResults.tableAccess[view] = error ? 'failed' : 'success';
      } catch (error) {
        testResults.tableAccess[view] = 'failed';
      }
    }

    // Determine overall status
    const allResults = [
      testResults.databaseConnection,
      ...Object.values(testResults.tableAccess)
    ];
    
    const hasFailures = allResults.some(result => result === 'failed');
    testResults.overall = hasFailures ? 'failed' : 'success';

    const statusCode = hasFailures ? 503 : 200;

    return successResponse({
      service: 'referral-system-test',
      status: testResults.overall,
      timestamp: new Date().toISOString(),
      results: testResults,
      message: hasFailures ? 'Referral system test failed' : 'Referral system test passed'
    }, undefined, statusCode);

  } catch (error) {
    console.error('Error in referral system test:', error);
    return errorResponse('Referral system test failed', 500);
  }
};
