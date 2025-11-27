import { prisma } from '@/lib/db';
import { LeadStatus } from '@prisma/client';

/**
 * Batch Database Operations Module
 * Provides batched createMany/updateMany operations for contacts
 * with proper error handling and transaction support.
 */

export interface ContactCreateData {
  messengerPSID?: string | null;
  instagramSID?: string | null;
  firstName: string;
  lastName?: string | null;
  hasMessenger?: boolean;
  hasInstagram?: boolean;
  organizationId: string;
  facebookPageId: string;
  lastInteraction: Date;
  aiContext?: string | null;
  aiContextUpdatedAt?: Date | null;
}

export interface ContactUpdateData {
  firstName?: string;
  lastName?: string | null;
  hasMessenger?: boolean;
  hasInstagram?: boolean;
  lastInteraction?: Date;
  aiContext?: string | null;
  aiContextUpdatedAt?: Date | null;
  leadScore?: number;
  leadStatus?: string;
  pipelineId?: string | null;
  stageId?: string | null;
  stageEnteredAt?: Date | null;
}

export interface BatchOperationResult {
  successCount: number;
  failureCount: number;
  errors: Array<{ contactId: string; error: string }>;
  createdContactIds: string[];
  updatedContactIds: string[];
}

/**
 * Batch create contacts with conflict handling
 * Uses createMany for bulk inserts, falls back to individual upserts for conflicts
 */
export async function batchCreateContacts(
  contacts: ContactCreateData[],
  batchSize = 100
): Promise<BatchOperationResult> {
  const result: BatchOperationResult = {
    successCount: 0,
    failureCount: 0,
    errors: [],
    createdContactIds: [],
    updatedContactIds: [],
  };

  if (contacts.length === 0) {
    return result;
  }

  // Process in batches to avoid transaction size limits
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);

    try {
      // Try bulk create first
      await prisma.contact.createMany({
        data: batch.map((contact) => ({
          messengerPSID: contact.messengerPSID,
          instagramSID: contact.instagramSID,
          firstName: contact.firstName,
          lastName: contact.lastName,
          hasMessenger: contact.hasMessenger ?? false,
          hasInstagram: contact.hasInstagram ?? false,
          organizationId: contact.organizationId,
          facebookPageId: contact.facebookPageId,
          lastInteraction: contact.lastInteraction,
          aiContext: contact.aiContext,
          aiContextUpdatedAt: contact.aiContextUpdatedAt,
        })),
        skipDuplicates: true,
      });

      // Fetch created contacts to get IDs
      const created = await prisma.contact.findMany({
        where: {
          OR: batch.map((contact) => ({
            AND: [
              contact.messengerPSID
                ? { messengerPSID: contact.messengerPSID }
                : { instagramSID: contact.instagramSID },
              { facebookPageId: contact.facebookPageId },
            ],
          })),
        },
        select: { id: true },
      });

      result.successCount += created.length;
      result.createdContactIds.push(...created.map((c) => c.id));
    } catch (error) {
      // Fallback to individual upserts for this batch
      console.warn(`[Batch Create] Bulk create failed for batch, falling back to individual upserts:`, error);

      for (const contact of batch) {
        try {
          const saved = await prisma.contact.upsert({
            where: contact.messengerPSID
              ? {
                  messengerPSID_facebookPageId: {
                    messengerPSID: contact.messengerPSID,
                    facebookPageId: contact.facebookPageId,
                  },
                }
              : {
                  instagramSID_facebookPageId: {
                    instagramSID: contact.instagramSID!,
                    facebookPageId: contact.facebookPageId,
                  },
                },
            create: {
              messengerPSID: contact.messengerPSID,
              instagramSID: contact.instagramSID,
              firstName: contact.firstName,
              lastName: contact.lastName,
              hasMessenger: contact.hasMessenger ?? false,
              hasInstagram: contact.hasInstagram ?? false,
              organizationId: contact.organizationId,
              facebookPageId: contact.facebookPageId,
              lastInteraction: contact.lastInteraction,
              aiContext: contact.aiContext,
              aiContextUpdatedAt: contact.aiContextUpdatedAt,
            },
            update: {
              firstName: contact.firstName,
              lastName: contact.lastName,
              hasMessenger: contact.hasMessenger ?? false,
              hasInstagram: contact.hasInstagram ?? false,
              lastInteraction: contact.lastInteraction,
              aiContext: contact.aiContext,
              aiContextUpdatedAt: contact.aiContextUpdatedAt,
            },
          });

          result.successCount++;
          if (saved) {
            result.createdContactIds.push(saved.id);
          }
        } catch (err) {
          result.failureCount++;
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          result.errors.push({
            contactId: contact.messengerPSID || contact.instagramSID || 'unknown',
            error: errorMessage,
          });
        }
      }
    }
  }

  return result;
}

/**
 * Batch update contacts by ID
 * Uses updateMany for bulk updates
 */
