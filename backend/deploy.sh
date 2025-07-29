#!/bin/bash

# HireBuddy Backend Deployment Script
echo "🚀 Starting HireBuddy Backend Deployment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file based on .env.example with your actual values."
    exit 1
fi

# Load environment variables and export them
echo "📋 Loading environment variables..."
set -a  # automatically export all variables
source .env
set +a  # stop automatically exporting

# Validate required variables
required_vars=("SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY" "JWT_SECRET")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set in .env file"
        exit 1
    fi
done

echo "✅ Environment variables loaded successfully"
echo "📍 SUPABASE_URL: ${SUPABASE_URL}"
echo "📍 CORS_ORIGIN: ${CORS_ORIGIN}"

# Build the project
echo "🔨 Building TypeScript project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Deploy based on stage
STAGE=${1:-dev}
echo "🌟 Deploying to stage: $STAGE"

# Deploy using serverless
npx serverless deploy --stage $STAGE

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo "📡 Your API endpoints are now available."
    echo "🔗 Check the output above for your API Gateway URL."
else
    echo "❌ Deployment failed!"
    exit 1
fi 