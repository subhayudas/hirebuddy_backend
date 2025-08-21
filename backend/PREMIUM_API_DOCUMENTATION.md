# Premium Users API Documentation

## Overview

The Premium Users API provides secure CRUD operations for managing premium user subscriptions. All endpoints require authentication and include comprehensive security measures including rate limiting, input validation, and suspicious activity detection.

## Base URL

```
https://your-api-gateway-url.execute-api.region.amazonaws.com/dev
```

## Authentication

All endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes for regular users, 1000 for admins
- **Input Validation**: Comprehensive validation and sanitization of all inputs
- **Suspicious Activity Detection**: Bot detection and unusual request patterns
- **Admin Authorization**: Admin-only endpoints with proper access control
- **Security Headers**: XSS protection, content type options, frame options
- **Audit Logging**: All security events are logged for monitoring

## Endpoints

### 1. Check Premium Status

**GET** `/premium/check`

Check if a user is premium by email address.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | Email address to check |

#### Example Request

```bash
curl -X GET "https://api.example.com/dev/premium/check?email=user@example.com" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "isPremium": true
  },
  "message": "Premium status checked successfully"
}
```

### 2. Get Premium User Data

**GET** `/premium/users`

Get premium user data for the authenticated user or a specific email.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | No | Specific email to query (defaults to authenticated user) |
| getAll | boolean | No | Get all premium users (admin only) |

#### Example Request

```bash
# Get current user's premium data
curl -X GET "https://api.example.com/dev/premium/users" \
  -H "Authorization: Bearer <token>"

# Get specific user's premium data
curl -X GET "https://api.example.com/dev/premium/users?email=user@example.com" \
  -H "Authorization: Bearer <token>"

# Get all premium users (admin only)
curl -X GET "https://api.example.com/dev/premium/users?getAll=true" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "data": {
      "id": 1,
      "created_at": "2024-01-15T10:30:00Z",
      "email": "user@example.com",
      "name": "John Doe",
      "phone": "+1234567890",
      "zoom_id": "john.doe",
      "designation": "Software Engineer",
      "order_id": "order_123456",
      "amount": 99.99
    },
    "isPremium": true
  },
  "message": "Premium status checked successfully"
}
```

### 3. Add Premium User

**POST** `/premium/users`

Add a new premium user subscription.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | User's email address |
| name | string | Yes | User's full name |
| phone | string | No | User's phone number |
| zoom_id | string | No | User's Zoom ID |
| designation | string | No | User's job designation |
| order_id | string | Yes | Payment order ID |
| amount | number | Yes | Payment amount (must be positive) |

#### Example Request

```bash
curl -X POST "https://api.example.com/dev/premium/users" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "name": "Jane Smith",
    "phone": "+1987654321",
    "zoom_id": "jane.smith",
    "designation": "Product Manager",
    "order_id": "order_789012",
    "amount": 149.99
  }'
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "id": 2,
    "created_at": "2024-01-15T11:00:00Z",
    "email": "newuser@example.com",
    "name": "Jane Smith",
    "phone": "+1987654321",
    "zoom_id": "jane.smith",
    "designation": "Product Manager",
    "order_id": "order_789012",
    "amount": 149.99
  },
  "message": "Premium user added successfully"
}
```

### 4. Update Premium User

**PUT** `/premium/users`

Update premium user data. Users can only update their own data unless they are admins.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | number | Yes | Premium user ID |
| name | string | No | User's full name |
| phone | string | No | User's phone number |
| zoom_id | string | No | User's Zoom ID |
| designation | string | No | User's job designation |
| order_id | string | No | Payment order ID |
| amount | number | No | Payment amount (must be positive) |

#### Example Request

```bash
curl -X PUT "https://api.example.com/dev/premium/users" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "name": "John Doe Updated",
    "phone": "+1234567890",
    "designation": "Senior Software Engineer"
  }'
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "created_at": "2024-01-15T10:30:00Z",
    "email": "user@example.com",
    "name": "John Doe Updated",
    "phone": "+1234567890",
    "zoom_id": "john.doe",
    "designation": "Senior Software Engineer",
    "order_id": "order_123456",
    "amount": 99.99
  },
  "message": "Premium user updated successfully"
}
```

### 5. Delete Premium User

**DELETE** `/premium/users`

