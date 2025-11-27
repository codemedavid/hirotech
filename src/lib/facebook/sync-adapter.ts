import { startBackgroundSync, getLatestSyncJob } from './background-sync';
import { executeFastBackgroundSync } from './fast-background-sync';

export interface SyncRequest {
  facebookPageId: string;
  useFastSync?: boolean; // Feature flag for gradual rollout
}

export interface SyncResponse {
  success: boolean;
  jobId: string;
  message: string;
  useFastSync: boolean;
}

/**
 * Backward Compatibility Layer
 * Detects sync type, routes to appropriate handler (old or new),
 * ensures existing API contracts remain unchanged.
 */
export async function startSync(request: SyncRequest): Promise<SyncResponse> {
  const useFastSync = request.useFastSync ?? false; // Default to old system for safety

  if (useFastSync) {
    // Use new fast sync system
    try {
      // Check for existing job
      const existingJob = await getLatestSyncJob(request.facebookPageId);
      if (existingJob && (existingJob.status === 'PENDING' || existingJob.status === 'IN_PROGRESS')) {
        return {
          success: true,
          jobId: existingJob.id,
          message: 'Sync already in progress',
          useFastSync: true,
        };
      }

      // Create new job using the same method as old system
      const syncJob = await startBackgroundSync(request.facebookPageId);

      // Start fast sync in background (replace the old executeBackgroundSync)
      executeFastBackgroundSync(syncJob.jobId, request.facebookPageId).catch((error) => {
        console.error(`[Sync Adapter] Fast sync failed for job ${syncJob.jobId}:`, error);
      });

      return {
        success: true,
        jobId: syncJob.jobId,
        message: 'Fast sync started',
        useFastSync: true,
      };
    } catch (error) {
      console.error('[Sync Adapter] Fast sync start failed, falling back to old system:', error);
      // Fallback to old system
      const result = await startBackgroundSync(request.facebookPageId);
      return {
        ...result,
        useFastSync: false,
      };
    }
  } else {
    // Use old sync system
    const result = await startBackgroundSync(request.facebookPageId);
    return {
      ...result,
      useFastSync: false,
    };
  }
}

/**
 * Check if fast sync is available for a page
 * Can be used for feature flagging
 */
export async function isFastSyncAvailable(facebookPageId: string): Promise<boolean> {
  // For now, always return true
  // In the future, this could check:
  // - Feature flags per organization
  // - Page-specific settings
  // - System load
  return true;
}

