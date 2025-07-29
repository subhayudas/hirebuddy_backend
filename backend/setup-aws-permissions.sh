#!/bin/bash

echo "🔧 Setting up AWS permissions for Serverless deployment..."

# Get current user ARN
USER_ARN=$(aws sts get-caller-identity --query 'Arn' --output text)
USER_NAME=$(echo $USER_ARN | cut -d'/' -f2)

echo "👤 Current AWS user: $USER_NAME"
echo "🏷️  User ARN: $USER_ARN"

# Create the policy
POLICY_NAME="ServerlessDeploymentPolicy"

echo "📋 Creating IAM policy: $POLICY_NAME"

# Create the policy
aws iam create-policy \
    --policy-name $POLICY_NAME \
    --policy-document file://aws-permissions-policy.json \
    --description "Policy for Serverless Framework deployment" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Policy created successfully"
else
    echo "ℹ️  Policy may already exist, continuing..."
fi

# Get the policy ARN
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
POLICY_ARN="arn:aws:iam::$ACCOUNT_ID:policy/$POLICY_NAME"

echo "🔗 Policy ARN: $POLICY_ARN"

# Attach the policy to the user
echo "🔐 Attaching policy to user: $USER_NAME"

aws iam attach-user-policy \
    --user-name $USER_NAME \
    --policy-arn $POLICY_ARN

if [ $? -eq 0 ]; then
    echo "✅ Policy attached successfully!"
    echo "🚀 You can now deploy with: npm run deploy:sls"
else
    echo "❌ Failed to attach policy. You may need to do this manually in AWS console."
    echo "👉 Go to: https://console.aws.amazon.com/iam/home#/users/$USER_NAME"
    echo "👉 Click 'Add permissions' → 'Attach existing policies directly'"
    echo "👉 Search for '$POLICY_NAME' and attach it"
fi

echo ""
echo "🔍 Current user policies:"
aws iam list-attached-user-policies --user-name $USER_NAME --output table 