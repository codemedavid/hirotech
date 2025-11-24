import { NextResponse } from 'next/server';
import { encryptKey, decryptKey } from '@/lib/crypto/encryption';

/**
 * GET /api/test-encryption
 * Test endpoint to verify encryption is working
 * Only available in development or with proper auth
 */
export async function GET() {
  try {
    // Check if ENCRYPTION_KEY is set
    const hasKey = !!process.env.ENCRYPTION_KEY;
    const keyLength = process.env.ENCRYPTION_KEY?.length || 0;
    const keyPreview = process.env.ENCRYPTION_KEY 
      ? process.env.ENCRYPTION_KEY.substring(0, 8) + '...' 
      : 'NOT SET';

    // Test encryption/decryption
    let encryptionWorks = false;
    let errorMessage = '';

    try {
      const testText = 'test-encryption-key-12345';
      const encrypted = encryptKey(testText);
      const decrypted = decryptKey(encrypted);
      encryptionWorks = decrypted === testText;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }

    return NextResponse.json({
      success: encryptionWorks,
      hasEncryptionKey: hasKey,
      encryptionKeyLength: keyLength,
      encryptionKeyPreview: keyPreview,
      encryptionWorks,
      error: errorMessage || null,
      nodeEnv: process.env.NODE_ENV,
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

