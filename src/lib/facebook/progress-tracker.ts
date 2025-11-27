import { prisma } from '@/lib/db';

/**
 * Progress Tracking Optimizer
 * Batches progress updates (update every N contacts instead of every contact),
 * reduces database writes.
 */
export class ProgressTracker {
  private jobId: string;
  private updateInterval: number;
  private lastUpdate: number = 0;
  private pendingUpdates: {
    syncedContacts?: number;
    failedContacts?: number;
    totalContacts?: number;
  } = {};

  constructor(jobId: string, updateInterval = 50) {
    this.jobId = jobId;
    this.updateInterval = updateInterval;
  }

  /**
   * Update progress (batched)
   */
  async updateProgress(updates: {
    syncedContacts?: number;
    failedContacts?: number;
    totalContacts?: number;
  }): Promise<void> {
    // Merge with pending updates
    this.pendingUpdates = {
      ...this.pendingUpdates,
      ...updates,
    };

    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdate;

    // Update if interval has passed or if this is a critical update
    if (timeSinceLastUpdate >= this.updateInterval * 1000 || updates.totalContacts !== undefined) {
      await this.flush();
    }
  }

  /**
   * Flush pending updates to database
   */
  async flush(): Promise<void> {
    if (Object.keys(this.pendingUpdates).length === 0) {
      return;
    }

    try {
      await prisma.syncJob.update({
        where: { id: this.jobId },
        data: this.pendingUpdates,
      });

      this.lastUpdate = Date.now();
      this.pendingUpdates = {};
    } catch (error) {
      console.error('[Progress Tracker] Failed to update progress:', error);
      // Don't throw - progress updates are non-critical
    }
  }

  /**
   * Force immediate update
   */
  async forceUpdate(updates: {
    syncedContacts?: number;
    failedContacts?: number;
    totalContacts?: number;
  }): Promise<void> {
    this.pendingUpdates = {
      ...this.pendingUpdates,
      ...updates,
    };
    await this.flush();
  }

  /**
   * Final update (always flushes)
   */
  async finalize(updates: {
    syncedContacts?: number;
    failedContacts?: number;
    totalContacts?: number;
    status?: 'COMPLETED' | 'FAILED' | 'CANCELLED';
    errors?: Array<{ error: string } | { platform: string; id: string; error: string; code?: number }>;
  }): Promise<void> {
    await prisma.syncJob.update({
      where: { id: this.jobId },
      data: {
        ...this.pendingUpdates,
        ...updates,
        completedAt: updates.status ? new Date() : undefined,
      },
    });

    this.pendingUpdates = {};
  }
}

