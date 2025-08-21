# Email Count Backend Migration Guide

## Overview
This document outlines the migration of `totalemailcounttable` operations from direct frontend database calls to a secure backend API. This improves security, centralizes business logic, and provides better error handling.

## Current State
- All `totalemailcounttable` operations are now handled through backend API endpoints
- Frontend uses HTTP requests instead of direct database calls
- Centralized validation, error handling, and business logic
- Enhanced security with proper authentication and authorization

## Migration Summary

### ✅ Completed Changes

#### 1. Backend API Implementation
- **Email handlers already exist** in `hirebuddy_backend/backend/src/handlers/email.ts`
- **Serverless configuration** already includes email endpoints in `serverless.yml`
- **API endpoints available**:
  - `GET /email/usage` - Get email usage statistics
  - `POST /email/increment` - Increment email count

#### 2. Frontend Service Updates
- **EmailCountService** updated to use API client instead of direct Supabase calls
- **DashboardService** updated to use API client for email limit checks
- **API client** already configured with email methods

#### 3. Removed Components
- **Next.js API routes** removed:
  - `pages/api/email/usage.ts` (deleted)
  - `pages/api/email/increment.ts` (deleted)

### 🔄 Migration Details

#### Frontend Service Changes

**Before (Direct Supabase calls):**
```typescript
// src/services/emailCountService.ts
const { data: existingRecord, error: selectError } = await supabase
  .from('totalemailcounttable')
  .select('*')
  .eq('user_id', user.email)
  .single();
```

**After (API client calls):**
```typescript
// src/services/emailCountService.ts
const response = await apiClient.getEmailUsage();
if (response.success && response.data) {
  const usageData = response.data as EmailUsageResponse;
  // Process usage data
}
```

#### API Response Types

```typescript
interface EmailUsageResponse {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  canSendEmail: boolean;
}

interface EmailIncrementResponse {
  previousCount: number;
  newCount: number;
  limit: number;
  remaining: number;
}
```

#### Backend Handler Structure

The backend email handlers provide:

1. **Authentication**: All requests require valid JWT tokens
2. **Input Validation**: Request bodies are validated using Zod schemas
3. **Error Handling**: Comprehensive error responses with proper HTTP status codes
4. **Rate Limiting**: Built-in rate limiting for API protection
5. **CORS Support**: Proper CORS headers for cross-origin requests

### 🔧 Backend API Endpoints

#### GET /email/usage
- **Purpose**: Get current email usage statistics
- **Authentication**: Required
- **Response**: Email usage data with used/limit/remaining counts

#### POST /email/increment
- **Purpose**: Increment email count by specified amount
- **Authentication**: Required
- **Body**: `{ count: number }` (optional, defaults to 1)
- **Response**: Updated email count data

### 🛡️ Security Features

#### Authentication & Authorization
- All endpoints require valid JWT authentication
- User can only access their own email data
- Admin users have additional privileges

#### Input Validation
```typescript
const incrementEmailSchema = z.object({
  count: z.number().min(1).optional().default(1)
});
```

#### Rate Limiting
- Built-in rate limiting to prevent abuse
- Admin users have higher rate limits
- Suspicious activity detection

#### Error Handling
- Comprehensive error responses
- Proper HTTP status codes
- Detailed error messages for debugging

### 📊 Database Schema

The `totalemailcounttable` remains unchanged:

```sql
CREATE TABLE public.totalemailcounttable (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  total_count integer NULL DEFAULT 0,
  user_id character varying NULL,
  email_limit integer NULL DEFAULT 125,
  CONSTRAINT totalemailcounttable_pkey PRIMARY KEY (id)
);
```

### 🔄 Migration Benefits

#### Security Improvements
- **No direct database access** from frontend
- **Centralized authentication** and authorization
- **Input validation** and sanitization
- **Rate limiting** and abuse prevention

#### Performance Benefits
- **Reduced database connections** from frontend
- **Caching opportunities** at API level
- **Optimized queries** in backend handlers

#### Maintainability
- **Centralized business logic** in backend
- **Consistent error handling** across all email operations
- **Easier debugging** with structured logging
- **API versioning** support for future changes

### 🚀 Deployment

#### Backend Deployment
The email endpoints are already deployed as part of the AWS Lambda functions:

```bash
cd hirebuddy_backend/backend
npm run deploy
```

#### Frontend Deployment
The frontend changes are automatically deployed when the code is pushed to the main branch.

### 🔍 Testing

#### API Testing
Test the email endpoints using the AWS API Gateway console or tools like Postman:

```bash
# Get email usage
curl -X GET "https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev/email/usage" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Increment email count
curl -X POST "https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev/email/increment" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"count": 1}'
```

#### Frontend Testing
- Test email usage display in dashboard
- Test email increment functionality
- Verify error handling for rate limits and authentication

### 📝 Future Enhancements

#### Planned API Endpoints
- `PUT /email/reset` - Reset email count to zero
- `PUT /email/limit` - Update email limit for user
- `GET /email/history` - Get email sending history

#### Monitoring & Analytics
- Email usage analytics dashboard
- Rate limiting metrics
- Error rate monitoring

### 🐛 Troubleshooting

#### Common Issues

1. **Authentication Errors**
   - Ensure JWT token is valid and not expired
   - Check token format in Authorization header

2. **Rate Limiting**
   - Reduce request frequency
   - Check if user has admin privileges

3. **Input Validation Errors**
   - Ensure count is a positive number
   - Check request body format

#### Debug Information
- Backend logs available in AWS CloudWatch
- Frontend console logs for API call debugging
- Network tab in browser dev tools for request/response inspection

### 📚 Related Documentation

- [Paid Users Backend Migration](./PAID_USERS_BACKEND_MIGRATION.md)
- [Backend API Documentation](./hirebuddy_backend/backend/PREMIUM_API_README.md)
- [Security Audit](./hirebuddy_backend/backend/SECURITY_AUDIT.md)

---

**Migration Status**: ✅ Complete
**Last Updated**: January 2025
**Maintainer**: Development Team
