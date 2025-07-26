# HireBuddy Backend API

This is the secure backend API for the HireBuddy application, built with AWS Lambda and Serverless Framework. It provides secure access to the database without exposing credentials to the frontend.

## 🚀 Features

- **Secure Database Access**: Uses Supabase service role key for server-side operations
- **JWT Authentication**: Custom JWT tokens for API access
- **CORS Support**: Properly configured CORS for frontend integration
- **Input Validation**: Zod schema validation for all endpoints
- **Error Handling**: Comprehensive error handling and logging
- **Serverless**: Deployed on AWS Lambda for scalability and cost-effectiveness

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- AWS CLI configured with appropriate credentials
- Supabase project with service role key

## 🛠️ Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Configure the following environment variables:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_for_auth_tokens

# CORS Configuration
CORS_ORIGIN=http://localhost:5173,https://yourdomain.com

# AWS Configuration (for deployment)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
```

### 3. Build the Project

```bash
npm run build
```

## 🚀 Deployment

### Development Deployment

```bash
npm run deploy:dev
```

### Production Deployment

```bash
npm run deploy:prod
```

### Local Development

For local testing with serverless-offline:

```bash
npm run local
```

This will start the API at `http://localhost:3001`

## 📡 API Endpoints

### Authentication

- `POST /auth/login` - User login
- `POST /auth/signup` - User registration
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - User logout

### User Profile

- `GET /profile` - Get user profile
- `PUT /profile` - Update user profile
- `POST /profile/image` - Upload profile image (placeholder)
- `POST /profile/resume` - Upload resume (placeholder)

### Jobs

- `GET /jobs` - Get jobs with filtering
- `GET /jobs/{id}` - Get specific job
- `GET /jobs/remote` - Get remote jobs
- `GET /jobs/exclusive` - Get exclusive jobs

### Job Applications

- `POST /applications` - Create job application
- `GET /applications` - Get user's applications
- `PUT /applications/{id}/status` - Update application status

### Contacts

- `GET /contacts` - Get contacts
- `POST /contacts` - Create contact
- `PUT /contacts/{id}` - Update contact
- `DELETE /contacts/{id}` - Delete contact

### Email Campaigns

- `GET /campaigns` - Get campaigns
- `POST /campaigns` - Create campaign
- `POST /campaigns/{id}/send` - Send campaign emails

### Dashboard & Analytics

- `GET /dashboard/stats` - Get dashboard statistics
- `GET /dashboard/activity` - Get recent activity

### Premium Features

- `GET /premium/status` - Check premium status
- `GET /premium/data` - Get premium user data

### Email Usage

- `GET /email/usage` - Get email usage statistics
- `POST /email/increment` - Increment email count

## 🔐 Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## 📊 Response Format

All API responses follow this format:

### Success Response

```json
{
  "success": true,
  "data": {...},
  "message": "Operation successful"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message"
}
```

## 🧪 Testing

Run tests (when implemented):

```bash
npm test
```

## 📝 Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (not anon key!) | Yes |
| `JWT_SECRET` | Secret key for JWT token signing | Yes |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | No |
| `AWS_ACCESS_KEY_ID` | AWS access key for deployment | Yes (for deployment) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for deployment | Yes (for deployment) |
| `AWS_REGION` | AWS region for deployment | No (defaults to us-east-1) |

## 🔒 Security Features

- **Service Role Access**: Uses Supabase service role key for full database access
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: All inputs validated with Zod schemas
- **CORS Protection**: Configurable CORS origins
- **Error Handling**: Secure error responses without sensitive data leakage

## 🚨 Important Notes

1. **Never expose the service role key** to the frontend
2. **Use HTTPS** in production
3. **Configure CORS_ORIGIN** properly for your domain
4. **Rotate JWT_SECRET** regularly
5. **Monitor API usage** and set up alerts

## 🔧 Troubleshooting

### Common Issues

1. **"Missing Supabase configuration" Error**
   - Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set correctly

2. **CORS Errors**
   - Check `CORS_ORIGIN` includes your frontend domain
   - Ensure proper protocol (http/https)

3. **Authentication Failed**
   - Verify JWT token is being sent correctly
   - Check token hasn't expired
   - Ensure `JWT_SECRET` matches between environments

4. **Database Connection Issues**
   - Verify Supabase URL is correct
   - Check service role key has proper permissions
   - Test database connection manually

## 📞 Support

For issues and questions, please check the main project documentation or contact the development team. 