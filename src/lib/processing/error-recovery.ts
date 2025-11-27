/**
 * Error Recovery System
 * Intelligent error recovery with exponential backoff,
 * dead letter queue for persistent failures.
 */

export interface FailedTask {
  id: string;
  task: unknown;
  error: Error;
  attempts: number;
  lastAttempt: Date;
  nextRetry?: Date;
}

export interface ErrorRecoveryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  enableDeadLetterQueue?: boolean;
}

export class ErrorRecovery {
  private failedTasks: Map<string, FailedTask> = new Map();
  private deadLetterQueue: FailedTask[] = [];
  private options: Required<ErrorRecoveryOptions>;

  constructor(options: ErrorRecoveryOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      initialDelay: options.initialDelay ?? 1000,
      maxDelay: options.maxDelay ?? 60000,
      backoffMultiplier: options.backoffMultiplier ?? 2,
      enableDeadLetterQueue: options.enableDeadLetterQueue ?? true,
    };
  }

  /**
   * Record a failed task
   */
  recordFailure(taskId: string, task: unknown, error: Error): FailedTask {
    const existing = this.failedTasks.get(taskId);

    if (existing) {
      existing.attempts++;
      existing.lastAttempt = new Date();
      existing.error = error;
      existing.nextRetry = this.calculateNextRetry(existing.attempts);
      return existing;
    }

    const failedTask: FailedTask = {
      id: taskId,
      task,
      error,
      attempts: 1,
      lastAttempt: new Date(),
      nextRetry: this.calculateNextRetry(1),
    };

    this.failedTasks.set(taskId, failedTask);
    return failedTask;
  }

  /**
   * Check if a task should be retried
   */
  shouldRetry(taskId: string): boolean {
    const failedTask = this.failedTasks.get(taskId);
    if (!failedTask) {
      return false;
    }

    // Check if max retries exceeded
    if (failedTask.attempts >= this.options.maxRetries) {
      // Move to dead letter queue
      if (this.options.enableDeadLetterQueue) {
        this.deadLetterQueue.push(failedTask);
        this.failedTasks.delete(taskId);
      }
      return false;
    }

    // Check if it's time to retry
    if (failedTask.nextRetry && failedTask.nextRetry > new Date()) {
      return false;
    }

    return true;
  }

  /**
   * Get tasks ready for retry
   */
  getRetryableTasks(): FailedTask[] {
    const now = new Date();
    return Array.from(this.failedTasks.values()).filter(
      (task) => task.nextRetry && task.nextRetry <= now && task.attempts < this.options.maxRetries
    );
  }

  /**
   * Mark a task as successfully recovered
   */
  markRecovered(taskId: string): void {
    this.failedTasks.delete(taskId);
  }

  /**
   * Calculate next retry time using exponential backoff
   */
  private calculateNextRetry(attempts: number): Date {
    const delay = Math.min(
      this.options.initialDelay * Math.pow(this.options.backoffMultiplier, attempts - 1),
      this.options.maxDelay
    );

    return new Date(Date.now() + delay);
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(): FailedTask[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(): void {
    this.deadLetterQueue = [];
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeFailures: number;
    deadLetterCount: number;
    retryableCount: number;
  } {
    return {
      activeFailures: this.failedTasks.size,
      deadLetterCount: this.deadLetterQueue.length,
      retryableCount: this.getRetryableTasks().length,
    };
  }
}