Remove a premium user subscription. Admin access required.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | number | Yes | Premium user ID to delete |

#### Example Request

```bash
curl -X DELETE "https://api.example.com/dev/premium/users?id=1" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "message": "Premium user removed successfully"
  },
  "message": "Premium user removed successfully"
}
```

### 6. Get Current User Premium Data (Legacy)

**GET** `/premium/data`

Get premium data for the authenticated user (legacy endpoint for backward compatibility).

#### Example Request

```bash
curl -X GET "https://api.example.com/dev/premium/data" \
  -H "Authorization: Bearer <token>"
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "created_at": "2024-01-15T10:30:00Z",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+1234567890",
    "zoom_id": "john.doe",
    "designation": "Software Engineer",
    "order_id": "order_123456",
    "amount": 99.99
  },
  "message": "Premium data retrieved successfully"
}
```

## Error Responses

### Common Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

### Example Error Response

```json
{
  "success": false,
  "error": "Validation failed: Email is required, Amount must be a positive number"
}
```

## Rate Limiting

- **Regular Users**: 100 requests per 15 minutes
- **Admin Users**: 1000 requests per 15 minutes
- **Rate Limit Headers**: Include remaining requests and reset time

## Input Validation

### Email Validation
- Must be a valid email format
- Automatically converted to lowercase
- Maximum length: 1000 characters

### Phone Validation
- Accepts international format
- Removes spaces, dashes, and parentheses
- Must start with + or digit

### Amount Validation
- Must be a positive number
- Automatically converted to float

### String Sanitization
- Trims whitespace
- Removes potential HTML tags
- Limits length to 1000 characters

## Security Events Logged

The API logs the following security events:

- `suspicious_activity_detected` - Bot detection or unusual patterns
- `unauthorized_admin_access_attempt` - Non-admin trying to access admin endpoints
- `unauthorized_premium_user_update_attempt` - Unauthorized update attempts
- `unauthorized_premium_user_deletion_attempt` - Unauthorized deletion attempts
- `invalid_premium_user_data` - Validation failures
- `rate_limit_exceeded` - Rate limit violations

## Frontend Integration

### Using the API Service

```typescript
import { PremiumApiService } from './premiumApiService';

const premiumService = new PremiumApiService('https://api.example.com/dev');

// Set authentication token
premiumService.setAuthToken('your-jwt-token');

// Check premium status
const isPremium = await premiumService.isPremiumUser('user@example.com');

// Get premium data
const premiumData = await premiumService.getPremiumUserData();

// Add premium user
const newUser = await premiumService.addPremiumUser({
  email: 'newuser@example.com',
  name: 'Jane Smith',
  phone: '+1987654321',
  zoom_id: 'jane.smith',
  designation: 'Product Manager',
  order_id: 'order_789012',
  amount: 149.99
});
```

### Error Handling

```typescript
try {
  const result = await premiumService.getPremiumUserData();
  if (result) {
    console.log('Premium user:', result);
  } else {
    console.log('User is not premium');
  }
} catch (error) {
  console.error('API Error:', error);
}
```

## Testing

### Test with cURL

```bash
# Test premium status check
curl -X GET "https://api.example.com/dev/premium/check?email=test@example.com" \
  -H "Authorization: Bearer <token>"

# Test adding premium user
curl -X POST "https://api.example.com/dev/premium/users" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "phone": "+1234567890",
    "zoom_id": "test.user",
    "designation": "Test Engineer",
    "order_id": "test_order_123",
    "amount": 99.99
  }'
```

### Test with Postman

1. Import the collection
2. Set the base URL variable
3. Set the auth token variable
4. Run the requests

## Monitoring and Alerts

Monitor the following metrics:

- API response times
- Error rates
- Rate limit violations
- Security events
- Admin access attempts

Set up alerts for:

- High error rates (>5%)
- Unusual traffic patterns
- Multiple failed authentication attempts
- Admin access from unusual locations

## Deployment

### Environment Variables

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=your_frontend_url
API_BASE_URL=your_api_gateway_url
```

### Deployment Commands

```bash
# Deploy to development
npm run deploy:dev

# Deploy to production
npm run deploy:prod

# Deploy specific function
npm run deploy:function -- --function premiumUsers
```

## Support

For API support and questions:

- Check the logs in CloudWatch
- Review security events
- Contact the development team
- Submit issues through the project repository
