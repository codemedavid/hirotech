import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { FacebookClient, FacebookApiError } from './client';
import { StreamingProcessor } from './streaming-processor';
import { ProgressTracker } from './progress-tracker';
import { ContactAggregator } from './contact-aggregator';
import { applyStageScoreRanges } from '@/lib/pipelines/stage-analyzer';

type FacebookPageWithPipeline = Prisma.FacebookPageGetPayload<{
  include: {
    autoPipeline: {
      include: {
        stages: true;
      };
    };
  };
}>;

export interface FastSyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: Array<{ platform: string; id: string; error: string; code?: number }>;
  tokenExpired: boolean;
}

/**
 * Fast Background Sync
 * Orchestrates the entire sync process using streaming, batching, and parallel processing.
 * Maintains backward compatibility with existing SyncJob schema.
 */
export async function executeFastBackgroundSync(
  jobId: string,
  facebookPageId: string
): Promise<FastSyncResult> {
  try {
    // Update job status to in progress
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    // Load page with pipeline configuration
    const page = await prisma.facebookPage.findUnique({
      where: { id: facebookPageId },
      include: {
        autoPipeline: {
          include: {
            stages: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!page) {
      throw new Error('Facebook page not found');
    }

    const client = new FacebookClient(page.pageAccessToken);
    let syncedCount = 0;
    let failedCount = 0;
    let tokenExpired = false;
    const errors: Array<{ platform: string; id: string; error: string; code?: number }> = [];

    console.log(`[Fast Sync ${jobId}] Starting fast sync for Facebook Page: ${page.pageId}`);
    console.log(`[Fast Sync ${jobId}] Auto-Pipeline Enabled:`, !!page.autoPipelineId);

    // Auto-generate score ranges if needed
    if (page.autoPipelineId && page.autoPipeline) {
      const hasDefaultRanges = page.autoPipeline.stages.some(
        (s) => s.leadScoreMin === 0 && s.leadScoreMax === 100
      );

      if (hasDefaultRanges) {
        console.log(`[Fast Sync ${jobId}] Auto-generating score ranges...`);
        await applyStageScoreRanges(page.autoPipelineId);

        // Reload page with updated ranges
        const updatedPage = await prisma.facebookPage.findUnique({
          where: { id: page.id },
          include: {
            autoPipeline: {
              include: {
                stages: { orderBy: { order: 'asc' } },
              },
            },
          },
        });

        if (updatedPage?.autoPipeline) {
          page.autoPipeline = updatedPage.autoPipeline;
        }
      }
    }

    // Initialize aggregator
    const aggregator = new ContactAggregator(200);

    // Pipeline cache for batch assignments
    const pipelineCache = new Map<
      string,
      {
        stages: Array<{
          id: string;
          name: string;
          type: string;
          order: number;
          leadScoreMin: number;
          leadScoreMax: number;
        }>;
      }
    >();

    // Initialize progress tracker
    const progressTracker = new (await import('./progress-tracker')).ProgressTracker(jobId, 50);

    // Process Messenger conversations
    try {
      console.log(`[Fast Sync ${jobId}] Starting Messenger sync...`);

      const processor = new StreamingProcessor(client, {
        pageId: page.pageId,
        organizationId: page.organizationId,
        facebookPageId: page.id,
        autoPipelineId: page.autoPipelineId,
        autoPipelineMode: page.autoPipelineMode,
        pipelineStages: page.autoPipeline?.stages,
        maxConcurrent: 30,
        batchSize: 200,
        useDifferentialSync: true,
      });

      // Track progress
      const messengerResult = await processor.processStream(
        client.fetchMessengerConversationsStream(page.pageId),
        'messenger',
        (processed, total) => {
          // Update progress every 50 contacts
          progressTracker.updateProgress({
            syncedContacts: processed,
            totalContacts: total,
          });
        }
      );

      syncedCount += messengerResult.successCount;
      failedCount += messengerResult.failedCount;
      errors.push(
        ...messengerResult.errors.map((e) => ({
          platform: 'Messenger',
          id: e.participantId,
          error: e.error,
          code: undefined,
        }))
      );
    } catch (error) {
      const errorCode = error instanceof FacebookApiError ? error.code : undefined;
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync Messenger';

      if (error instanceof FacebookApiError && error.isTokenExpired) {
        tokenExpired = true;
      }

      console.error(`[Fast Sync ${jobId}] Messenger sync failed:`, error);
      errors.push({
        platform: 'Messenger',
        id: 'conversations',
        error: errorMessage,
        code: errorCode,
      });
    }

    // Process Instagram conversations (if connected)
    if (page.instagramAccountId && !tokenExpired) {
      try {
        console.log(`[Fast Sync ${jobId}] Starting Instagram sync...`);

        const processor = new StreamingProcessor(client, {
          pageId: page.instagramAccountId,
          organizationId: page.organizationId,
          facebookPageId: page.id,
          autoPipelineId: page.autoPipelineId,
          autoPipelineMode: page.autoPipelineMode,
          pipelineStages: page.autoPipeline?.stages,
          maxConcurrent: 30,
          batchSize: 200,
          useDifferentialSync: true,
        });

        const instagramResult = await processor.processStream(
          client.fetchInstagramConversationsStream(page.instagramAccountId),
          'instagram',
          (processed, total) => {
            // Update progress
            progressTracker.updateProgress({
              syncedContacts: syncedCount + processed,
            });
          }
        );

        syncedCount += instagramResult.successCount;
        failedCount += instagramResult.failedCount;
        errors.push(
          ...instagramResult.errors.map((e) => ({
            platform: 'Instagram',
            id: e.participantId,
            error: e.error,
            code: undefined,
          }))
        );
      } catch (error) {
        const errorCode = error instanceof FacebookApiError ? error.code : undefined;
        const errorMessage = error instanceof Error ? error.message : 'Failed to sync Instagram';

        if (error instanceof FacebookApiError && error.isTokenExpired) {
          tokenExpired = true;
        }

        console.error(`[Fast Sync ${jobId}] Instagram sync failed:`, error);
        errors.push({
          platform: 'Instagram',
          id: 'conversations',
          error: errorMessage,
          code: errorCode,
        });
      }
    }

    // Update last synced time if successful
    if (syncedCount > 0 && !tokenExpired) {
      await prisma.facebookPage.update({
        where: { id: page.id },
        data: { lastSyncedAt: new Date() },
      });
    }

    // Finalize progress tracker
    await progressTracker.finalize({
      syncedContacts: syncedCount,
      failedContacts: failedCount,
      status: tokenExpired ? 'FAILED' : 'COMPLETED',
      errors: errors.length > 0 ? errors : undefined,
    });

    console.log(
      `[Fast Sync ${jobId}] Completed: ${syncedCount} synced, ${failedCount} failed${tokenExpired ? ' (Token expired)' : ''}`
    );

    return {
      success: !tokenExpired,
      syncedCount,
      failedCount,
      errors,
      tokenExpired,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Fast Sync ${jobId}] Fatal error:`, error);

    // Mark job as failed
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errors: [{ error: errorMessage }],
        completedAt: new Date(),
      },
    });

    return {
      success: false,
      syncedCount: 0,
      failedCount: 0,
      errors: [{ platform: 'System', id: jobId, error: errorMessage }],
      tokenExpired: false,
    };
  }
}

