/**
 * Script to add NVIDIA API key to database
 * Usage: npx tsx scripts/add-nvidia-key.ts
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local first, then .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { prisma } from '../src/lib/db';
import { encryptKey } from '../src/lib/crypto/encryption';

async function addNvidiaKey() {
  const apiKey = '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';
  const keyName = 'NVIDIA Primary Key';

  try {
    console.log('🔐 Adding NVIDIA API key to database...\n');

    // Check if key already exists
    const existingKeys = await prisma.apiKey.findMany({
      select: {
        id: true,
        name: true,
        encryptedKey: true,
      },
    });

    // Check for duplicates
    const { decryptKey } = await import('../src/lib/crypto/encryption');
    for (const existingKey of existingKeys) {
      try {
        const decrypted = decryptKey(existingKey.encryptedKey);
        if (decrypted === apiKey) {
          console.log('✅ Key already exists in database!');
          console.log(`   ID: ${existingKey.id}`);
          console.log(`   Name: ${existingKey.name || 'Unnamed'}\n`);
          return;
        }
      } catch {
        // Decryption failed, not a duplicate
      }
    }

    // Encrypt the key
    console.log('🔐 Encrypting API key...');
    const encryptedKey = encryptKey(apiKey);

    // Extract metadata
    const keyPrefix = apiKey.substring(0, 8);
    const keyLength = apiKey.length;

    // Create database record
    console.log('💾 Saving to database...');
    const apiKeyRecord = await prisma.apiKey.create({
      data: {
        name: keyName,
        encryptedKey,
        status: 'ACTIVE',
        metadata: {
          prefix: keyPrefix,
          length: keyLength,
          provider: 'nvidia',
        },
      },
    });

    console.log('\n✅ Successfully added NVIDIA API key!');
    console.log(`   ID: ${apiKeyRecord.id}`);
    console.log(`   Name: ${apiKeyRecord.name}`);
    console.log(`   Status: ${apiKeyRecord.status}`);
    console.log(`   Prefix: ${keyPrefix}...`);
    console.log('\n🎉 Your NVIDIA API key is now ready to use!\n');
  } catch (error) {
    console.error('\n❌ Error adding API key:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      
      if (error.message.includes('ENCRYPTION_KEY')) {
        console.error('\n💡 Tip: Make sure ENCRYPTION_KEY is set in your .env.local file');
        console.error('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
      }
    } else {
      console.error('   Unknown error:', error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
addNvidiaKey().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

