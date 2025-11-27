import { prisma } from '@/lib/db';
import { decryptKey } from '@/lib/crypto/encryption';
import { ApiKeyStatus } from '@prisma/client';

/**
 * Database-backed API Key Manager
 * Replaces environment variable-based key rotation with database storage
 */
class ApiKeyManager {
  private currentIndex: number = 0;
  private activeKeyIds: string[] = [];
  private lastRefresh: number = 0;
  private readonly CACHE_TTL = 300000; // Cache for 5 minutes (increased from 60s)
  private refreshDebounceTimer: NodeJS.Timeout | null = null;
  private readonly REFRESH_DEBOUNCE_MS = 5000; // Debounce refresh calls by 5 seconds

  /**
   * Get the next available API key in round-robin fashion
   * Automatically skips rate-limited and disabled keys
   * SKIPS DATABASE QUERIES if NVIDIA_API_KEY env var is set
   */
  async getNextKey(): Promise<string | null> {
    // OPTIMIZATION: If env var is set, skip all database operations
    if (process.env.NVIDIA_API_KEY) {
      return process.env.NVIDIA_API_KEY;
    }

    try {
      // Refresh cache if stale
      const now = Date.now();
      if (now - this.lastRefresh > this.CACHE_TTL || this.activeKeyIds.length === 0) {
        await this.refreshActiveKeysDebounced();
      }

      if (this.activeKeyIds.length === 0) {
        console.warn('[ApiKeyManager] No active keys available');
        return null;
      }

      // Round-robin selection
      const keyId = this.activeKeyIds[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.activeKeyIds.length;

      // Get and decrypt the key
      const apiKeyRecord = await prisma.apiKey.findUnique({
        where: { id: keyId },
      });

      if (!apiKeyRecord || apiKeyRecord.status !== ApiKeyStatus.ACTIVE) {
        // Key was disabled or rate-limited since cache refresh, refresh and retry
        await this.refreshActiveKeysDebounced();
        if (this.activeKeyIds.length === 0) {
          return null;
        }
        // Try again with fresh cache
        return this.getNextKey();
      }

      // Update last used timestamp (fire-and-forget, non-blocking)
      prisma.apiKey.update({
        where: { id: keyId },
        data: { lastUsedAt: new Date() },
      }).catch((err: unknown) => {
        // Non-critical, just log
        console.warn('[ApiKeyManager] Failed to update lastUsedAt:', err);
      });

      // Decrypt and return the key
      const decryptedKey = decryptKey(apiKeyRecord.encryptedKey);
      
      console.log(`[ApiKeyManager] Using key ${keyId} (${apiKeyRecord.name || 'unnamed'})`);
      
      return decryptedKey;
    } catch (error) {
      console.error('[ApiKeyManager] Error getting next key:', error);
      return null;
    }
  }

  /**
   * Refresh the cache of active key IDs with debouncing
   * Prevents rapid successive refreshes from exhausting connection pool
   */
  private async refreshActiveKeysDebounced(): Promise<void> {
    // If env var is set, skip database refresh
    if (process.env.NVIDIA_API_KEY) {
      return;
    }

    // Debounce: if a refresh is already scheduled, wait for it
    if (this.refreshDebounceTimer) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.refreshDebounceTimer) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    // Schedule refresh with debounce
    this.refreshDebounceTimer = setTimeout(() => {
      this.refreshDebounceTimer = null;
    }, this.REFRESH_DEBOUNCE_MS);

    return this.refreshActiveKeys();
  }

