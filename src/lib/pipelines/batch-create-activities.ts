import { prisma } from '@/lib/db';
import { ActivityType } from '@prisma/client';

export interface BatchActivityData {
  contactId: string;
  type: ActivityType;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  fromStageId?: string | null;
  toStageId?: string | null;
  userId?: string | null;
}

export interface BatchActivityResult {
  created: number;
  failed: number;
  errors: Array<{ contactId: string; error: string }>;
}

/**
 * Batch create multiple contact activities efficiently
 * Reduces database queries from N individual creates to single createMany
 */
export async function batchCreateActivities(
  activities: BatchActivityData[]
): Promise<BatchActivityResult> {
  const result: BatchActivityResult = {
    created: 0,
    failed: 0,
    errors: [],
  };

  if (activities.length === 0) {
    return result;
  }

  try {
    // Use createMany for efficient batch insertion
    // Note: createMany doesn't return created records, but it's much faster
    const createResult = await prisma.contactActivity.createMany({
      data: activities.map((activity) => ({
        contactId: activity.contactId,
        type: activity.type,
        title: activity.title,
        description: activity.description ?? null,
        metadata: activity.metadata ?? null,
        fromStageId: activity.fromStageId ?? null,
        toStageId: activity.toStageId ?? null,
        userId: activity.userId ?? null,
      })),
      skipDuplicates: true, // Skip if duplicate (prevents errors)
    });

    result.created = createResult.count;
    console.log(`[Batch Activities] Created ${result.created} activities`);
  } catch (error) {
    // If batch create fails, try individual creates as fallback
    console.error('[Batch Activities] Batch create failed, falling back to individual creates:', error);
    
    for (const activity of activities) {
      try {
        await prisma.contactActivity.create({
          data: {
            contactId: activity.contactId,
            type: activity.type,
            title: activity.title,
            description: activity.description ?? null,
            metadata: activity.metadata ?? null,
            fromStageId: activity.fromStageId ?? null,
            toStageId: activity.toStageId ?? null,
            userId: activity.userId ?? null,
          },
        });
        result.created++;
      } catch (individualError) {
        const errorMessage = individualError instanceof Error ? individualError.message : 'Unknown error';
        result.failed++;
        result.errors.push({
          contactId: activity.contactId,
          error: errorMessage,
        });
      }
    }
  }

  console.log(`[Batch Activities] Complete: ${result.created} created, ${result.failed} failed`);
  return result;
}

