import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64; // 512 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const ITERATIONS = 100000;

/**
 * Get encryption key from environment variable
 * Falls back to generating a key if not set (for development only)
 */
function getEncryptionKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  
  if (!encryptionKey) {
    // In development, generate a key (this should be set in production!)
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Encryption] ENCRYPTION_KEY not set, using temporary key. Set ENCRYPTION_KEY in production!');
      // Generate a deterministic temporary key for development
      return crypto.pbkdf2Sync('temporary-dev-key', 'salt', ITERATIONS, KEY_LENGTH, 'sha256');
    }
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  // Expect hex string, convert to buffer
  if (encryptionKey.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  try {
    return Buffer.from(encryptionKey, 'hex');
  } catch {
    throw new Error('ENCRYPTION_KEY must be a valid hex string');
  }
}

/**
 * Encrypt an API key using AES-256-GCM
 * Returns a base64-encoded string containing IV + salt + tag + encrypted data
 */
export function encryptKey(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty string');
  }

  const key = getEncryptionKey();
  
  // Generate random IV and salt for each encryption
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  // Derive a key from the encryption key using PBKDF2
  const derivedKey = crypto.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, 'sha256');
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  
  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  // Get authentication tag
  const tag = cipher.getAuthTag();
  
  // Combine IV + salt + tag + encrypted data
  const combined = Buffer.concat([iv, salt, tag, encrypted]);
  
  // Return as base64
  return combined.toString('base64');
}

/**
 * Decrypt an API key using AES-256-GCM
 * Expects a base64-encoded string containing IV + salt + tag + encrypted data
 */
export function decryptKey(encryptedData: string): string {
  if (!encryptedData) {
    throw new Error('Cannot decrypt empty string');
  }

  try {
    const key = getEncryptionKey();
    
    // Decode from base64
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const salt = combined.subarray(IV_LENGTH, IV_LENGTH + SALT_LENGTH);
    const tag = combined.subarray(IV_LENGTH + SALT_LENGTH, IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
    
    // Derive the same key using PBKDF2
    const derivedKey = crypto.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, 'sha256');
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(tag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
    throw new Error('Decryption failed: Unknown error');
  }
}

/**
 * Generate a secure encryption key (for initial setup)
 * Returns a hex-encoded 32-byte key suitable for ENCRYPTION_KEY env var
 */
export function generateEncryptionKey(): string {
  const key = crypto.randomBytes(KEY_LENGTH);
  return key.toString('hex');
}

