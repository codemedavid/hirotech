import { prisma } from '@/lib/db';
import { LeadStatus } from '@prisma/client';

export interface BatchContactUpdate {
  contactId: string;
  pipelineId?: string | null;
  stageId?: string | null;
  leadScore?: number;
  leadStatus?: LeadStatus;
  aiContext?: string;
  aiContextUpdatedAt?: Date;
  stageEnteredAt?: Date;
}

export interface BatchUpdateResult {
  updated: number;
  failed: number;
  errors: Array<{ contactId: string; error: string }>;
}

/**
 * Batch update multiple contacts efficiently
 * Reduces database queries from N individual updates to grouped updates
 */
export async function batchUpdateContacts(
  updates: BatchContactUpdate[]
): Promise<BatchUpdateResult> {
  const result: BatchUpdateResult = {
    updated: 0,
    failed: 0,
    errors: [],
  };

  if (updates.length === 0) {
    return result;
  }

  // Group updates by unique data combinations to minimize updateMany calls
  const updateGroups = new Map<string, {
    contactIds: string[];
    data: {
      pipelineId?: string | null;
      stageId?: string | null;
      leadScore?: number;
      leadStatus?: LeadStatus;
      aiContext?: string;
      aiContextUpdatedAt?: Date;
      stageEnteredAt?: Date;
    };
  }>();

  for (const update of updates) {
    // Create a key based on the update data (excluding contactId)
    const dataKey = JSON.stringify({
      pipelineId: update.pipelineId ?? null,
      stageId: update.stageId ?? null,
      leadScore: update.leadScore,
      leadStatus: update.leadStatus,
      aiContext: update.aiContext,
      aiContextUpdatedAt: update.aiContextUpdatedAt?.toISOString(),
      stageEnteredAt: update.stageEnteredAt?.toISOString(),
    });

    if (!updateGroups.has(dataKey)) {
      updateGroups.set(dataKey, {
        contactIds: [],
        data: {
          pipelineId: update.pipelineId,
          stageId: update.stageId,
          leadScore: update.leadScore,
          leadStatus: update.leadStatus,
          aiContext: update.aiContext,
          aiContextUpdatedAt: update.aiContextUpdatedAt,
          stageEnteredAt: update.stageEnteredAt,
        },
      });
    }

    updateGroups.get(dataKey)!.contactIds.push(update.contactId);
  }

  // Execute batch updates
  for (const [dataKey, group] of updateGroups) {
    try {
      // Build update data, excluding undefined values
      const updateData: Record<string, unknown> = {};
      
      if (group.data.pipelineId !== undefined) {
        updateData.pipelineId = group.data.pipelineId;
      }
      if (group.data.stageId !== undefined) {
        updateData.stageId = group.data.stageId;
      }
      if (group.data.leadScore !== undefined) {
        updateData.leadScore = group.data.leadScore;
      }
      if (group.data.leadStatus !== undefined) {
        updateData.leadStatus = group.data.leadStatus;
      }
      if (group.data.aiContext !== undefined) {
        updateData.aiContext = group.data.aiContext;
      }
      if (group.data.aiContextUpdatedAt !== undefined) {
        updateData.aiContextUpdatedAt = group.data.aiContextUpdatedAt;
      }
      if (group.data.stageEnteredAt !== undefined) {
        updateData.stageEnteredAt = group.data.stageEnteredAt;
      }

      const updateResult = await prisma.contact.updateMany({
        where: {
          id: { in: group.contactIds },
        },
        data: updateData,
      });

      result.updated += updateResult.count;
      console.log(`[Batch Update] Updated ${updateResult.count} contacts with data key: ${dataKey.substring(0, 50)}...`);
    } catch (error) {
      // If batch update fails, mark all contacts in this group as failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Batch Update] Failed to update ${group.contactIds.length} contacts:`, errorMessage);
      
      for (const contactId of group.contactIds) {
        result.failed++;
        result.errors.push({
          contactId,
          error: errorMessage,
        });
      }
    }
  }

  console.log(`[Batch Update] Complete: ${result.updated} updated, ${result.failed} failed`);
  return result;
}

