# Paid Users Backend Migration Guide

## Overview
This document outlines the migration of `paid_users` table operations from direct frontend database calls to a secure backend API. This improves security, centralizes business logic, and provides better error handling.

## Current State
- All `paid_users` operations are currently made directly from the frontend using Supabase client
- Operations are scattered across `premiumService.ts` and some API endpoints
- Security relies on Row Level Security (RLS) policies

## Target State
- All `paid_users` operations will go through backend API endpoints
- Frontend will use HTTP requests instead of direct database calls
- Centralized validation, error handling, and business logic
- Enhanced security with proper authentication and authorization

## Backend API Implementation

### 1. Create API Endpoints

Create the following API endpoints in `pages/api/premium/`:

#### 1.1 `pages/api/premium/users/index.ts` - Main CRUD operations

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get the current user for authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userEmail = user.email;

  switch (req.method) {
    case 'GET':
      return handleGet(req, res, userEmail);
    case 'POST':
      return handlePost(req, res, userEmail);
    case 'PUT':
      return handlePut(req, res, userEmail);
    case 'DELETE':
      return handleDelete(req, res, userEmail);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// GET - Check premium status or get user data
async function handleGet(req: NextApiRequest, res: NextApiResponse, userEmail: string) {
  try {
    const { email, getAll } = req.query;

    // Admin endpoint to get all premium users
    if (getAll === 'true') {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('email', user?.email)
        .single();

      if (!profile?.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { data, error } = await supabase
        .from('paid_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all premium users:', error);
        return res.status(500).json({ error: 'Failed to fetch premium users' });
      }

      return res.status(200).json({
        success: true,
        data: data || []
      });
    }

    // Get specific user data or check status
    const targetEmail = email as string || userEmail;
    
    const { data, error } = await supabase
      .from('paid_users')
      .select('*')
      .eq('email', targetEmail)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching premium user:', error);
      return res.status(500).json({ error: 'Failed to fetch premium user' });
    }

    return res.status(200).json({
      success: true,
      data: data || null,
      isPremium: !!data
    });

  } catch (error) {
    console.error('Error in GET premium users:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST - Add new premium user
async function handlePost(req: NextApiRequest, res: NextApiResponse, userEmail: string) {
  try {
    const userData = req.body;

    // Validate required fields
    if (!userData.email || !userData.name || !userData.order_id || !userData.amount) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, name, order_id, amount' 
      });
    }

    // Ensure amount is positive
    if (userData.amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('paid_users')
      .select('id')
      .eq('email', userData.email)
      .single();

    if (existingUser) {
      return res.status(409).json({ error: 'Premium user already exists' });
    }

    // Insert new premium user
    const { data, error } = await supabase
      .from('paid_users')
      .insert([userData])
      .select()
      .single();

    if (error) {
      console.error('Error adding premium user:', error);
      return res.status(500).json({ error: 'Failed to add premium user' });
    }

    return res.status(201).json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Error in POST premium users:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT - Update premium user
async function handlePut(req: NextApiRequest, res: NextApiResponse, userEmail: string) {
  try {
    const { id, ...updates } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('paid_users')
      .select('id, email')
      .eq('id', id)
      .single();

    if (!existingUser) {
      return res.status(404).json({ error: 'Premium user not found' });
    }

    // Check admin access or own user access
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('email', userEmail)
      .single();

    if (!profile?.is_admin && existingUser.email !== userEmail) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update user
    const { data, error } = await supabase
      .from('paid_users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating premium user:', error);
      return res.status(500).json({ error: 'Failed to update premium user' });
    }

    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Error in PUT premium users:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE - Remove premium user
async function handleDelete(req: NextApiRequest, res: NextApiResponse, userEmail: string) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('paid_users')
      .select('id, email')
      .eq('id', id)
      .single();

    if (!existingUser) {
      return res.status(404).json({ error: 'Premium user not found' });
    }

    // Check admin access
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('email', userEmail)
      .single();

    if (!profile?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Delete user
    const { error } = await supabase
      .from('paid_users')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error removing premium user:', error);
      return res.status(500).json({ error: 'Failed to remove premium user' });
    }

    return res.status(200).json({
      success: true,
      message: 'Premium user removed successfully'
    });

  } catch (error) {
    console.error('Error in DELETE premium users:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

#### 1.2 `pages/api/premium/check.ts` - Quick premium status check

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    const { data, error } = await supabase
      .from('paid_users')
      .select('id')
      .eq('email', email as string)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking premium status:', error);
      return res.status(500).json({ error: 'Failed to check premium status' });
    }

    return res.status(200).json({
      success: true,
      isPremium: !!data
    });

  } catch (error) {
    console.error('Error in premium check API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 2. Update Existing API Endpoints

#### 2.1 Update `pages/api/premium/status.ts`

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userEmail = user.email;

    if (!userEmail) {
      return res.status(400).json({ error: 'User email not found' });
    }

    // Check if user is premium
    const { data: premiumUser, error: premiumError } = await supabase
      .from('paid_users')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (premiumError && premiumError.code !== 'PGRST116') {
      console.error('Error checking premium status:', premiumError);
      return res.status(500).json({ error: 'Failed to check premium status' });
    }

    const isPremium = !!premiumUser;

    return res.status(200).json({
      success: true,
      data: {
        isPremium,
        email: userEmail
      }
    });

  } catch (error) {
    console.error('Error in premium status API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

## Frontend Changes

### 1. Create New API Service

Create `src/services/premiumApiService.ts`:

```typescript
import { PremiumUser } from './premiumService';

const API_BASE = '/api/premium';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export const premiumApiService = {
  /**
   * Check if a user is premium by email
   */
  async isPremiumUser(email: string): Promise<boolean> {
    if (!email) return false;
    
    try {
      const response = await fetch(`${API_BASE}/check?email=${encodeURIComponent(email)}`);
      const result: ApiResponse<{ isPremium: boolean }> = await response.json();
      
      if (!result.success) {
        console.error('Error checking premium status:', result.error);
        return false;
      }

      return result.data?.isPremium || false;
    } catch (error) {
      console.error('Error checking premium status:', error);
      return false;
    }
  },

  /**
   * Get premium user data by email
   */
  async getPremiumUserData(email: string): Promise<PremiumUser | null> {
    if (!email) return null;
    
    try {
      const response = await fetch(`${API_BASE}/users?email=${encodeURIComponent(email)}`);
      const result: ApiResponse<PremiumUser> = await response.json();
      
      if (!result.success) {
        console.error('Error fetching premium user data:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('Error fetching premium user data:', error);
      return null;
    }
  },

  /**
   * Get all premium users (admin only)
   */
  async getAllPremiumUsers(): Promise<PremiumUser[]> {
    try {
      const response = await fetch(`${API_BASE}/users?getAll=true`);
      const result: ApiResponse<PremiumUser[]> = await response.json();
      
      if (!result.success) {
        console.error('Error fetching all premium users:', result.error);
        return [];
      }

      return result.data || [];
    } catch (error) {
      console.error('Error fetching all premium users:', error);
      return [];
    }
  },

  /**
   * Add a new premium user
   */
  async addPremiumUser(userData: Omit<PremiumUser, 'id' | 'created_at'>): Promise<PremiumUser | null> {
    try {
      const response = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const result: ApiResponse<PremiumUser> = await response.json();
      
      if (!result.success) {
        console.error('Error adding premium user:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('Error adding premium user:', error);
      return null;
    }
  },

  /**
   * Update premium user data
   */
  async updatePremiumUser(id: number, updates: Partial<Omit<PremiumUser, 'id' | 'created_at'>>): Promise<PremiumUser | null> {
    try {
      const response = await fetch(`${API_BASE}/users`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, ...updates }),
      });

      const result: ApiResponse<PremiumUser> = await response.json();
      
      if (!result.success) {
        console.error('Error updating premium user:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('Error updating premium user:', error);
      return null;
    }
  },

  /**
   * Remove premium user
   */
  async removePremiumUser(id: number): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/users?id=${id}`, {
        method: 'DELETE',
      });

      const result: ApiResponse<{ message: string }> = await response.json();
      
      if (!result.success) {
        console.error('Error removing premium user:', result.error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error removing premium user:', error);
      return false;
    }
  }
};
```

### 2. Update Premium Service

Update `src/services/premiumService.ts` to use the new API service:

```typescript
import { premiumApiService } from './premiumApiService';

export interface PremiumUser {
  id: number;
  created_at: string;
  email: string;
  name: string;
  phone: string;
  zoom_id: string;
  designation: string;
  order_id: string;
  amount: number;
}

// Re-export the API service as the main premium service
export const premiumService = premiumApiService;
```

### 3. Update usePremiumUser Hook

Update `src/hooks/usePremiumUser.ts`:

```typescript
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { premiumService, PremiumUser } from '@/services/premiumService';

import { log, warn, error, info, debug } from '@/utils/logger';

export interface UsePremiumUserReturn {
  isPremium: boolean;
  premiumData: PremiumUser | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const usePremiumUser = (): UsePremiumUserReturn => {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [premiumData, setPremiumData] = useState<PremiumUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkPremiumStatus = async () => {
    if (!user?.email) {
      setIsPremium(false);
      setPremiumData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check if user is premium
      const isPremiumUser = await premiumService.isPremiumUser(user.email);
      setIsPremium(isPremiumUser);

      // If premium, fetch full premium data
      if (isPremiumUser) {
        const data = await premiumService.getPremiumUserData(user.email);
        setPremiumData(data);
      } else {
        setPremiumData(null);
      }
    } catch (err) {
      error('Error checking premium status:', err);
      setError('Failed to check premium status');
      setIsPremium(false);
      setPremiumData(null);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    await checkPremiumStatus();
  };

  useEffect(() => {
    checkPremiumStatus();
  }, [user?.email]);

  return {
    isPremium,
    premiumData,
    loading,
    error,
    refetch
  };
};
```

### 4. Update Components

Update any components that directly use the premium service. For example, in `src/pages/PremiumTest.tsx`:

```typescript
// The component should work without changes since we're maintaining the same interface
// Just ensure it imports from the updated service
import { premiumService } from "@/services/premiumService";
```

## Migration Steps

### Phase 1: Backend Implementation
1. Create the new API endpoints in `pages/api/premium/`
2. Test the endpoints with Postman or similar tool
3. Verify authentication and authorization work correctly

### Phase 2: Frontend Service Layer
1. Create the new `premiumApiService.ts`
2. Update `premiumService.ts` to use the API service
3. Test the service layer in isolation

### Phase 3: Integration
1. Update the `usePremiumUser` hook
2. Test the complete flow from frontend to backend
3. Verify all existing functionality works

### Phase 4: Cleanup
1. Remove direct database calls from frontend
2. Update any remaining components that might be using direct database access
3. Test thoroughly in development environment

## Benefits

1. **Security**: Database credentials are no longer exposed to the frontend
2. **Centralized Logic**: All business logic is in one place
3. **Better Error Handling**: Consistent error responses across all operations
4. **Validation**: Server-side validation prevents invalid data
5. **Audit Trail**: All operations go through the API, making them easier to log and monitor
6. **Scalability**: Easier to add caching, rate limiting, and other features

## Testing Checklist

- [ ] Premium status check works for authenticated users
- [ ] Premium status check works for non-authenticated users
- [ ] Adding premium users works correctly
- [ ] Updating premium users works for admins
- [ ] Deleting premium users works for admins only
- [ ] Error handling works for invalid requests
- [ ] Authentication/authorization works correctly
- [ ] All existing frontend functionality continues to work

## Testing the Migration

### 1. Use the Test Component
A test component has been created at `/premium-service-test` to verify the migration:

1. Navigate to `http://localhost:3000/premium-service-test`
2. Sign in with a test account
3. Use the test buttons to verify all operations work
4. Check the test results for any errors

### 2. Feature Flag Testing
The migration includes a feature flag system:

- Set `USE_API_PREMIUM_SERVICE: true` in `src/config/featureFlags.ts` to use the new API
- Set `USE_API_PREMIUM_SERVICE: false` to fall back to the old direct database service
- This allows easy rollback if issues are discovered

### 3. API Endpoint Testing
Test the API endpoints directly:

```bash
# Test premium status check
curl "http://localhost:3000/api/premium/check?email=test@example.com"

# Test getting user data
curl "http://localhost:3000/api/premium/users?email=test@example.com"

# Test adding premium user (requires authentication)
curl -X POST "http://localhost:3000/api/premium/users" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","phone":"+1234567890","zoom_id":"test","designation":"Engineer","order_id":"test-123","amount":99.99}'
```

## Rollback Plan

If issues arise during migration:

1. Keep the old `premiumService.ts` as backup
2. Add a feature flag to switch between old and new implementations
3. Monitor error rates and performance
4. Have a quick rollback mechanism ready

## Notes

- The existing RLS policies will still provide an additional layer of security
- Consider adding rate limiting to the API endpoints
- Add proper logging for all API operations
- Consider adding caching for frequently accessed data
- Monitor API performance and add metrics as needed
