import { ContactCreateData } from '@/lib/db/batch-operations';
import { AIContactAnalysis } from '@/lib/ai/google-ai-service';

export interface AggregatedContact {
  participantId: string;
  conversationId: string;
  firstName: string;
  lastName?: string | null;
  lastInteraction: Date;
  aiAnalysis?: AIContactAnalysis;
  aiContext?: string | null;
  platform: 'messenger' | 'instagram';
  existingContactId?: string;
}

export interface ContactBatch {
  contacts: ContactCreateData[];
  aiAnalyses: Map<string, AIContactAnalysis>;
  metadata: Map<string, { participantId: string; conversationId: string }>;
}

/**
 * Contact Data Aggregator
 * Aggregates processed contacts into optimal batch sizes (100-500)
 * for database operations.
 */
export class ContactAggregator {
  private batchSize: number;
  private contacts: AggregatedContact[] = [];

  constructor(batchSize = 200) {
    this.batchSize = batchSize;
  }

  /**
   * Add a contact to the aggregator
   */
  add(contact: AggregatedContact): void {
    this.contacts.push(contact);
  }

  /**
   * Add multiple contacts
   */
  addBatch(contacts: AggregatedContact[]): void {
    this.contacts.push(...contacts);
  }

  /**
   * Check if batch is ready
   */
  isReady(): boolean {
    return this.contacts.length >= this.batchSize;
  }

  /**
   * Get current batch size
   */
  getSize(): number {
    return this.contacts.length;
  }

  /**
   * Flush current batch and return it
   * Returns null if no contacts
   */
  flush(): ContactBatch | null {
    if (this.contacts.length === 0) {
      return null;
    }

    const batch = this.contacts.splice(0, this.batchSize);

    // Convert to ContactCreateData format
    const contactData: ContactCreateData[] = batch.map((contact) => ({
      messengerPSID: contact.platform === 'messenger' ? contact.participantId : null,
      instagramSID: contact.platform === 'instagram' ? contact.participantId : null,
      firstName: contact.firstName,
      lastName: contact.lastName,
      hasMessenger: contact.platform === 'messenger',
      hasInstagram: contact.platform === 'instagram',
      organizationId: '', // Will be set by caller
      facebookPageId: '', // Will be set by caller
      lastInteraction: contact.lastInteraction,
      aiContext: contact.aiContext,
      aiContextUpdatedAt: contact.aiContext ? new Date() : null,
    }));

    // Create AI analyses map (keyed by participantId for lookup after DB insert)
    const aiAnalyses = new Map<string, AIContactAnalysis>();
    const metadata = new Map<string, { participantId: string; conversationId: string }>();

    for (const contact of batch) {
      if (contact.aiAnalysis) {
        aiAnalyses.set(contact.participantId, contact.aiAnalysis);
      }
      metadata.set(contact.participantId, {
        participantId: contact.participantId,
        conversationId: contact.conversationId,
      });
    }

    return {
      contacts: contactData,
      aiAnalyses,
      metadata,
    };
  }

  /**
   * Flush all remaining contacts
   */
  flushAll(): ContactBatch | null {
    if (this.contacts.length === 0) {
      return null;
    }

    // Temporarily set batch size to current size to flush everything
    const originalBatchSize = this.batchSize;
    this.batchSize = this.contacts.length;
    const result = this.flush();
    this.batchSize = originalBatchSize;
    return result;
  }

  /**
   * Clear all contacts
   */
  clear(): void {
    this.contacts = [];
  }

  /**
   * Get all contacts without flushing
   */
  peek(): AggregatedContact[] {
    return [...this.contacts];
  }
}

