/**
 * Test NVIDIA API Configuration
 * Usage: npx tsx scripts/test-nvidia-api.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { prisma } from '../src/lib/db';
import apiKeyManager from '../src/lib/ai/api-key-manager';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

// Ensure DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found. Please check your .env.local file.');
  process.exit(1);
}

async function testNvidiaApiSetup() {
  console.log('\n🔍 NVIDIA API Configuration Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check 1: Environment Variables
  console.log('1️⃣  Checking Environment Variables:');
  const envKey = process.env.NVIDIA_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (envKey) {
    console.log(`   ✅ Found: ${envKey.substring(0, 12)}... (${envKey.length} chars)`);
    if (envKey.startsWith('nvapi-')) {
      console.log('   ✅ Format: Valid NVIDIA API key format');
    } else {
      console.log('   ⚠️  Format: Does not start with "nvapi-" (may still work)');
    }
  } else {
    console.log('   ❌ No NVIDIA_API_KEY or GOOGLE_AI_API_KEY found in environment');
  }

  // Check 2: Database API Keys
  console.log('\n2️⃣  Checking Database API Keys:');
  try {
    const dbKeys = await prisma.apiKey.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        status: true,
        metadata: true,
      },
    });

    if (dbKeys.length > 0) {
      console.log(`   ✅ Found ${dbKeys.length} active API key(s) in database:`);
      dbKeys.forEach((key, index) => {
        const prefix = (key.metadata as { prefix?: string })?.prefix || 'unknown';
        console.log(`      ${index + 1}. ${key.name || 'Unnamed'} - Status: ${key.status} - Prefix: ${prefix}...`);
      });
    } else {
      console.log('   ⚠️  No active API keys found in database');
      console.log('   💡 Add keys through Settings → API Keys (DEVELOPER account required)');
    }
  } catch (error) {
    console.log(`   ❌ Error checking database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Check 3: API Key Manager
  console.log('\n3️⃣  Testing API Key Manager:');
  try {
    const nextKey = await apiKeyManager.getNextKey();
    if (nextKey) {
      console.log(`   ✅ API Key Manager returned a key: ${nextKey.substring(0, 12)}...`);
      if (nextKey.startsWith('nvapi-')) {
        console.log('   ✅ Format: Valid NVIDIA API key format');
      } else {
        console.log('   ⚠️  Format: Does not start with "nvapi-"');
      }
    } else {
      console.log('   ❌ API Key Manager returned null (no keys available)');
    }
  } catch (error) {
    console.log(`   ❌ Error getting key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Check 4: Encryption Key
  console.log('\n4️⃣  Checking Encryption Configuration:');
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (encryptionKey) {
    if (encryptionKey.length === 64) {
      console.log('   ✅ ENCRYPTION_KEY is set and valid (64 chars)');
    } else {
      console.log(`   ⚠️  ENCRYPTION_KEY length is ${encryptionKey.length} (expected 64)`);
    }
  } else {
    console.log('   ❌ ENCRYPTION_KEY not set (needed to encrypt/decrypt API keys)');
  }

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Summary:');
  
  const hasEnvKey = !!envKey;
  const hasDbKeys = await prisma.apiKey.count({ where: { status: 'ACTIVE' } }).then(c => c > 0).catch(() => false);
  const hasEncryption = !!encryptionKey && encryptionKey.length === 64;
  
  if (hasDbKeys || hasEnvKey) {
    console.log('   ✅ NVIDIA API should work!');
    if (hasDbKeys) {
      console.log('      → Using database-stored API keys');
    } else {
      console.log('      → Using environment variable API key');
    }
  } else {
    console.log('   ❌ NVIDIA API will NOT work - No API keys available');
    console.log('\n   💡 To fix:');
    console.log('      1. Get NVIDIA API key from https://build.nvidia.com/');
    console.log('      2. Add it through Settings → API Keys (as DEVELOPER)');
    console.log('         OR add NVIDIA_API_KEY to Vercel environment variables');
  }

  if (!hasEncryption) {
    console.log('   ⚠️  Encryption key issue may prevent database keys from working');
  }

  console.log('\n');
  
  await prisma.$disconnect();
}

testNvidiaApiSetup().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

