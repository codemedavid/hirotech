/**
 * Test API Endpoints
 * Usage: npx tsx scripts/test-api-endpoints.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL 
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  || 'https://hirotechofficial-beta.vercel.app';
const TEST_EMAIL = process.env.TEST_EMAIL || 'hirotech.developer@gmail.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'demet5732595';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  message: string;
  statusCode?: number;
  data?: unknown;
}

const results: TestResult[] = [];

async function testEndpoint(
  name: string,
  url: string,
  options: RequestInit = {}
): Promise<TestResult> {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   URL: ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const statusCode = response.status;
    const contentType = response.headers.get('content-type');
    let data: unknown;
    
    try {
      const text = await response.text();
      if (contentType?.includes('application/json')) {
        data = JSON.parse(text);
      } else {
        data = text;
      }
    } catch (error) {
      data = { error: 'Failed to parse response', message: error instanceof Error ? error.message : 'Unknown' };
    }

    const isSuccess = statusCode >= 200 && statusCode < 300;
    
    if (isSuccess) {
      console.log(`   ✅ PASS (${statusCode})`);
      return {
        name,
        status: 'PASS',
        message: `Status: ${statusCode}`,
        statusCode,
        data,
      };
    } else {
      console.log(`   ❌ FAIL (${statusCode})`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
      return {
        name,
        status: 'FAIL',
        message: `Status: ${statusCode}`,
        statusCode,
        data,
      };
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      name,
      status: 'FAIL',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function login(): Promise<string | null> {
  try {
    console.log('\n🔐 Attempting login...');
    const response = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    // Extract cookies from response
    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      console.log('   ✅ Login successful (cookies received)');
      return cookies;
    }
    
    // Try alternative login method
    const loginResponse = await fetch(`${BASE_URL}/api/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    const loginCookies = loginResponse.headers.get('set-cookie');
    if (loginCookies) {
      console.log('   ✅ Login successful (alternative method)');
      return loginCookies;
    }

    console.log('   ⚠️  Could not get session cookies, continuing with tests...');
    return null;
  } catch (error) {
    console.log(`   ⚠️  Login error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

async function main() {
  console.log('\n🚀 API Endpoints Test Suite');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Email: ${TEST_EMAIL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test 1: Health check
  results.push(await testEndpoint(
    'Health Check',
    `${BASE_URL}/api/health`
  ));

  // Test 2: Test encryption endpoint
  results.push(await testEndpoint(
    'Test Encryption Key',
    `${BASE_URL}/api/test-encryption`
  ));

  // Test 3: API Keys endpoint (should require auth - 401 is expected)
  const apiKeysResult = await testEndpoint(
    'API Keys (Unauthenticated)',
    `${BASE_URL}/api/api-keys`
  );
  if (apiKeysResult.statusCode === 401) {
    apiKeysResult.status = 'PASS';
    apiKeysResult.message = 'Expected 401 - Authentication required';
  }
  results.push(apiKeysResult);

  // Test 4: API Keys readonly endpoint (should require auth - 401 is expected)
  const readonlyResult = await testEndpoint(
    'API Keys Readonly (Unauthenticated)',
    `${BASE_URL}/api/api-keys/readonly`
  );
  if (readonlyResult.statusCode === 401) {
    readonlyResult.status = 'PASS';
    readonlyResult.message = 'Expected 401 - Authentication required';
  }
  results.push(readonlyResult);

  // Test 5: Developer page access endpoint (should require auth - 401 is expected)
  const pageAccessResult = await testEndpoint(
    'Developer Page Access (Unauthenticated)',
    `${BASE_URL}/api/developer/page-access`
  );
  if (pageAccessResult.statusCode === 401) {
    pageAccessResult.status = 'PASS';
    pageAccessResult.message = 'Expected 401 - Authentication required';
  }
  results.push(pageAccessResult);

  // Test 6: Page access check endpoint
  results.push(await testEndpoint(
    'Page Access Check',
    `${BASE_URL}/api/developer/page-access/check?path=/dashboard`
  ));

  // Test 7: Test environment endpoint
  results.push(await testEndpoint(
    'Test Environment',
    `${BASE_URL}/api/test-env`
  ));

  // Try to login and test authenticated endpoints
  const cookies = await login();
  
  if (cookies) {
    const cookieHeader = cookies.split(';')[0]; // Get first cookie
    
    // Test authenticated endpoints
    results.push(await testEndpoint(
      'API Keys (Authenticated)',
      `${BASE_URL}/api/api-keys`,
      {
        headers: {
          Cookie: cookieHeader,
        },
      }
    ));
  }

  // Summary
  console.log('\n\n📊 Test Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`   - ${r.name}: ${r.message}`);
      });
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

