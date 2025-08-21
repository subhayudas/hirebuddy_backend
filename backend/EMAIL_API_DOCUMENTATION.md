# Email API Documentation

## Overview
The Email API provides endpoints for managing email usage tracking and limits for users. All endpoints require authentication and provide comprehensive error handling.

## Base URL
```
https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev
```

## Authentication
All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### GET /email/usage

Retrieves the current email usage statistics for the authenticated user.

**Request:**
```http
GET /email/usage
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "used": 50,
    "limit": 125,
    "remaining": 75,
    "percentage": 40,
    "canSendEmail": true
  },
  "message": "Email usage retrieved successfully"
}
```

**Response Fields:**
- `used`: Number of emails sent so far
- `limit`: Total email limit for the user (default: 125)
- `remaining`: Number of emails remaining
- `percentage`: Percentage of limit used (0-100)
- `canSendEmail`: Boolean indicating if user can send more emails

**Error Responses:**
- `401 Unauthorized`: Invalid or missing authentication token
- `500 Internal Server Error`: Database or server error

### POST /email/increment

Increments the email count for the authenticated user.

**Request:**
```http
POST /email/increment
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "count": 1
}
```

**Request Body:**
- `count` (optional): Number to increment by (default: 1, minimum: 1)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "previousCount": 50,
    "newCount": 51,
    "limit": 125,
    "remaining": 74,
    "canSendEmail": true
  },
  "message": "Email count incremented successfully"
}
```

**Response Fields:**
- `previousCount`: Email count before increment
- `newCount`: Email count after increment
- `limit`: Total email limit for the user
- `remaining`: Number of emails remaining after increment
- `canSendEmail`: Boolean indicating if user can send more emails

**Error Responses:**
- `400 Bad Request`: Missing request body
- `401 Unauthorized`: Invalid or missing authentication token
- `422 Unprocessable Entity`: Invalid count value (must be >= 1)
- `500 Internal Server Error`: Database or server error

## Database Schema

The API uses the `totalemailcounttable` with the following schema:

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

## Usage Examples

### JavaScript/TypeScript

```typescript
// Get email usage
const getEmailUsage = async (token: string) => {
  const response = await fetch('https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev/email/usage', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.json();
};

// Increment email count
const incrementEmailCount = async (token: string, count: number = 1) => {
  const response = await fetch('https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev/email/increment', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ count })
  });
  
  return response.json();
};

// Usage example
const token = 'your-jwt-token';

// Check current usage
const usage = await getEmailUsage(token);
console.log(`Used: ${usage.data.used}/${usage.data.limit} emails`);

// Send an email and increment count
if (usage.data.canSendEmail) {
  // Send email logic here...
  
  // Increment count
  const increment = await incrementEmailCount(token, 1);
  console.log(`Email count updated: ${increment.data.newCount}`);
}
```

### cURL

```bash
# Get email usage
curl -X GET "https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev/email/usage" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Increment email count by 1
curl -X POST "https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev/email/increment" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"count": 1}'

# Increment email count by 5
curl -X POST "https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev/email/increment" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"count": 5}'
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common error scenarios:
- **Authentication errors**: Invalid or expired JWT token
- **Validation errors**: Invalid request parameters
- **Database errors**: Connection or query failures
- **Rate limiting**: Too many requests (if configured)

## Rate Limiting

The API includes built-in rate limiting to prevent abuse:
- Standard users: 100 requests per minute
- Admin users: 500 requests per minute

## CORS Support

All endpoints support CORS for cross-origin requests:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Testing

Run the email API tests:

```bash
npm run test:email
```

## Deployment

The email endpoints are deployed as part of the AWS Lambda functions:

```bash
cd backend
npm run deploy
```

## Monitoring

Email API usage is logged to AWS CloudWatch:
- Request/response logs
- Error tracking
- Performance metrics
- Rate limiting events

## Security

- All endpoints require JWT authentication
- Input validation using Zod schemas
- SQL injection protection via parameterized queries
- Rate limiting to prevent abuse
- CORS configuration for secure cross-origin requests
