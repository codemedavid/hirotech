import { prisma } from '@/lib/db';

/**
 * Message Cache Manager
 * Caches conversation messages with TTL and supports differential sync
 * by tracking last sync timestamp.
 */

export interface CachedMessage {
  from: string;
  text: string;
  timestamp?: Date;
}

interface CacheEntry {
  messages: CachedMessage[];
  cachedAt: Date;
  conversationId: string;
  lastMessageTime?: Date;
}

// In-memory cache (can be replaced with Redis in production)
const messageCache = new Map<string, CacheEntry>();

// Cache TTL: 1 hour
const CACHE_TTL_MS = 60 * 60 * 1000;

// Maximum cache size (prevent memory issues)
const MAX_CACHE_SIZE = 10000;

/**
 * Get cached messages for a conversation
 * Returns null if cache miss or expired
 */
export function getCachedMessages(conversationId: string): CachedMessage[] | null {
  const entry = messageCache.get(conversationId);

  if (!entry) {
    return null;
  }

  // Check if cache expired
  const age = Date.now() - entry.cachedAt.getTime();
  if (age > CACHE_TTL_MS) {
    messageCache.delete(conversationId);
    return null;
  }

  return entry.messages;
}

/**
 * Cache messages for a conversation
 */
export function cacheMessages(
  conversationId: string,
  messages: CachedMessage[],
  lastMessageTime?: Date
): void {
  // Evict oldest entries if cache is full
  if (messageCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = Array.from(messageCache.entries())
      .sort((a, b) => a[1].cachedAt.getTime() - b[1].cachedAt.getTime())[0]?.[0];

    if (oldestKey) {
      messageCache.delete(oldestKey);
    }
  }

  messageCache.set(conversationId, {
    messages,
    cachedAt: new Date(),
    conversationId,
    lastMessageTime,
  });
}

/**
 * Get last sync timestamp for a contact
 * Used for differential sync
 */
export async function getLastSyncTimestamp(
  participantId: string,
  facebookPageId: string,
  platform: 'messenger' | 'instagram'
): Promise<Date | null> {
  const contact = await prisma.contact.findFirst({
    where:
      platform === 'messenger'
        ? {
            messengerPSID: participantId,
            facebookPageId,
          }
        : {
            OR: [
              { instagramSID: participantId, facebookPageId },
              { messengerPSID: participantId, facebookPageId },
            ],
          },
    select: {
      aiContextUpdatedAt: true,
      lastInteraction: true,
    },
  });

  // Return the most recent timestamp
  if (!contact) {
    return null;
  }

  const timestamps = [contact.aiContextUpdatedAt, contact.lastInteraction].filter(
    (t): t is Date => t !== null
  );

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps.map((t) => t.getTime())));
}

/**
 * Check if conversation needs full sync or can use differential
 * Returns true if differential sync is possible (has cached messages and last sync time)
 */
export function canUseDifferentialSync(conversationId: string): boolean {
  const entry = messageCache.get(conversationId);
  return entry !== undefined && entry.lastMessageTime !== undefined;
}

/**
 * Filter messages to only include new ones since last sync
 * Used for differential sync
 */
export function filterNewMessages(
  allMessages: CachedMessage[],
  lastSyncTime: Date | null
): CachedMessage[] {
  if (!lastSyncTime) {
    return allMessages;
  }

  return allMessages.filter((msg) => {
    if (!msg.timestamp) {
      return true; // Include messages without timestamps
    }
    return msg.timestamp > lastSyncTime;
  });
}

/**
 * Clear cache for a specific conversation
 */
export function clearCache(conversationId: string): void {
  messageCache.delete(conversationId);
}

/**
 * Clear all cached messages
 */
export function clearAllCache(): void {
  messageCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  maxSize: number;
  hitRate?: number;
} {
  return {
    size: messageCache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}

