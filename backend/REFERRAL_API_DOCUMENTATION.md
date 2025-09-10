# 🎯 HireBuddy Referral System API Documentation

## 📋 Overview

The HireBuddy Referral System API provides comprehensive endpoints for managing user referrals, tracking progress, and administering the referral program. This system allows users to refer friends and earn premium access after reaching 10 successful referrals.

## 🔗 Base URL

```
Production: https://your-api-gateway-url.amazonaws.com/dev
Development: http://localhost:3001
```

## 🔐 Authentication

Most endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## 📊 API Endpoints

### 1. Generate Referral Code

**POST** `/referral/generate-code`

Generates a unique referral code for the authenticated user.

#### Request
```json
{
  "userId": "optional-user-id" // Optional, uses auth.uid() if not provided
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "referralCode": "HB-A1B2C3D4",
    "message": "Referral code generated successfully",
    "isNew": true,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Error Responses
- `401 Unauthorized` - Authentication required
- `422 Unprocessable Entity` - Validation failed
- `500 Internal Server Error` - Server error

---

### 2. Apply Referral Code

**POST** `/referral/apply-code`

Applies a referral code during user signup.

#### Request
```json
{
  "referralCode": "HB-A1B2C3D4",
  "userEmail": "newuser@example.com",
  "userId": "optional-user-id" // Optional
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "referralId": "referral-uuid",
    "message": "Referral code applied successfully",
    "referrerId": "referrer-user-id",
    "expiresAt": "2024-01-31T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Error Responses
- `400 Bad Request` - Invalid referral code, self-referral, or email already referred
- `422 Unprocessable Entity` - Validation failed
- `500 Internal Server Error` - Server error

---

### 3. Get Referral Statistics

**GET** `/referral/stats`

Retrieves comprehensive referral statistics for the authenticated user.

#### Response
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "referralCode": "HB-A1B2C3D4",
      "codeCreatedAt": "2024-01-01T00:00:00Z"
    },
    "rewards": {
      "completedReferrals": 5,
      "premiumGranted": false,
      "premiumGrantedAt": null,
      "premiumExpiresAt": null
    },
    "statistics": {
      "totalReferrals": 8,
      "completedReferrals": 5,
      "pendingReferrals": 2,
      "expiredReferrals": 1,
      "referralsNeededForPremium": 5,
      "progressPercentage": 50
    },
    "referrals": [
      {
        "id": "referral-uuid",
        "referred_email": "user1@example.com",
        "status": "completed",
        "created_at": "2024-01-01T00:00:00Z",
        "completed_at": "2024-01-02T00:00:00Z"
      }
    ]
  }
}
```

#### Error Responses
- `401 Unauthorized` - Authentication required
- `500 Internal Server Error` - Server error

---

### 4. Get Referral Progress

**GET** `/referral/progress`

Retrieves simplified referral progress for the authenticated user.

#### Response
```json
{
  "success": true,
  "data": {
    "progress": {
      "email": "user@example.com",
      "completed_referrals": 5,
      "progress_status": "Halfway!",
      "referrals_needed_for_premium": 5
    }
  }
}
```

#### Error Responses
- `401 Unauthorized` - Authentication required
- `500 Internal Server Error` - Server error

---

### 5. Complete Referral

**POST** `/referral/complete`

Marks a referral as completed when the referred user finishes onboarding.

#### Request
```json
{
  "referralId": "referral-uuid",
  "completedBy": "optional-user-id" // Optional, uses auth.uid() if not provided
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "referral": {
      "id": "referral-uuid",
      "referrer_id": "referrer-uuid",
      "referred_email": "user@example.com",
      "status": "completed",
      "created_at": "2024-01-01T00:00:00Z",
      "completed_at": "2024-01-02T00:00:00Z",
      "expires_at": "2024-01-31T00:00:00Z"
    },
    "message": "Referral completed successfully"
  }
}
```

#### Error Responses
- `400 Bad Request` - Referral not found, already completed, or expired
- `401 Unauthorized` - Authentication required
- `422 Unprocessable Entity` - Validation failed
- `500 Internal Server Error` - Server error

---

### 6. Get Admin Referral Statistics

**GET** `/referral/admin/stats`

Retrieves system-wide referral statistics (Admin only).

#### Response
```json
{
  "success": true,
  "data": {
    "summary": [
      {
        "email": "user1@example.com",
        "completed_referrals": 10,
        "premium_granted": true,
        "premium_granted_at": "2024-01-15T00:00:00Z",
        "premium_expires_at": "2024-02-15T00:00:00Z",
        "total_referrals": 12,
        "completed_count": 10,
        "pending_count": 2,
        "expired_count": 0
      }
    ],
    "statistics": {
      "total_referrals": 100,
      "completed_referrals": 50,
      "pending_referrals": 30,
      "expired_referrals": 20,
      "unique_referrers": 25,
      "unique_referred_emails": 80
    },
    "message": "Admin referral statistics retrieved successfully"
  }
}
```

#### Error Responses
- `401 Unauthorized` - Authentication required or admin access required
- `500 Internal Server Error` - Server error

---

### 7. Validate Referral Code

**GET** `/referral/validate?code=HB-A1B2C3D4`

Validates a referral code format and availability (Public endpoint).

#### Query Parameters
- `code` (required) - The referral code to validate

#### Response
```json
{
  "success": true,
  "data": {
    "valid": true,
    "referralCode": "HB-A1B2C3D4",
    "message": "Referral code is valid"
  }
}
```

#### Error Responses
- `400 Bad Request` - Referral code required or invalid format
- `500 Internal Server Error` - Server error

---

## 🔄 Integration Flow

### 1. User Signup with Referral Code

```javascript
// Frontend: Apply referral code during signup
const applyReferralCode = async (referralCode, userEmail) => {
  const response = await fetch('/referral/apply-code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      referralCode,
      userEmail
    })
  });
  
  return response.json();
};
```

### 2. Generate Referral Code for User

```javascript
// Frontend: Generate referral code for authenticated user
const generateReferralCode = async () => {
  const response = await fetch('/referral/generate-code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};
```

### 3. Track Referral Progress

```javascript
// Frontend: Get user's referral statistics
const getReferralStats = async () => {
  const response = await fetch('/referral/stats', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};
```

### 4. Complete Referral

```javascript
// Backend: Mark referral as completed when user finishes onboarding
const completeReferral = async (referralId) => {
  const response = await fetch('/referral/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      referralId
    })
  });
  
  return response.json();
};
```

---

## 🛡️ Security Features

### 1. Row Level Security (RLS)
- Users can only access their own referral data
- Admins have oversight capabilities
- System operations are protected

### 2. Anti-Fraud Measures
- Self-referral prevention
- Duplicate email protection
- Referral code validation
- Automatic expiration (30 days)

### 3. Input Validation
- Referral code format validation (`HB-XXXXXXXX`)
- Email format validation
- UUID validation for user IDs
- SQL injection prevention

---

## 📈 Business Logic

### 1. Referral Code Format
- Format: `HB-XXXXXXXX` (8 random hex characters)
- One active code per user
- Codes are case-insensitive

### 2. Referral Lifecycle
1. **Pending** - Referral created, waiting for completion
2. **Completed** - Referred user finished onboarding
3. **Expired** - Referral expired after 30 days

### 3. Premium Access
- Granted automatically at 10 completed referrals
- Premium expires after 30 days (configurable)
- Tracked in `referral_rewards` table

### 4. Expiration Rules
- Referrals expire after 30 days if not completed
- Expired referrals cannot be completed
- System automatically marks expired referrals

---

## 🧪 Testing

### Unit Tests
Run the referral system tests:

```bash
npm test src/tests/referral.test.ts
```

### Test Coverage
- API endpoint functionality
- Database operations
- Error handling
- Authentication and authorization
- Input validation

---

## 🚀 Deployment

### 1. Build the Project
```bash
npm run build
```

### 2. Deploy to AWS
```bash
npm run deploy:dev    # Deploy to development
npm run deploy:prod   # Deploy to production
```

### 3. Environment Variables
Ensure these environment variables are set:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `CORS_ORIGIN`

---

## 📊 Monitoring

### 1. Health Checks
- Database connectivity
- API endpoint availability
- Authentication system

### 2. Metrics to Monitor
- Referral conversion rates
- API response times
- Error rates
- Premium activation rates

### 3. Admin Dashboard
Use the admin endpoints to monitor:
- System-wide statistics
- User progress
- Fraud detection
- Performance metrics

---

## 🔧 Troubleshooting

### Common Issues

#### 1. "Invalid referral code format"
- Ensure code follows `HB-XXXXXXXX` format
- Check for typos in the code

#### 2. "Cannot refer yourself"
- User cannot use their own referral code
- Check email addresses match

#### 3. "This email has already been referred"
- Each email can only be referred once
- Check for duplicate referrals

#### 4. "Referral has expired"
- Referrals expire after 30 days
- Cannot complete expired referrals

#### 5. "Authentication required"
- Ensure JWT token is valid
- Check Authorization header format

### Debug Mode
Enable debug logging by setting:
```bash
DEBUG=referral:*
```

---

## 📚 Related Documentation

- [Database Schema](../REFERRAL_SYSTEM_README.md)
- [Security Implementation](../SECURITY_AUDIT.md)
- [Frontend Integration Guide](../FRONTEND_INTEGRATION_EXAMPLE.md)

---

## 🆘 Support

For technical support or questions:
1. Check the troubleshooting section
2. Review the test cases
3. Check server logs for detailed error messages
4. Verify database connectivity and permissions

---

**Built with ❤️ for HireBuddy**
**Production-ready referral system with comprehensive security and monitoring**
