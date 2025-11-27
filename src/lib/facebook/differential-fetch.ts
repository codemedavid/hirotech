import { FacebookClient } from './client';
import { getLastSyncTimestamp } from '@/lib/cache/message-cache';
import { getCachedMessages, cacheMessages } from '@/lib/cache/message-cache';

export interface Message {
  from?: {
    name?: string;
    username?: string;
    id?: string;
  };
  message?: string;
  created_time?: string;
}

export interface DifferentialFetchResult {
  messages: Array<{
    from: string;
    text: string;
    timestamp?: Date;
  }>;
  isFullSync: boolean;
  cached: boolean;
}

/**
 * Differential Message Fetcher
 * Fetches only new messages for existing contacts,
 * skips full conversation fetch when possible.
 */
export async function fetchDifferentialMessages(
  client: FacebookClient,
  conversationId: string,
  participantId: string,
  facebookPageId: string,
  platform: 'messenger' | 'instagram'
): Promise<DifferentialFetchResult> {
  // Check cache first
  const cached = getCachedMessages(conversationId);
  if (cached) {
    // Check if we need to fetch new messages
    const lastSync = await getLastSyncTimestamp(participantId, facebookPageId, platform);

    if (lastSync) {
      // Filter to only new messages
      const newMessages = cached.filter((msg) => {
        if (!msg.timestamp) {
          return true; // Include messages without timestamps
        }
        return msg.timestamp > lastSync;
      });

      // If we have new messages in cache, return them
      if (newMessages.length > 0) {
        return {
          messages: newMessages,
          isFullSync: false,
          cached: true,
        };
      }

      // No new messages, return empty
      return {
        messages: [],
        isFullSync: false,
        cached: true,
      };
    }

    // No last sync time, but we have cache - return cached messages
    return {
      messages: cached,
      isFullSync: false,
      cached: true,
    };
  }

  // No cache, fetch all messages
  const allMessages = await client.getAllMessagesForConversation(conversationId);

  if (!allMessages || allMessages.length === 0) {
    return {
      messages: [],
      isFullSync: true,
      cached: false,
    };
  }

  // Convert to standard format
  const formattedMessages = allMessages
    .filter((msg: Message) => msg.message)
    .map((msg: Message) => ({
      from: msg.from?.name || msg.from?.username || msg.from?.id || 'Unknown',
      text: msg.message || '',
      timestamp: msg.created_time ? new Date(msg.created_time) : undefined,
    }))
    .reverse(); // Oldest first

  // Cache the messages
  const lastMessageTime =
    formattedMessages.length > 0
      ? formattedMessages[formattedMessages.length - 1]?.timestamp
      : undefined;
  cacheMessages(conversationId, formattedMessages, lastMessageTime);

  // Check if we need to filter to only new messages
  const lastSync = await getLastSyncTimestamp(participantId, facebookPageId, platform);

  if (lastSync) {
    const newMessages = formattedMessages.filter((msg) => {
      if (!msg.timestamp) {
        return true;
      }
      return msg.timestamp > lastSync;
    });

    return {
      messages: newMessages,
      isFullSync: false,
      cached: false,
    };
  }

  // No last sync, return all messages
  return {
    messages: formattedMessages,
    isFullSync: true,
    cached: false,
  };
}

/**
 * Check if differential sync is possible for a contact
 */
export async function canUseDifferentialSync(
  participantId: string,
  facebookPageId: string,
  platform: 'messenger' | 'instagram'
): Promise<boolean> {
  const lastSync = await getLastSyncTimestamp(participantId, facebookPageId, platform);
  return lastSync !== null;
}