  /**
   * Refresh the cache of active key IDs
   */
  private async refreshActiveKeys(): Promise<void> {
    // Skip if env var is set
    if (process.env.NVIDIA_API_KEY) {
      return;
    }

    try {
      const activeKeys = await prisma.apiKey.findMany({
        where: {
          status: ApiKeyStatus.ACTIVE,
        },
        select: {
          id: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      this.activeKeyIds = activeKeys.map((k: { id: string }) => k.id);
      this.lastRefresh = Date.now();
      
      if (this.activeKeyIds.length > 0) {
        // Reset index to avoid out-of-bounds
        this.currentIndex = this.currentIndex % this.activeKeyIds.length;
        console.log(`[ApiKeyManager] Refreshed active keys cache: ${this.activeKeyIds.length} keys available`);
      }
    } catch (error) {
      console.error('[ApiKeyManager] Error refreshing active keys:', error);
      this.activeKeyIds = [];
    }
  }

  /**
   * Mark a key as rate-limited
   * Sets status to RATE_LIMITED and records the timestamp
   * NON-BLOCKING: Fire-and-forget to avoid connection pool exhaustion
   */
  async markRateLimited(keyIdOrDecryptedKey: string): Promise<void> {
    // Skip if using env var
    if (process.env.NVIDIA_API_KEY) {
      return;
    }

    // Fire-and-forget: don't block on this operation
    this.markRateLimitedAsync(keyIdOrDecryptedKey).catch((error) => {
      console.error('[ApiKeyManager] Error marking key as rate-limited (async):', error);
    });
  }

  /**
   * Internal async method for marking rate-limited
   */
  private async markRateLimitedAsync(keyIdOrDecryptedKey: string): Promise<void> {
    try {
      // Find key by ID or by matching decrypted key
      const apiKey = await this.findKeyByIdOrValue(keyIdOrDecryptedKey);

      if (!apiKey) {
        console.warn('[ApiKeyManager] Key not found for rate limit marking');
        return;
      }

      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: {
          status: ApiKeyStatus.RATE_LIMITED,
          rateLimitedAt: new Date(),
          consecutiveFailures: { increment: 1 },
          failedRequests: { increment: 1 },
          totalRequests: { increment: 1 },
        },
      });

      // Invalidate cache to exclude this key (debounced)
      await this.refreshActiveKeysDebounced();
      
      console.log(`[ApiKeyManager] Marked key ${apiKey.id} as rate-limited`);
    } catch (error) {
      console.error('[ApiKeyManager] Error marking key as rate-limited:', error);
    }
  }

  /**
   * Record a successful API call
   * NON-BLOCKING: Fire-and-forget to avoid connection pool exhaustion
   */
  async recordSuccess(keyIdOrDecryptedKey: string): Promise<void> {
    // Skip if using env var (no database tracking needed)
    if (process.env.NVIDIA_API_KEY) {
      return;
    }

    // Fire-and-forget: don't block on this operation
    this.recordSuccessAsync(keyIdOrDecryptedKey).catch(() => {
      // Silently fail - this is non-critical
    });
  }

  /**
   * Internal async method for recording success
   */
  private async recordSuccessAsync(keyIdOrDecryptedKey: string): Promise<void> {
    try {
      const apiKey = await this.findKeyByIdOrValue(keyIdOrDecryptedKey);

      if (!apiKey) {
        return;
      }

      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: {
          lastSuccessAt: new Date(),
          lastUsedAt: new Date(),
          consecutiveFailures: 0, // Reset on success
          totalRequests: { increment: 1 },
        },
      });
    } catch (error) {
      // Non-critical, just log
      console.warn('[ApiKeyManager] Error recording success:', error);
    }
  }

  /**
   * Record a failed API call (non-rate-limit)
   * NON-BLOCKING: Fire-and-forget to avoid connection pool exhaustion
   */
  async recordFailure(keyIdOrDecryptedKey: string): Promise<void> {
    // Skip if using env var
    if (process.env.NVIDIA_API_KEY) {
      return;
    }

    // Fire-and-forget: don't block on this operation
    this.recordFailureAsync(keyIdOrDecryptedKey).catch(() => {
      // Silently fail - this is non-critical
    });
  }

  /**
   * Internal async method for recording failure
   */
  private async recordFailureAsync(keyIdOrDecryptedKey: string): Promise<void> {
    try {
      const apiKey = await this.findKeyByIdOrValue(keyIdOrDecryptedKey);

      if (!apiKey) {
        return;
      }

      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: {
          lastUsedAt: new Date(),
          consecutiveFailures: { increment: 1 },
          failedRequests: { increment: 1 },
          totalRequests: { increment: 1 },
        },
      });

      // If too many consecutive failures, consider disabling
      const updated = await prisma.apiKey.findUnique({
        where: { id: apiKey.id },
      });

      if (updated && updated.consecutiveFailures >= 10 && updated.status === ApiKeyStatus.ACTIVE) {
        console.warn(`[ApiKeyManager] Key ${apiKey.id} has ${updated.consecutiveFailures} consecutive failures, consider disabling`);
      }
    } catch (error) {
      console.warn('[ApiKeyManager] Error recording failure:', error);
    }
  }

  /**
   * Mark a key as invalid (401/authentication errors)
   * Disables the key and removes it from active rotation
   * NON-BLOCKING: Fire-and-forget to avoid connection pool exhaustion
   */
  async markInvalid(keyIdOrDecryptedKey: string, reason: string = 'Authentication failed'): Promise<void> {
    // Skip if using env var
    if (process.env.NVIDIA_API_KEY) {
      return;
    }

    // Fire-and-forget: don't block on this operation
    this.markInvalidAsync(keyIdOrDecryptedKey, reason).catch((error) => {
      console.error('[ApiKeyManager] Error marking key as invalid (async):', error);
    });
  }

  /**
   * Internal async method for marking invalid
   */
  private async markInvalidAsync(keyIdOrDecryptedKey: string, reason: string): Promise<void> {
    try {
      const apiKeyRecord = await this.findKeyByIdOrValue(keyIdOrDecryptedKey);

      if (!apiKeyRecord) {
        console.warn('[ApiKeyManager] Key not found for invalidation marking');
        return;
      }

      // Get full key record to access name
      const fullKey = await prisma.apiKey.findUnique({
        where: { id: apiKeyRecord.id },
        select: { id: true, name: true },
      });

      await prisma.apiKey.update({
        where: { id: apiKeyRecord.id },
        data: {
          status: ApiKeyStatus.DISABLED,
          consecutiveFailures: { increment: 1 },
          failedRequests: { increment: 1 },
          totalRequests: { increment: 1 },
        },
      });

      // Invalidate cache to exclude this key (debounced)
      await this.refreshActiveKeysDebounced();
      
      const keyName = fullKey?.name || 'unnamed';
      console.error(`[ApiKeyManager] ⚠️ Marked key ${apiKeyRecord.id} (${keyName}) as DISABLED - ${reason}`);
      console.error(`[ApiKeyManager] Please check this key in the API Keys settings and update it if needed`);
    } catch (error) {
      console.error('[ApiKeyManager] Error marking key as invalid:', error);
    }
  }

  /**
   * Find a key by ID or by matching decrypted key value
   * This allows tracking by either identifier
   */
  private async findKeyByIdOrValue(keyIdOrDecryptedKey: string): Promise<{ id: string } | null> {
    // Try as ID first (most common case)
    const byId = await prisma.apiKey.findUnique({
      where: { id: keyIdOrDecryptedKey },
      select: { id: true },
    });

    if (byId) {
      return byId;
    }

    // If not found as ID, try matching against all keys (slower, but needed for backward compatibility)
    // This is only used when we have the decrypted key but not the ID
    const allKeys = await prisma.apiKey.findMany({
      select: {
        id: true,
        encryptedKey: true,
      },
    });

    for (const key of allKeys) {
      try {
        const decrypted = decryptKey(key.encryptedKey);
        if (decrypted === keyIdOrDecryptedKey) {
          return { id: key.id };
        }
      } catch {
        // Skip invalid keys
        continue;
      }
    }

    return null;
  }

  /**
   * Get count of available keys
   */
  async getKeyCount(): Promise<number> {
    // If env var is set, return 1 (we have one key from env)
    if (process.env.NVIDIA_API_KEY) {
      return 1;
    }

    try {
      const count = await prisma.apiKey.count({
        where: {
          status: ApiKeyStatus.ACTIVE,
        },
      });
      return count;
    } catch (error) {
      console.error('[ApiKeyManager] Error getting key count:', error);
      return 0;
    }
  }

  /**
   * Get all keys with their metadata (for admin UI)
   */
  async getAllKeys() {
    try {
      return await prisma.apiKey.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      console.error('[ApiKeyManager] Error getting all keys:', error);
      return [];
    }
  }
}

// Singleton instance
const apiKeyManager = new ApiKeyManager();

export default apiKeyManager;