export async function batchUpdateContacts(
  updates: Array<{ contactId: string; data: ContactUpdateData }>,
  batchSize = 100
): Promise<BatchOperationResult> {
  const result: BatchOperationResult = {
    successCount: 0,
    failureCount: 0,
    errors: [],
    createdContactIds: [],
    updatedContactIds: [],
  };

  if (updates.length === 0) {
    return result;
  }

  // Group updates by fields to enable bulk updates where possible
  const updatesByFields = new Map<string, Array<{ contactId: string; data: ContactUpdateData }>>();

  for (const update of updates) {
    const key = Object.keys(update.data).sort().join(',');
    if (!updatesByFields.has(key)) {
      updatesByFields.set(key, []);
    }
    updatesByFields.get(key)!.push(update);
  }

  // Process each group
  for (const [_, group] of updatesByFields) {
    // For now, process individually to handle different field combinations
    // Future optimization: group by exact same data values
    for (let i = 0; i < group.length; i += batchSize) {
      const batch = group.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (update) => {
          try {
            await prisma.contact.update({
              where: { id: update.contactId },
              data: {
                firstName: update.data.firstName,
                lastName: update.data.lastName,
                hasMessenger: update.data.hasMessenger,
                hasInstagram: update.data.hasInstagram,
                lastInteraction: update.data.lastInteraction,
                aiContext: update.data.aiContext,
                aiContextUpdatedAt: update.data.aiContextUpdatedAt,
                leadScore: update.data.leadScore,
                leadStatus: update.data.leadStatus as LeadStatus | undefined,
                pipelineId: update.data.pipelineId,
                stageId: update.data.stageId,
                stageEnteredAt: update.data.stageEnteredAt,
              },
            });

            result.successCount++;
            result.updatedContactIds.push(update.contactId);
          } catch (error) {
            result.failureCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push({
              contactId: update.contactId,
              error: errorMessage,
            });
          }
        })
      );
    }
  }

  return result;
}

/**
 * Batch upsert contacts (create or update)
 * Optimized for high-throughput scenarios
 */
export async function batchUpsertContacts(
  contacts: Array<ContactCreateData & { existingContactId?: string }>,
  batchSize = 100
): Promise<BatchOperationResult> {
  const result: BatchOperationResult = {
    successCount: 0,
    failureCount: 0,
    errors: [],
    createdContactIds: [],
    updatedContactIds: [],
  };

  if (contacts.length === 0) {
    return result;
  }

  // Separate into creates and updates
  const toCreate: ContactCreateData[] = [];
  const toUpdate: Array<{ contactId: string; data: ContactUpdateData }> = [];

  for (const contact of contacts) {
    if (contact.existingContactId) {
      toUpdate.push({
        contactId: contact.existingContactId,
        data: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          hasMessenger: contact.hasMessenger,
          hasInstagram: contact.hasInstagram,
          lastInteraction: contact.lastInteraction,
          aiContext: contact.aiContext,
          aiContextUpdatedAt: contact.aiContextUpdatedAt,
        },
      });
    } else {
      toCreate.push(contact);
    }
  }

  // Execute creates and updates in parallel
  const [createResult, updateResult] = await Promise.all([
    batchCreateContacts(toCreate, batchSize),
    batchUpdateContacts(toUpdate, batchSize),
  ]);

  // Merge results
  result.successCount = createResult.successCount + updateResult.successCount;
  result.failureCount = createResult.failureCount + updateResult.failureCount;
  result.errors = [...createResult.errors, ...updateResult.errors];
  result.createdContactIds = createResult.createdContactIds;
  result.updatedContactIds = updateResult.updatedContactIds;

  return result;
}

/**
 * Get contact IDs by participant IDs (batch lookup)
 * Optimized for checking existing contacts
 */
export async function batchGetContactIds(
  participantIds: string[],
  facebookPageId: string,
  platform: 'messenger' | 'instagram'
): Promise<Map<string, { id: string; pipelineId: string | null }>> {
  const map = new Map<string, { id: string; pipelineId: string | null }>();

  if (participantIds.length === 0) {
    return map;
  }

  const whereClause =
    platform === 'messenger'
      ? {
          messengerPSID: { in: participantIds },
          facebookPageId,
        }
      : {
          OR: [
            { instagramSID: { in: participantIds }, facebookPageId },
            { messengerPSID: { in: participantIds }, facebookPageId },
          ],
        };

  const contacts = await prisma.contact.findMany({
    where: whereClause,
    select: {
      id: true,
      messengerPSID: true,
      instagramSID: true,
      pipelineId: true,
    },
  });

  for (const contact of contacts) {
    const participantId =
      platform === 'messenger' ? contact.messengerPSID : contact.instagramSID || contact.messengerPSID;

    if (participantId) {
      map.set(participantId, {
        id: contact.id,
        pipelineId: contact.pipelineId,
      });
    }
  }

  return map;
}

