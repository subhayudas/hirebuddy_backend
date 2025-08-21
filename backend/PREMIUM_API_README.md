# Premium Users API Implementation

## Overview

This implementation provides a secure, scalable backend API for managing premium user subscriptions in the HireBuddy application. The API includes comprehensive security measures, input validation, rate limiting, and audit logging.

## Features

### 🔒 Security Features
- **JWT Authentication**: All endpoints require valid JWT tokens
- **Rate Limiting**: 100 requests/15min for users, 1000 for admins
- **Input Validation**: Comprehensive validation and sanitization
- **Suspicious Activity Detection**: Bot detection and unusual patterns
- **Admin Authorization**: Role-based access control
- **Security Headers**: XSS protection, content type options
- **Audit Logging**: All security events logged

### 🚀 API Endpoints
- `GET /premium/check` - Check premium status by email
- `GET /premium/users` - Get premium user data (with admin getAll option)
- `POST /premium/users` - Add new premium user
- `PUT /premium/users` - Update premium user data
- `DELETE /premium/users` - Remove premium user (admin only)
- `GET /premium/data` - Legacy endpoint for current user data

### 📊 Database Operations
- Full CRUD operations on `paid_users` table
- Proper error handling and validation
- Transaction safety
- Optimized queries

## Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Set required environment variables
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=your_frontend_url
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build and Deploy

```bash
# Build TypeScript
npm run build

# Deploy to development
npm run deploy:dev

# Deploy to production
npm run deploy:prod
```

### 4. Test the API

```bash
# Run all tests
npm test

# Run premium API tests only
npm run test:premium

# Run tests with coverage
npm run test:coverage
```

## API Usage Examples

### Check Premium Status

```bash
curl -X GET "https://api.example.com/dev/premium/check?email=user@example.com" \
  -H "Authorization: Bearer <token>"
```

### Add Premium User

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

### Get All Premium Users (Admin)

```bash
curl -X GET "https://api.example.com/dev/premium/users?getAll=true" \
  -H "Authorization: Bearer <token>"
```

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

## Security Implementation

### Rate Limiting

The API implements rate limiting with different limits for regular users and admins:

- **Regular Users**: 100 requests per 15 minutes
- **Admin Users**: 1000 requests per 15 minutes

Rate limit information is tracked per client (by user email or IP address).

### Input Validation

All inputs are validated and sanitized:

```typescript
// Email validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation (international format)
const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;

// Amount validation
const amount = parseFloat(data.amount);
if (isNaN(amount) || amount <= 0) {
  throw new Error('Amount must be a positive number');
}
```

### Suspicious Activity Detection

The API detects and blocks:

- Missing or suspicious User-Agent headers
- Bot-like user agents (curl, wget, python, etc.)
- High request rates
- Unusual access patterns

### Admin Authorization

Admin access is controlled through the `user_profiles` table:

```sql
SELECT is_admin FROM user_profiles WHERE email = $1
```

Only users with `is_admin = true` can:
- Get all premium users (`?getAll=true`)
- Delete premium users
- Update any user's data

## Database Schema

### paid_users Table

```sql
CREATE TABLE paid_users (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  zoom_id VARCHAR(255),
  designation VARCHAR(255),
  order_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL
);
```

### user_profiles Table (for admin access)

```sql
CREATE TABLE user_profiles (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  -- other profile fields...
);
```

## Error Handling

### Common Error Responses

| Status Code | Description | Example |
|-------------|-------------|---------|
| 400 | Bad Request | Missing required fields |
| 401 | Unauthorized | Invalid or missing token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Premium user not found |
| 409 | Conflict | User already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Database error |

### Error Response Format

```json
{
  "success": false,
  "error": "Validation failed: Email is required, Amount must be positive"
}
```

## Monitoring and Logging

### Security Events Logged

The API logs the following security events:

- `suspicious_activity_detected` - Bot detection
- `unauthorized_admin_access_attempt` - Non-admin admin access
- `unauthorized_premium_user_update_attempt` - Unauthorized updates
- `unauthorized_premium_user_deletion_attempt` - Unauthorized deletions
- `invalid_premium_user_data` - Validation failures
- `rate_limit_exceeded` - Rate limit violations

### CloudWatch Logs

All API calls and errors are logged to CloudWatch with structured data:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "message": "Premium user added successfully",
  "userId": "user@example.com",
  "requestId": "abc-123-def",
  "duration": 150
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run premium API tests only
npm run test:premium

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Coverage

The test suite covers:

- ✅ All API endpoints
- ✅ Authentication and authorization
- ✅ Input validation
- ✅ Error handling
- ✅ Security features
- ✅ Rate limiting
- ✅ Admin access control

### Manual Testing

Use the provided cURL examples or import the Postman collection for manual testing.

## Deployment

### Development Deployment

```bash
npm run deploy:dev
```

### Production Deployment

```bash
npm run deploy:prod
```

### Deploy Specific Function

```bash
npm run deploy:function -- --function premiumUsers
```

### Environment Variables

Required environment variables:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=your_frontend_url
```

## Performance Considerations

### Database Optimization

- Indexes on frequently queried fields (email, created_at)
- Efficient queries with proper WHERE clauses
- Connection pooling through Supabase

### Caching Strategy

Consider implementing caching for:
- Premium status checks (Redis/Memcached)
- Admin user permissions
- Rate limit data

### Scaling

The API is designed to scale with:
- AWS Lambda auto-scaling
- API Gateway throttling
- Database connection pooling

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Check JWT token validity
   - Verify JWT_SECRET environment variable
   - Ensure token is not expired

2. **Database Connection Issues**
   - Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
   - Check network connectivity
   - Review Supabase dashboard for errors

3. **Rate Limiting**
   - Check request frequency
   - Verify user permissions (admin vs regular)
   - Review rate limit configuration

4. **Validation Errors**
   - Check input data format
   - Verify required fields
   - Review validation rules

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=true
```

### Logs

View logs in CloudWatch or locally:

```bash
npm run logs
```

## Contributing

### Code Style

- Use TypeScript strict mode
- Follow ESLint rules
- Write comprehensive tests
- Document all public functions

### Pull Request Process

1. Create feature branch
2. Write tests for new functionality
3. Update documentation
4. Run linting and tests
5. Submit pull request

### Testing Checklist

- [ ] All tests pass
- [ ] New functionality has tests
- [ ] Security features tested
- [ ] Error handling tested
- [ ] Performance impact assessed

## Support

For support and questions:

- Check the API documentation
- Review CloudWatch logs
- Contact the development team
- Submit issues through the repository

## License

This project is licensed under the MIT License.
