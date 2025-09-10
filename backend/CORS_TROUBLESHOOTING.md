# CORS Troubleshooting Guide

## Problem
You're getting CORS errors when your frontend at `https://www.hirebuddy.net` tries to access the backend API at `https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev/`.

## Error Message
```
Access to fetch at 'https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev/email/stats' from origin 'https://www.hirebuddy.net' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root Cause
The CORS configuration was incomplete for the new email log endpoints. The endpoints were using a simple `cors: true` configuration instead of the detailed CORS configuration needed for proper preflight request handling.

## Solution

### 1. Set Environment Variable
Make sure your `CORS_ORIGIN` environment variable is set correctly:

```bash
export CORS_ORIGIN="https://www.hirebuddy.net"
```

### 2. Deploy the Fix
Run the provided script to fix and deploy:

```bash
./fix-cors.sh
```

Or manually:

```bash
# Build the project
npm run build

# Deploy to AWS
serverless deploy --stage dev
```

### 3. Verify the Fix
After deployment, test the endpoints:

```bash
# Test CORS preflight
curl -X OPTIONS \
  -H "Origin: https://www.hirebuddy.net" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization" \
  https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev/api/email/stats

# Test actual request
curl -X GET \
  -H "Origin: https://www.hirebuddy.net" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev/api/email/stats
```

## What Was Fixed

### 1. Updated Serverless Configuration
Changed from simple CORS configuration:
```yaml
cors: true
```

To detailed CORS configuration:
```yaml
cors:
  origin: ${env:CORS_ORIGIN, '*'}
  headers:
    - Content-Type
    - Authorization
    - X-Requested-With
  allowCredentials: true
```

### 2. Updated Response Headers
Enhanced the CORS headers in the response library to properly handle preflight requests.

## Frontend Integration

Make sure your frontend requests include the proper headers:

```javascript
// Correct way to make requests
const response = await fetch('https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev/api/email/stats', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  credentials: 'include' // Important for CORS with credentials
});
```

## Common Issues and Solutions

### Issue 1: Still getting CORS errors after deployment
**Solution**: Check if the environment variable is set correctly:
```bash
echo $CORS_ORIGIN
```

### Issue 2: Preflight requests failing
**Solution**: Make sure the OPTIONS method is handled properly. The updated configuration now includes this.

### Issue 3: Credentials not being sent
**Solution**: Include `credentials: 'include'` in your fetch requests.

### Issue 4: Wrong endpoint URLs
**Solution**: Verify you're using the correct endpoints:
- `/api/email/stats` (not `/email/stats`)
- `/api/email/followups-needed` (not `/email/followups-needed`)

## Testing Checklist

- [ ] Environment variable `CORS_ORIGIN` is set to `https://www.hirebuddy.net`
- [ ] Backend is deployed with updated CORS configuration
- [ ] Frontend requests include `Authorization` header
- [ ] Frontend requests include `credentials: 'include'`
- [ ] Using correct endpoint URLs (with `/api/` prefix)
- [ ] JWT token is valid and not expired

## Monitoring

After deployment, monitor the API Gateway logs to ensure CORS headers are being returned correctly:

```bash
# Check API Gateway logs
aws logs describe-log-groups --log-group-name-prefix "/aws/apigateway"
```

## Additional Resources

- [AWS API Gateway CORS Documentation](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-cors.html)
- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Serverless Framework CORS Configuration](https://www.serverless.com/framework/docs/providers/aws/events/apigateway#cors)



