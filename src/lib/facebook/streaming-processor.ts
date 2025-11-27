import { FacebookClient } from './client';
import { analyzeParallel, MessageSet } from '@/lib/ai/parallel-analyzer';
import { batchUpsertContacts, ContactCreateData, batchGetContactIds } from '@/lib/db/batch-operations';
import { batchAssignContactsToPipeline, BatchAssignOptions } from '@/lib/pipelines/batch-assign';
import { getCachedMessages, cacheMessages, filterNewMessages, getLastSyncTimestamp } from '@/lib/cache/message-cache';
import { AIContactAnalysis } from '@/lib/ai/google-ai-service';

export interface ProcessedContact {
  participantId: string;
  conversationId: string;
  firstName: string;
  lastName?: string | null;
  lastInteraction: Date;
  aiAnalysis?: AIContactAnalysis;
  aiContext?: string | null;
  existingContactId?: string;
}

export interface StreamingProcessorOptions {
  pageId: string;
  organizationId: string;
  facebookPageId: string;
  autoPipelineId?: string | null;
  autoPipelineMode?: 'SKIP_EXISTING' | 'UPDATE_EXISTING';
  pipelineStages?: Array<{
    name: string;
    type: string;
    description?: string | null;
    leadScoreMin?: number;
    leadScoreMax?: number;
  }>;
  maxConcurrent?: number;
  batchSize?: number;
  useDifferentialSync?: boolean;
}

export interface StreamingProcessorResult {
  processedCount: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ participantId: string; error: string }>;
}

/**
 * Streaming Pipeline Processor
 * Processes conversations as they arrive (not in batches),
 * maintains backpressure, handles errors gracefully without stopping the stream.
 */
export class StreamingProcessor {
  private client: FacebookClient;
  private options: Required<Omit<StreamingProcessorOptions, 'autoPipelineId' | 'pipelineStages'>> &
    Pick<StreamingProcessorOptions, 'autoPipelineId' | 'pipelineStages'>;
  private processedContacts: ProcessedContact[] = [];
  private errors: Array<{ participantId: string; error: string }> = [];

  constructor(client: FacebookClient, options: StreamingProcessorOptions) {
    this.client = client;
    this.options = {
      pageId: options.pageId,
      organizationId: options.organizationId,
      facebookPageId: options.facebookPageId,
      autoPipelineId: options.autoPipelineId,
      autoPipelineMode: options.autoPipelineMode ?? 'SKIP_EXISTING',
      pipelineStages: options.pipelineStages,
      maxConcurrent: options.maxConcurrent ?? 20,
      batchSize: options.batchSize ?? 100,
      useDifferentialSync: options.useDifferentialSync ?? true,
    };
  }

