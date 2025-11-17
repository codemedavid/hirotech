/**
 * Simple Node test script for encryption + mock rotation using mock data.
 *
 * Run with:
 *   npx tsx scripts/test-encryption-and-rotation.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load env (for ENCRYPTION_KEY)
config({ path: resolve(process.cwd(), '.env.local') });

import { encryptKey, decryptKey } from '../src/lib/crypto/encryption';

async function main() {
  console.log('\n🔐 Testing encryption/decryption with mock data\n');

  const envKey = process.env.ENCRYPTION_KEY;
  console.log('ENCRYPTION_KEY set:', !!envKey);
  if (envKey) {
    console.log('ENCRYPTION_KEY length:', envKey.length, 'chars');
  } else {
    console.log('Using temporary dev key (as in app logs).');
  }

  const mockKeys = [
    'sk-or-v1-mock-key-1-1234567890abcdef',
    'sk-or-v1-mock-key-2-abcdef1234567890',
    'sk-or-v1-mock-key-3-0000000000000000',
  ];

  for (const key of mockKeys) {
    console.log('\n---');
    console.log('Original:', key);

    const encrypted = encryptKey(key);
    console.log('Encrypted (base64, first 32 chars):', encrypted.slice(0, 32), '...');

    const decrypted = decryptKey(encrypted);
    console.log('Decrypted:', decrypted);

    if (decrypted !== key) {
      throw new Error('❌ Decrypted key does not match original');
    }

    console.log('✅ Round-trip OK');
  }

  // Simple mock rotation: just cycle through mockKeys
  console.log('\n🔄 Mock rotation over mock keys:');
  let index = 0;
  for (let i = 0; i < 5; i++) {
    const current = mockKeys[index];
    console.log(`Rotation ${i + 1}: using key index ${index} (${current.slice(0, 12)}...)`);
    index = (index + 1) % mockKeys.length;
  }

  console.log('\n✅ Encryption + mock rotation test completed.\n');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});


