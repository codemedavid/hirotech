/**
 * Migration script to move API keys from environment variables to database
 * 
 * This script:
 * 1. Reads all GOOGLE_AI_API_KEY_* environment variables
 * 2. Encrypts each key
 * 3. Creates database records
 * 4. Marks them as ACTIVE
 * 
 * Run with: npx tsx scripts/migrate-api-keys.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { encryptKey } from '../src/lib/crypto/encryption';
import { ApiKeyStatus } from '@prisma/client';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

interface MigrationResult {
  keyIndex: number;
  keyValue: string;
  status: 'success' | 'error' | 'skipped';
  error?: string;
  keyId?: string;
}

async function migrateApiKeys() {
  console.log('\n🔐 API Key Migration Script\n');
  console.log('='.repeat(60));

  // Check encryption key
  if (!process.env.ENCRYPTION_KEY) {
    console.error('❌ ENCRYPTION_KEY not found in environment variables');
    console.log('\n💡 Generate an encryption key:');
    console.log('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.log('\n   Then add to .env.local:');
    console.log('   ENCRYPTION_KEY=<generated_key>');
    process.exit(1);
  }

  console.log('✅ Encryption key found');

  // Collect all API keys from environment
  const envKeys: Array<{ index: number; key: string; name: string }> = [];
  
  // Primary key
  if (process.env.GOOGLE_AI_API_KEY) {
    envKeys.push({
      index: 1,
      key: process.env.GOOGLE_AI_API_KEY,
      name: `API Key #1 (migrated)`,
    });
  }

  // Numbered keys (2-17)
  for (let i = 2; i <= 17; i++) {
    const envVarName = `GOOGLE_AI_API_KEY_${i}`;
    const key = process.env[envVarName];
    if (key) {
      envKeys.push({
        index: i,
        key,
        name: `API Key #${i} (migrated)`,
      });
    }
  }

  if (envKeys.length === 0) {
    console.log('\n⚠️  No API keys found in environment variables');
    console.log('   Looking for: GOOGLE_AI_API_KEY, GOOGLE_AI_API_KEY_2, etc.');
    process.exit(0);
  }

  console.log(`\n📋 Found ${envKeys.length} API key(s) in environment:`);
  envKeys.forEach(({ index, key }) => {
    const prefix = key.substring(0, 8);
    const suffix = key.length > 16 ? '...' + key.substring(key.length - 4) : '***';
    console.log(`   Key #${index}: ${prefix}${suffix} (${key.length} chars)`);
  });

  // Check for existing keys in database
  console.log('\n🔍 Checking for existing keys in database...');
  const existingKeys = await prisma.apiKey.findMany({
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (existingKeys.length > 0) {
    console.log(`⚠️  Found ${existingKeys.length} existing key(s) in database:`);
    existingKeys.forEach(key => {
      console.log(`   - ${key.name || key.id} (${key.status})`);
    });
    
    console.log('\n⚠️  Warning: Existing keys will not be overwritten');
    console.log('   Duplicate keys (same value) will be skipped');
  }

  // Migrate each key
  console.log('\n🚀 Starting migration...\n');
  const results: MigrationResult[] = [];

  for (const { index, key, name } of envKeys) {
    try {
      // Check if key already exists (by checking if any existing key decrypts to the same value)
      let duplicate = false;
      for (const existingKey of existingKeys) {
        try {
          const existingKeyRecord = await prisma.apiKey.findUnique({
            where: { id: existingKey.id },
            select: { encryptedKey: true },
          });
          
          if (existingKeyRecord) {
            // Try to decrypt and compare (we'll need to import decryptKey)
            const { decryptKey } = await import('../src/lib/crypto/encryption');
            try {
              const decrypted = decryptKey(existingKeyRecord.encryptedKey);
              if (decrypted === key) {
                duplicate = true;
                console.log(`⏭️  Key #${index}: Skipped (duplicate of existing key "${existingKey.name || existingKey.id}")`);
                results.push({
                  keyIndex: index,
                  keyValue: key.substring(0, 8) + '...',
                  status: 'skipped',
                  error: 'Duplicate of existing key',
                  keyId: existingKey.id,
                });
                break;
              }
            } catch {
              // Decryption failed, not a duplicate
            }
          }
        } catch {
          // Skip if can't check
        }
      }

      if (duplicate) {
        continue;
      }

      // Encrypt the key
      console.log(`🔐 Encrypting Key #${index}...`);
      const encryptedKey = encryptKey(key);

      // Extract metadata
      const keyPrefix = key.substring(0, 8);
      const keyLength = key.length;

      // Create database record
      console.log(`💾 Saving Key #${index} to database...`);
      const apiKey = await prisma.apiKey.create({
        data: {
          name,
          encryptedKey,
          status: ApiKeyStatus.ACTIVE,
          metadata: {
            prefix: keyPrefix,
            length: keyLength,
            migrated: true,
            migratedAt: new Date().toISOString(),
            source: `env:GOOGLE_AI_API_KEY${index === 1 ? '' : `_${index}`}`,
          },
        },
      });

      console.log(`✅ Key #${index}: Migrated successfully (ID: ${apiKey.id})`);
      results.push({
        keyIndex: index,
        keyValue: keyPrefix + '...',
        status: 'success',
        keyId: apiKey.id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Key #${index}: Migration failed - ${errorMessage}`);
      results.push({
        keyIndex: index,
        keyValue: key.substring(0, 8) + '...',
        status: 'error',
        error: errorMessage,
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Migration Summary:\n');
  
  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log(`✅ Successfully migrated: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped (duplicates): ${skipped}`);
  console.log(`📦 Total: ${results.length}`);

  if (failed > 0) {
    console.log('\n❌ Failed migrations:');
    results
      .filter(r => r.status === 'error')
      .forEach(r => {
        console.log(`   Key #${r.keyIndex}: ${r.error}`);
      });
  }

  // Verify migration
  console.log('\n🔍 Verifying migration...');
  const finalCount = await prisma.apiKey.count({
    where: {
      status: ApiKeyStatus.ACTIVE,
    },
  });
  console.log(`✅ Total active keys in database: ${finalCount}`);

  console.log('\n✨ Migration complete!\n');
  console.log('💡 Next steps:');
  console.log('   1. Verify keys in admin UI: /settings/api-keys');
  console.log('   2. Test API key rotation');
  console.log('   3. (Optional) Remove environment variables after verification');
  console.log('\n');
}

// Run migration
migrateApiKeys()
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