  /**
   * Process a stream of conversations
   */
  async processStream(
    conversations: AsyncIterable<{
      id: string;
      participants: { data: Array<{ id: string }> };
      updated_time: string;
    }>,
    platform: 'messenger' | 'instagram',
    onProgress?: (processed: number, total: number) => void
  ): Promise<StreamingProcessorResult> {
    let processedCount = 0;
    let totalConversations = 0;

    // Process conversations as they arrive
    for await (const conversation of conversations) {
      totalConversations++;

      // Extract participants (skip page itself)
      const participants = conversation.participants.data.filter(
        (p) => p.id !== this.options.pageId
      );

      // Process each participant
      for (const participant of participants) {
        try {
          const processed = await this.processParticipant(
            participant.id,
            conversation.id,
            conversation.updated_time,
            platform
          );

          if (processed) {
            this.processedContacts.push(processed);
            processedCount++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.errors.push({
            participantId: participant.id,
            error: errorMessage,
          });
        }

        // Report progress
        onProgress?.(processedCount, totalConversations);
      }

      // Batch save when we reach batch size
      if (this.processedContacts.length >= this.options.batchSize) {
        await this.flushBatch();
      }
    }

    // Flush remaining contacts
    if (this.processedContacts.length > 0) {
      await this.flushBatch();
    }

    return {
      processedCount,
      successCount: processedCount - this.errors.length,
      failedCount: this.errors.length,
      errors: this.errors,
    };
  }

  /**
   * Process a single participant
   */
  private async processParticipant(
    participantId: string,
    conversationId: string,
    updatedTime: string,
    platform: 'messenger' | 'instagram'
  ): Promise<ProcessedContact | null> {
    // Check cache first
    let messages = getCachedMessages(conversationId);
    let useCached = false;

    if (!messages) {
      // Fetch messages
      const apiMessages = await this.client.getAllMessagesForConversation(conversationId);
      if (!apiMessages || apiMessages.length === 0) {
        return null;
      }

      // Convert to cache format
      const cachedMessages = apiMessages
        .filter((msg: { message?: string }) => msg.message)
        .map((msg: {
          from?: { name?: string; username?: string; id?: string };
          message?: string;
          created_time?: string;
        }) => ({
          from: msg.from?.name || msg.from?.username || msg.from?.id || 'Unknown',
          text: msg.message || '',
          timestamp: msg.created_time ? new Date(msg.created_time) : undefined,
        }));
      
      messages = cachedMessages;

      // Cache messages
      const lastMessageTime = cachedMessages.length > 0
        ? cachedMessages[cachedMessages.length - 1]?.timestamp
        : undefined;
      cacheMessages(conversationId, cachedMessages, lastMessageTime);
      messages = cachedMessages;
    } else {
      useCached = true;

      // Use differential sync if enabled
      if (this.options.useDifferentialSync) {
        const lastSync = await getLastSyncTimestamp(
          participantId,
          this.options.facebookPageId,
          platform
        );
        messages = filterNewMessages(messages, lastSync);

        // If no new messages, skip processing
        if (messages.length === 0) {
          return null;
        }
      }
    }

    // Extract name from messages
    const userMessage = messages.find(
      (msg) => msg.from === participantId || msg.from.includes(participantId)
    );

    let firstName = platform === 'messenger'
      ? `User ${participantId.slice(-6)}`
      : `IG User ${participantId.slice(-6)}`;
    let lastName: string | null = null;

    if (userMessage?.from) {
      const nameParts = userMessage.from.trim().split(' ');
      firstName = nameParts[0] || firstName;
      if (nameParts.length > 1) {
        lastName = nameParts.slice(1).join(' ');
      }
    }

    // Analyze with AI (if pipeline enabled)
    let aiAnalysis: AIContactAnalysis | undefined;
    let aiContext: string | null = null;

    if (this.options.autoPipelineId && this.options.pipelineStages) {
      const messageSets: MessageSet[] = [
        {
          messages: messages.reverse(), // Oldest first
          conversationAge: new Date(updatedTime),
          metadata: {
            contactId: participantId,
            conversationId,
          },
        },
      ];

      const analysisResults = await analyzeParallel(
        messageSets,
        this.options.pipelineStages,
        this.options.maxConcurrent,
        2 // Fewer retries for streaming
      );

      const result = analysisResults.get(participantId);
      if (result?.result) {
        aiAnalysis = result.result.analysis;
        aiContext = aiAnalysis.summary;
      }
    }

    return {
      participantId,
      conversationId,
      firstName,
      lastName,
      lastInteraction: new Date(updatedTime),
      aiAnalysis,
      aiContext,
    };
  }

  /**
   * Flush current batch to database
   */
  private async flushBatch(): Promise<void> {
    if (this.processedContacts.length === 0) {
      return;
    }

    const batch = this.processedContacts.splice(0, this.options.batchSize);

    try {
      // Batch AI analysis first if needed
      const contactsNeedingAnalysis = batch.filter(
        (c) => !c.aiAnalysis && this.options.autoPipelineId && this.options.pipelineStages
      );

      if (contactsNeedingAnalysis.length > 0) {
        // This would require fetching messages again, which we should have cached
        // For now, skip AI analysis if not already done
        // In a full implementation, we'd batch analyze here
      }

      // Prepare contact data
      const contactData: ContactCreateData[] = batch.map((contact) => ({
        messengerPSID: contact.participantId,
        instagramSID: undefined,
        firstName: contact.firstName,
        lastName: contact.lastName,
        hasMessenger: true,
        hasInstagram: false,
        organizationId: this.options.organizationId,
        facebookPageId: this.options.facebookPageId,
        lastInteraction: contact.lastInteraction,
        aiContext: contact.aiContext,
        aiContextUpdatedAt: contact.aiContext ? new Date() : null,
      }));

      // Batch upsert contacts
      const upsertResult = await batchUpsertContacts(contactData);

      // Get contact IDs by looking them up (we need to optimize this)
      // For now, we'll need to query back to get IDs
      const participantIds = batch.map((c) => c.participantId);
      const contactMap = await batchGetContactIds(
        participantIds,
        this.options.facebookPageId,
        'messenger'
      );

      // Batch assign to pipeline if enabled
      if (this.options.autoPipelineId && batch.some((c) => c.aiAnalysis)) {
        const assignments: BatchAssignOptions[] = batch
          .filter((c) => c.aiAnalysis && contactMap.has(c.participantId))
          .map((c) => {
            const contactInfo = contactMap.get(c.participantId)!;
            return {
              contactId: contactInfo.id,
              aiAnalysis: c.aiAnalysis!,
              pipelineId: this.options.autoPipelineId!,
              updateMode: this.options.autoPipelineMode,
            };
          });

        if (assignments.length > 0) {
          await batchAssignContactsToPipeline(assignments);
        }
      }
    } catch (error) {
      console.error('[Streaming Processor] Batch flush failed:', error);
      // Add to errors
      batch.forEach((contact) => {
        this.errors.push({
          participantId: contact.participantId,
          error: error instanceof Error ? error.message : 'Batch flush failed',
        });
      });
    }
  }
}

