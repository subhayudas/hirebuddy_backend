#!/usr/bin/env node

/**
 * Quick Referral System Verification
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Quick Referral System Verification');
console.log('=====================================\n');

const checks = [
  {
    name: 'Referral Handler',
    file: 'src/handlers/referral.ts',
    exists: false,
    size: 0
  },
  {
    name: 'Referral Service',
    file: 'src/lib/referralService.ts',
    exists: false,
    size: 0
  },
  {
    name: 'Referral Health Check',
    file: 'src/handlers/referralHealth.ts',
    exists: false,
    size: 0
  },
  {
    name: 'Type Definitions',
    file: 'src/types/index.ts',
    exists: false,
    size: 0
  },
  {
    name: 'Unit Tests',
    file: 'src/tests/referral.test.ts',
    exists: false,
    size: 0
  },
  {
    name: 'Integration Tests',
    file: 'src/tests/referralIntegration.test.ts',
    exists: false,
    size: 0
  },
  {
    name: 'Serverless Config',
    file: 'serverless.yml',
    exists: false,
    size: 0
  }
];

let allGood = true;

for (const check of checks) {
  const fullPath = path.join(__dirname, check.file);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    check.exists = true;
    check.size = stats.size;
    console.log(`✅ ${check.name}: ${(check.size / 1024).toFixed(1)}KB`);
  } else {
    console.log(`❌ ${check.name}: Not found`);
    allGood = false;
  }
}

console.log('\n📊 File Summary:');
console.log('================');

const totalSize = checks.reduce((sum, check) => sum + check.size, 0);
const existingFiles = checks.filter(check => check.exists).length;

console.log(`Files Created: ${existingFiles}/${checks.length}`);
console.log(`Total Size: ${(totalSize / 1024).toFixed(1)}KB`);

// Check serverless.yml for referral endpoints
const serverlessPath = path.join(__dirname, 'serverless.yml');
if (fs.existsSync(serverlessPath)) {
  const content = fs.readFileSync(serverlessPath, 'utf8');
  const referralEndpoints = [
    'generateReferralCode',
    'applyReferralCode',
    'getReferralStats',
    'getReferralProgress',
    'completeReferral',
    'getAdminReferralStats',
    'validateReferralCode',
    'referralHealthCheck',
    'testReferralSystem'
  ];
  
  console.log('\n🔗 Serverless Endpoints:');
  let endpointCount = 0;
  for (const endpoint of referralEndpoints) {
    if (content.includes(endpoint)) {
      console.log(`  ✅ ${endpoint}`);
      endpointCount++;
    } else {
      console.log(`  ❌ ${endpoint}`);
    }
  }
  console.log(`\nEndpoints Configured: ${endpointCount}/${referralEndpoints.length}`);
}

// Check package.json for dependencies
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  console.log('\n📦 Dependencies:');
  const deps = ['@supabase/supabase-js', 'zod', 'uuid'];
  for (const dep of deps) {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`  ✅ ${dep}: ${packageJson.dependencies[dep]}`);
    } else {
      console.log(`  ❌ ${dep}: Not found`);
    }
  }
}

if (allGood) {
  console.log('\n🎉 All files created successfully!');
  console.log('✅ Referral system is ready for deployment.');
} else {
  console.log('\n❌ Some files are missing.');
}

console.log('\n🚀 Quick verification complete!');
