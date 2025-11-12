/**
 * Comprehensive Endpoint Testing Script
 * Tests all AI automation endpoints with multiple scenarios
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const tests = {
  passed: [],
  failed: [],
  warnings: [],
};

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
  };
  const reset = '\x1b[0m';
  const prefix = {
    info: 'ℹ',
    success: '✓',
    error: '✗',
    warning: '⚠',
  }[type];
  console.log(`${colors[type]}${prefix} ${message}${reset}`);
}

async function testEndpoint(name, method, url, options = {}) {
  try {
    log(`Testing ${method} ${url}`, 'info');
    const response = await fetch(`${BASE_URL}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    const result = {
      status: response.status,
      ok: response.ok,
      data,
    };

    if (options.expectedStatus && response.status !== options.expectedStatus) {
      throw new Error(`Expected status ${options.expectedStatus} but got ${response.status}`);
    }

    tests.passed.push(name);
    log(`${name}: PASSED (${response.status})`, 'success');
    return result;
  } catch (error) {
    tests.failed.push({ test: name, error: error.message });
    log(`${name}: FAILED - ${error.message}`, 'error');
    return { error: error.message };
  }
}

async function runAllTests() {
  console.log('\n��� Starting Endpoint Testing Suite\n');

  // Test 1: Health Check
  await testEndpoint(
    'Health Check',
    'GET',
    '/api/health',
    { expectedStatus: 200 }
  );

  // Test 2: AI Automations List (Unauthenticated - should fail)
  await testEndpoint(
    'AI Automations List (Unauth)',
    'GET',
    '/api/ai-automations',
    { expectedStatus: 401 }
  );

  // Test 3: Tags API (Unauthenticated - should fail)
  await testEndpoint(
    'Tags List (Unauth)',
    'GET',
    '/api/tags',
    { expectedStatus: 401 }
  );

  // Test 4: Facebook Pages API (Unauthenticated - should fail)
  await testEndpoint(
    'Facebook Pages (Unauth)',
    'GET',
    '/api/facebook/pages/connected',
    { expectedStatus: 401 }
  );

  // Test 5: Contacts API (Unauthenticated - should fail)
  await testEndpoint(
    'Contacts List (Unauth)',
    'GET',
    '/api/contacts',
    { expectedStatus: 401 }
  );

  // Test 6: Invalid AI Automation ID
  await testEndpoint(
    'Invalid AI Automation ID',
    'GET',
    '/api/ai-automations/invalid-id',
    { expectedStatus: 401 }
  );

  // Test 7: Invalid HTTP Method
  await testEndpoint(
    'Invalid Method on AI Automations',
    'PUT',
    '/api/ai-automations',
    {}
  );

  // Test 8: Cron Endpoint (Should require auth header)
  await testEndpoint(
    'Cron AI Automations',
    'GET',
    '/api/cron/ai-automations',
    {}
  );

  // Generate Report
  console.log('\n========== TEST REPORT ==========');
  log(`Total Passed: ${tests.passed.length}`, 'success');
  log(`Total Failed: ${tests.failed.length}`, 'error');
  log(`Total Warnings: ${tests.warnings.length}`, 'warning');

  if (tests.passed.length > 0) {
    console.log('\n✓ Passed Tests:');
    tests.passed.forEach(test => log(`  - ${test}`, 'success'));
  }

  if (tests.failed.length > 0) {
    console.log('\n✗ Failed Tests:');
    tests.failed.forEach(failure => {
      log(`  - ${failure.test}: ${failure.error}`, 'error');
    });
  }

  if (tests.warnings.length > 0) {
    console.log('\n⚠ Warnings:');
    tests.warnings.forEach(warning => log(`  - ${warning}`, 'warning'));
  }

  console.log('\n================================\n');
  
  return tests.failed.length === 0 ? 0 : 1;
}

runAllTests()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    log(`Critical error: ${error.message}`, 'error');
    process.exit(1);
  });
