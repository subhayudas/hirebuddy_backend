# 🚀 HireBuddy Referral System - Deployment Guide

## 📋 Pre-Deployment Checklist

### ✅ Database Setup
- [ ] Run `00_referral_setup_master.sql` in your Supabase database
- [ ] Verify all tables, functions, triggers, and RLS policies are created
- [ ] Test database connectivity from your backend

### ✅ Environment Variables
Ensure these are set in your deployment environment:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=your_frontend_domain
```

### ✅ Code Review
- [ ] All referral endpoints implemented
- [ ] Unit tests passing
- [ ] No linting errors
- [ ] TypeScript compilation successful

## 🚀 Deployment Steps

### 1. Build the Project
```bash
cd backend
npm install
npm run build
```

### 2. Run Tests
```bash
npm test src/tests/referral.test.ts
npm run test:coverage
```

### 3. Deploy to Development
```bash
npm run deploy:dev
```

### 4. Test Development Deployment
```bash
# Test referral code generation
curl -X POST https://your-dev-api.amazonaws.com/dev/referral/generate-code \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Test referral code validation
curl "https://your-dev-api.amazonaws.com/dev/referral/validate?code=HB-A1B2C3D4"
```

### 5. Deploy to Production
```bash
npm run deploy:prod
```

## 🧪 Post-Deployment Testing

### 1. API Endpoint Tests
Test all referral endpoints:

```bash
# 1. Generate referral code
curl -X POST https://your-api.amazonaws.com/prod/referral/generate-code \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# 2. Apply referral code
curl -X POST https://your-api.amazonaws.com/prod/referral/apply-code \
  -H "Content-Type: application/json" \
  -d '{"referralCode": "HB-A1B2C3D4", "userEmail": "test@example.com"}'

# 3. Get referral stats
curl -X GET https://your-api.amazonaws.com/prod/referral/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 4. Validate referral code
curl "https://your-api.amazonaws.com/prod/referral/validate?code=HB-A1B2C3D4"

# 5. Complete referral
curl -X POST https://your-api.amazonaws.com/prod/referral/complete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"referralId": "referral-uuid"}'

# 6. Admin stats (admin user only)
curl -X GET https://your-api.amazonaws.com/prod/referral/admin/stats \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

### 2. Database Verification
Run these queries in your Supabase SQL editor:

```sql
-- Check if all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_referral_codes', 'referrals', 'referral_rewards');

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('user_referral_codes', 'referrals', 'referral_rewards');

-- Check if views exist
SELECT viewname FROM pg_views 
WHERE viewname IN ('admin_referral_summary', 'referral_statistics', 'user_referral_progress');

-- Test referral code generation
SELECT referral_generate_code('test-user-id');

-- Test admin summary view
SELECT * FROM admin_referral_summary LIMIT 5;
```

### 3. Integration Tests
Test the complete referral flow:

1. **User A** generates a referral code
2. **User B** signs up using User A's referral code
3. **User B** completes onboarding
4. **User A** gets credit for the referral
5. **User A** reaches 10 referrals and gets premium access

## 📊 Monitoring Setup

### 1. CloudWatch Logs
Monitor these log patterns:
- `Error in generateReferralCode`
- `Error in applyReferralCode`
- `Error in completeReferral`
- `Authentication required`
- `Admin access required`

### 2. Key Metrics to Monitor
- API response times
- Error rates by endpoint
- Referral conversion rates
- Premium activation rates
- Database connection health

### 3. Alerts Setup
Set up alerts for:
- High error rates (>5%)
- Slow response times (>2 seconds)
- Database connection failures
- Authentication failures

## 🔧 Troubleshooting

### Common Deployment Issues

#### 1. Database Connection Errors
```bash
# Check environment variables
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Test database connection
curl -X GET https://your-api.amazonaws.com/prod/health/db
```

#### 2. CORS Issues
```bash
# Check CORS_ORIGIN environment variable
echo $CORS_ORIGIN

# Test CORS preflight
curl -X OPTIONS https://your-api.amazonaws.com/prod/referral/generate-code \
  -H "Origin: https://your-frontend-domain.com"
```

#### 3. Authentication Issues
```bash
# Verify JWT_SECRET is set
echo $JWT_SECRET

# Test authentication endpoint
curl -X POST https://your-api.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'
```

#### 4. RLS Policy Issues
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'user_referral_codes';
SELECT * FROM pg_policies WHERE tablename = 'referrals';
SELECT * FROM pg_policies WHERE tablename = 'referral_rewards';

-- Test RLS with service role
SET ROLE service_role;
SELECT * FROM user_referral_codes LIMIT 1;
```

## 🚀 Performance Optimization

### 1. Database Indexes
Verify these indexes exist:
```sql
-- Check indexes
SELECT indexname, tablename FROM pg_indexes 
WHERE tablename IN ('user_referral_codes', 'referrals', 'referral_rewards');
```

### 2. Lambda Configuration
Optimize Lambda settings:
- Memory: 256MB (adjust based on usage)
- Timeout: 30 seconds
- Environment variables cached

### 3. API Gateway
- Enable caching for GET endpoints
- Set up rate limiting
- Monitor throttling

## 📈 Success Metrics

### 1. Technical Metrics
- API response time < 500ms
- Error rate < 1%
- Uptime > 99.9%
- Database query time < 100ms

### 2. Business Metrics
- Referral conversion rate
- Premium activation rate
- User engagement with referral system
- Fraud detection accuracy

## 🔄 Rollback Plan

### 1. Quick Rollback
```bash
# Deploy previous version
npm run deploy:prod -- --version previous-version

# Or remove referral endpoints temporarily
# Comment out referral functions in serverless.yml
```

### 2. Database Rollback
```sql
-- Disable referral system temporarily
UPDATE user_referral_codes SET is_active = false;
UPDATE referrals SET status = 'expired';
```

### 3. Feature Flag
Implement feature flag to disable referral system:
```javascript
const REFERRAL_SYSTEM_ENABLED = process.env.REFERRAL_SYSTEM_ENABLED === 'true';
```

## 📚 Documentation Updates

After successful deployment:
- [ ] Update API documentation with production URLs
- [ ] Update frontend integration guide
- [ ] Create user documentation
- [ ] Update admin documentation

## 🆘 Support Contacts

- **Backend Team**: backend@hirebuddy.com
- **Database Team**: database@hirebuddy.com
- **DevOps Team**: devops@hirebuddy.com

## 🎉 Deployment Complete!

Once all tests pass and monitoring is set up, your referral system is ready for production use!

---

**Deployment Checklist:**
- [ ] Database setup complete
- [ ] Environment variables configured
- [ ] Code deployed to production
- [ ] All tests passing
- [ ] Monitoring configured
- [ ] Documentation updated
- [ ] Team notified

**Your referral system is now live! 🚀**
