#!/bin/bash

# Fix CORS Configuration Script
echo "🔧 Fixing CORS Configuration for HireBuddy Backend"

# Check if CORS_ORIGIN environment variable is set
if [ -z "$CORS_ORIGIN" ]; then
    echo "⚠️  CORS_ORIGIN environment variable is not set"
    echo "📝 Setting CORS_ORIGIN to https://www.hirebuddy.net"
    export CORS_ORIGIN="https://www.hirebuddy.net"
else
    echo "✅ CORS_ORIGIN is set to: $CORS_ORIGIN"
fi

# Build the project
echo "🔨 Building the project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

# Deploy to AWS
echo "🚀 Deploying to AWS..."
serverless deploy --stage dev

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful"
    echo ""
    echo "🎉 CORS issue should now be fixed!"
    echo "📋 Your frontend at https://www.hirebuddy.net should now be able to access:"
    echo "   - https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev/api/email/stats"
    echo "   - https://xigzlt6zoj.execute-api.us-east-1.amazonaws.com/dev/api/email/followups-needed"
    echo "   - And all other email log endpoints"
    echo ""
    echo "🔍 If you still have issues, check:"
    echo "   1. The CORS_ORIGIN environment variable is set correctly"
    echo "   2. Your frontend is making requests to the correct endpoints"
    echo "   3. The Authorization header is included in requests"
else
    echo "❌ Deployment failed"
    exit 1
fi



