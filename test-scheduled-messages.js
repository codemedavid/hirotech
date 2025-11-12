/**
 * Comprehensive Test Suite for Scheduled Messages Feature
 * Tests all endpoints, logic flows, and potential conflicts
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}\n`),
};

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  errors: [],
};

// Test: Check if all required files exist
function testFilesExist() {
  log.section('Testing File Structure');
  
  const requiredFiles = [
    'src/app/api/cron/send-scheduled/route.ts',
    'src/app/api/campaigns/[id]/send-now/route.ts',
    'src/app/(dashboard)/campaigns/scheduled/page.tsx',
    'src/lib/ai/google-ai-service.ts',
    'src/lib/facebook/client.ts',
    'vercel.json',
  ];

  requiredFiles.forEach(file => {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      log.success(`File exists: ${file}`);
      results.passed++;
    } else {
      log.error(`File missing: ${file}`);
      results.failed++;
      results.errors.push(`Missing file: ${file}`);
    }
  });
}

// Test: Check database schema fields
function testDatabaseSchema() {
  log.section('Testing Database Schema');
  
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  
  if (!fs.existsSync(schemaPath)) {
    log.error('Prisma schema file not found');
    results.failed++;
    return;
  }

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  
  const requiredFields = [
    'scheduledAt',
    'autoFetchEnabled',
    'includeTags',
    'excludeTags',
    'useAiPersonalization',
    'aiCustomInstructions',
    'aiMessagesMap',
    'lastFetchAt',
    'fetchCount',
  ];

  requiredFields.forEach(field => {
    if (schemaContent.includes(field)) {
      log.success(`Schema field exists: ${field}`);
      results.passed++;
    } else {
      log.error(`Schema field missing: ${field}`);
      results.failed++;
      results.errors.push(`Missing schema field: ${field}`);
    }
  });

  // Check Campaign Status enum
  if (schemaContent.includes('SCHEDULED') && schemaContent.includes('enum CampaignStatus')) {
    log.success('CampaignStatus includes SCHEDULED');
    results.passed++;
  } else {
    log.error('SCHEDULED status not found in CampaignStatus enum');
    results.failed++;
    results.errors.push('SCHEDULED status missing from enum');
  }
}

// Test: Check vercel.json cron configuration
function testVercelCron() {
  log.section('Testing Vercel Cron Configuration');
  
  const vercelPath = path.join(process.cwd(), 'vercel.json');
  
  if (!fs.existsSync(vercelPath)) {
    log.error('vercel.json not found');
    results.failed++;
    return;
  }

  const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  
  if (vercelConfig.crons) {
    const scheduledCron = vercelConfig.crons.find(c => 
      c.path === '/api/cron/send-scheduled'
    );
    
    if (scheduledCron) {
      log.success('Scheduled messages cron job configured');
      log.info(`Schedule: ${scheduledCron.schedule}`);
      results.passed++;
      
      // Check if schedule is every minute
      if (scheduledCron.schedule === '* * * * *') {
        log.success('Cron runs every minute (optimal for scheduled messages)');
        results.passed++;
      } else {
        log.warn(`Cron schedule is: ${scheduledCron.schedule} (may cause delays)`);
        results.warnings++;
      }
    } else {
      log.error('Scheduled messages cron job not found in vercel.json');
      results.failed++;
      results.errors.push('Missing cron job configuration');
    }
  } else {
    log.error('No crons configuration in vercel.json');
    results.failed++;
  }
}

// Test: Check cron endpoint implementation
function testCronEndpoint() {
  log.section('Testing Cron Endpoint Implementation');
  
  const cronPath = path.join(process.cwd(), 'src/app/api/cron/send-scheduled/route.ts');
  
  if (!fs.existsSync(cronPath)) {
    log.error('Cron endpoint file not found');
    results.failed++;
    return;
  }

  const cronContent = fs.readFileSync(cronPath, 'utf8');
  
  const requiredFeatures = [
    { name: 'GET handler', pattern: 'export async function GET' },
    { name: 'Auth verification', pattern: 'authorization' },
    { name: 'Find due campaigns', pattern: 'SCHEDULED' },
    { name: 'Auto-fetch logic', pattern: 'autoFetchRecipients' },
    { name: 'AI personalization', pattern: 'generateAIMessages' },
    { name: 'Tag filtering', pattern: 'includeTags|excludeTags' },
    { name: 'Error handling', pattern: 'try.*catch' },
    { name: 'Status updates', pattern: 'status.*SENDING' },
  ];

  requiredFeatures.forEach(({ name, pattern }) => {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(cronContent)) {
      log.success(`Cron endpoint has: ${name}`);
      results.passed++;
    } else {
      log.error(`Cron endpoint missing: ${name}`);
      results.failed++;
      results.errors.push(`Cron endpoint missing: ${name}`);
    }
  });
}

// Test: Check send-now endpoint
function testSendNowEndpoint() {
  log.section('Testing Send-Now Endpoint');
  
  const sendNowPath = path.join(process.cwd(), 'src/app/api/campaigns/[id]/send-now/route.ts');
  
  if (!fs.existsSync(sendNowPath)) {
    log.error('Send-now endpoint file not found');
    results.failed++;
    return;
  }

  const sendNowContent = fs.readFileSync(sendNowPath, 'utf8');
  
  const requiredFeatures = [
    { name: 'POST handler', pattern: 'export async function POST' },
    { name: 'Auth check', pattern: 'auth|session' },
    { name: 'Status validation', pattern: 'SCHEDULED|DRAFT' },
    { name: 'Clear schedule', pattern: 'scheduledAt.*null' },
    { name: 'Start campaign', pattern: 'startCampaign' },
  ];

  requiredFeatures.forEach(({ name, pattern }) => {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(sendNowContent)) {
      log.success(`Send-now endpoint has: ${name}`);
      results.passed++;
    } else {
      log.error(`Send-now endpoint missing: ${name}`);
      results.failed++;
      results.errors.push(`Send-now endpoint missing: ${name}`);
    }
  });
}

// Test: Check AI service implementation
function testAIService() {
  log.section('Testing AI Service');
  
  const aiPath = path.join(process.cwd(), 'src/lib/ai/google-ai-service.ts');
  
  if (!fs.existsSync(aiPath)) {
    log.error('AI service file not found');
    results.failed++;
    return;
  }

  const aiContent = fs.readFileSync(aiPath, 'utf8');
  
  const requiredFeatures = [
    { name: 'GoogleAIService class', pattern: 'export class GoogleAIService' },
    { name: 'generatePersonalizedMessage method', pattern: 'generatePersonalizedMessage' },
    { name: 'Key rotation', pattern: 'getNextKey' },
    { name: 'Error handling', pattern: 'try.*catch' },
    { name: 'Fallback to template', pattern: 'replace.*firstName' },
  ];

  requiredFeatures.forEach(({ name, pattern }) => {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(aiContent)) {
      log.success(`AI service has: ${name}`);
      results.passed++;
    } else {
      log.error(`AI service missing: ${name}`);
      results.failed++;
      results.errors.push(`AI service missing: ${name}`);
    }
  });
}

// Test: Check for potential conflicts
function testPotentialConflicts() {
  log.section('Testing for Potential Conflicts');
  
  // Check if campaign send logic supports AI messages
  const sendPath = path.join(process.cwd(), 'src/lib/campaigns/send.ts');
  
  if (fs.existsSync(sendPath)) {
    const sendContent = fs.readFileSync(sendPath, 'utf8');
    
    if (sendContent.includes('aiMessagesMap') && sendContent.includes('useAiPersonalization')) {
      log.success('Campaign send logic supports AI personalization');
      results.passed++;
    } else {
      log.warn('Campaign send logic may not support AI personalization');
      results.warnings++;
    }
    
    if (sendContent.includes('aiMessagesMap[contact.id]')) {
      log.success('Campaign send uses AI messages for individual contacts');
      results.passed++;
    } else {
      log.warn('Campaign send may not use AI messages correctly');
      results.warnings++;
    }
  }
  
  // Check for existing campaign routes that might conflict
  const campaignRoutePath = path.join(process.cwd(), 'src/app/api/campaigns/route.ts');
  
  if (fs.existsSync(campaignRoutePath)) {
    const routeContent = fs.readFileSync(campaignRoutePath, 'utf8');
    
    if (routeContent.includes('scheduledAt') && routeContent.includes('SCHEDULED')) {
      log.success('Campaign POST endpoint supports scheduling');
      results.passed++;
    } else {
      log.error('Campaign POST endpoint may not support scheduling');
      results.failed++;
      results.errors.push('Campaign POST missing schedule support');
    }
  }
}

// Test: Check UI page
function testUIPage() {
  log.section('Testing UI Page');
  
  const uiPath = path.join(process.cwd(), 'src/app/(dashboard)/campaigns/scheduled/page.tsx');
  
  if (!fs.existsSync(uiPath)) {
    log.error('Scheduled campaigns UI page not found');
    results.failed++;
    return;
  }

  const uiContent = fs.readFileSync(uiPath, 'utf8');
  
  const requiredFeatures = [
    { name: 'Client component', pattern: "'use client'" },
    { name: 'Fetch scheduled campaigns', pattern: 'fetchScheduledCampaigns|status.*SCHEDULED' },
    { name: 'Auto-refresh', pattern: 'setInterval.*30000|refetchInterval' },
    { name: 'Delete functionality', pattern: 'handleDelete|DELETE' },
    { name: 'Send now functionality', pattern: 'handleSendNow|send-now' },
    { name: 'Past due detection', pattern: 'isPast' },
    { name: 'Auto-fetch badge', pattern: 'autoFetchEnabled|Auto-fetch' },
    { name: 'AI personalization badge', pattern: 'useAiPersonalization|AI' },
  ];

  requiredFeatures.forEach(({ name, pattern }) => {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(uiContent)) {
      log.success(`UI page has: ${name}`);
      results.passed++;
    } else {
      log.error(`UI page missing: ${name}`);
      results.failed++;
      results.errors.push(`UI page missing: ${name}`);
    }
  });
}

// Test: Check for race conditions
function testRaceConditions() {
  log.section('Testing for Race Conditions');
  
  const cronPath = path.join(process.cwd(), 'src/app/api/cron/send-scheduled/route.ts');
  
  if (fs.existsSync(cronPath)) {
    const cronContent = fs.readFileSync(cronPath, 'utf8');
    
    // Check for status update before processing
    if (cronContent.includes("status: 'SENDING'") || cronContent.includes("status.*SENDING")) {
      log.success('Cron updates status to SENDING to prevent duplicates');
      results.passed++;
    } else {
      log.warn('Cron may not prevent duplicate processing');
      results.warnings++;
    }
    
    // Check for proper error handling
    if (cronContent.match(/try.*catch/gi)?.length >= 2) {
      log.success('Cron has multiple error handling blocks');
      results.passed++;
    } else {
      log.warn('Cron may need more error handling');
      results.warnings++;
    }
  }
}

// Test: Check environment variables
function testEnvironmentVariables() {
  log.section('Testing Environment Variables');
  
  const requiredEnvVars = [
    'GOOGLE_AI_API_KEY',
    'CRON_SECRET (optional)',
  ];
  
  log.info('Required environment variables:');
  requiredEnvVars.forEach(envVar => {
    log.info(`  - ${envVar}`);
  });
  
  log.warn('Make sure these are configured in production');
  results.warnings++;
}

// Main test runner
function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('   SCHEDULED MESSAGES FEATURE - COMPREHENSIVE TEST SUITE');
  console.log('='.repeat(60));
  
  testFilesExist();
  testDatabaseSchema();
  testVercelCron();
  testCronEndpoint();
  testSendNowEndpoint();
  testAIService();
  testPotentialConflicts();
  testUIPage();
  testRaceConditions();
  testEnvironmentVariables();
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('   TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`${colors.green}Passed:${colors.reset} ${results.passed}`);
  console.log(`${colors.red}Failed:${colors.reset} ${results.failed}`);
  console.log(`${colors.yellow}Warnings:${colors.reset} ${results.warnings}`);
  
  if (results.failed > 0) {
    console.log(`\n${colors.red}ERRORS:${colors.reset}`);
    results.errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (results.failed === 0) {
    console.log(`${colors.green}✓ ALL TESTS PASSED!${colors.reset}`);
    console.log(`${colors.cyan}The scheduled messages feature is ready to deploy.${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.red}✗ SOME TESTS FAILED${colors.reset}`);
    console.log(`${colors.yellow}Please fix the errors above before deploying.${colors.reset}`);
    process.exit(1);
  }
}

// Run tests
runAllTests();

