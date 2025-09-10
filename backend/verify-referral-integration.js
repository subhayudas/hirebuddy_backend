#!/usr/bin/env node

/**
 * Referral System Integration Verification Script
 * 
 * This script verifies that all components of the referral system
 * are properly integrated and configured.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 HireBuddy Referral System - Integration Verification');
console.log('=====================================================\n');

// Check if we're in the right directory
const currentDir = process.cwd();
const backendDir = path.join(currentDir, 'backend');
const srcDir = path.join(backendDir, 'src');

if (!fs.existsSync(backendDir) || !fs.existsSync(srcDir)) {
  console.error('❌ Error: Please run this script from the project root directory');
  process.exit(1);
}

console.log('✅ Running from correct directory');

// Verification checklist
const checks = [
  {
    name: 'Referral Handler',
    file: path.join(srcDir, 'handlers', 'referral.ts'),
    required: true,
    checks: [
      'generateReferralCode',
      'applyReferralCode', 
      'getReferralStats',
      'getReferralProgress',
      'completeReferral',
      'getAdminReferralStats',
      'validateReferralCode'
    ]
  },
  {
    name: 'Referral Service',
    file: path.join(srcDir, 'lib', 'referralService.ts'),
    required: true,
    checks: [
      'ReferralService class',
      'generateReferralCode method',
      'applyReferralCode method',
      'getUserReferralStats method',
      'validateReferralCode method'
    ]
  },
  {
    name: 'Referral Health Check',
    file: path.join(srcDir, 'handlers', 'referralHealth.ts'),
    required: true,
    checks: [
      'referralHealthCheck',
      'testReferralSystem'
    ]
  },
  {
    name: 'Type Definitions',
    file: path.join(srcDir, 'types', 'index.ts'),
    required: true,
    checks: [
      'ReferralCode interface',
      'Referral interface',
      'ReferralReward interface',
      'ReferralStats interface',
      'AdminReferralSummary interface'
    ]
  },
  {
    name: 'Serverless Configuration',
    file: path.join(backendDir, 'serverless.yml'),
    required: true,
    checks: [
      'generateReferralCode endpoint',
      'applyReferralCode endpoint',
      'getReferralStats endpoint',
      'getReferralProgress endpoint',
      'completeReferral endpoint',
      'getAdminReferralStats endpoint',
      'validateReferralCode endpoint',
      'referralHealthCheck endpoint',
      'testReferralSystem endpoint'
    ]
  },
  {
    name: 'Unit Tests',
    file: path.join(srcDir, 'tests', 'referral.test.ts'),
    required: true,
    checks: [
      'generateReferralCode tests',
      'applyReferralCode tests',
      'getReferralStats tests',
      'validateReferralCode tests',
      'completeReferral tests',
      'getAdminReferralStats tests'
    ]
  },
  {
    name: 'Integration Tests',
    file: path.join(srcDir, 'tests', 'referralIntegration.test.ts'),
    required: true,
    checks: [
      'referralHealthCheck tests',
      'testReferralSystem tests',
      'ReferralService integration tests',
      'Database connection tests'
    ]
  },
  {
    name: 'Database Integration',
    file: path.join(srcDir, 'lib', 'database.ts'),
    required: true,
    checks: [
      'user_referral_codes table test',
      'referrals table test',
      'referral_rewards table test'
    ]
  }
];

// Run verification
let allPassed = true;
let totalChecks = 0;
let passedChecks = 0;

console.log('\n📋 Running Verification Checks:\n');

for (const check of checks) {
  console.log(`🔍 Checking ${check.name}...`);
  
  if (!fs.existsSync(check.file)) {
    console.log(`❌ ${check.name}: File not found - ${check.file}`);
    if (check.required) {
      allPassed = false;
    }
    continue;
  }
  
  const fileContent = fs.readFileSync(check.file, 'utf8');
  let filePassed = true;
  
  for (const item of check.checks) {
    totalChecks++;
    if (fileContent.includes(item)) {
      console.log(`  ✅ ${item}`);
      passedChecks++;
    } else {
      console.log(`  ❌ ${item} - Not found`);
      filePassed = false;
      allPassed = false;
    }
  }
  
  if (filePassed) {
    console.log(`✅ ${check.name}: All checks passed\n`);
  } else {
    console.log(`❌ ${check.name}: Some checks failed\n`);
  }
}

// Check for critical imports and dependencies
console.log('🔍 Checking Critical Dependencies:\n');

const criticalChecks = [
  {
    name: 'Crypto Import',
    file: path.join(srcDir, 'handlers', 'referral.ts'),
    pattern: "import { randomUUID } from 'crypto'",
    required: true
  },
  {
    name: 'Zod Validation',
    file: path.join(srcDir, 'handlers', 'referral.ts'),
    pattern: "import { z } from 'zod'",
    required: true
  },
  {
    name: 'Supabase Client',
    file: path.join(srcDir, 'handlers', 'referral.ts'),
    pattern: "import { getSupabaseClient } from '../lib/database'",
    required: true
  },
  {
    name: 'Response Helpers',
    file: path.join(srcDir, 'handlers', 'referral.ts'),
    pattern: "import { successResponse, errorResponse, corsResponse, unauthorizedResponse } from '../lib/response'",
    required: true
  },
  {
    name: 'Auth Helper',
    file: path.join(srcDir, 'handlers', 'referral.ts'),
    pattern: "import { requireAuth } from '../lib/auth'",
    required: true
  }
];

for (const check of criticalChecks) {
  totalChecks++;
  if (fs.existsSync(check.file)) {
    const content = fs.readFileSync(check.file, 'utf8');
    if (content.includes(check.pattern)) {
      console.log(`✅ ${check.name}: Found`);
      passedChecks++;
    } else {
      console.log(`❌ ${check.name}: Not found`);
      allPassed = false;
    }
  } else {
    console.log(`❌ ${check.name}: File not found`);
    allPassed = false;
  }
}

// Check package.json for required dependencies
console.log('\n🔍 Checking Package Dependencies:\n');

const packageJsonPath = path.join(backendDir, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const requiredDeps = ['@supabase/supabase-js', 'zod', 'uuid'];
  
  for (const dep of requiredDeps) {
    totalChecks++;
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
      passedChecks++;
    } else {
      console.log(`❌ ${dep}: Not found in dependencies`);
      allPassed = false;
    }
  }
} else {
  console.log('❌ package.json not found');
  allPassed = false;
}

// Summary
console.log('\n📊 Verification Summary:');
console.log('========================');
console.log(`Total Checks: ${totalChecks}`);
console.log(`Passed: ${passedChecks}`);
console.log(`Failed: ${totalChecks - passedChecks}`);
console.log(`Success Rate: ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);

if (allPassed) {
  console.log('\n🎉 All verification checks passed!');
  console.log('✅ Referral system is properly integrated and ready for deployment.');
  console.log('\n📋 Next Steps:');
  console.log('1. Run: npm run build');
  console.log('2. Run: npm test');
  console.log('3. Run: npm run deploy:dev');
  console.log('4. Test endpoints with: curl https://your-api.amazonaws.com/dev/referral/health');
} else {
  console.log('\n❌ Some verification checks failed!');
  console.log('Please fix the issues above before deploying.');
  process.exit(1);
}

console.log('\n🚀 Referral System Integration Verification Complete!');
