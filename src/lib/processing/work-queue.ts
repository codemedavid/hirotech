/**
 * Work Queue Manager
 * Manages work queue with priority levels, parallel workers,
 * progress tracking, and graceful shutdown.
 */

export interface Task<T = unknown> {
  id: string;
  priority: number; // Higher = more important
  data: T;
  retries?: number;
  maxRetries?: number;
}

export interface TaskResult<T = unknown> {
  taskId: string;
  success: boolean;
  result?: T;
  error?: string;
  retries: number;
}

export type TaskProcessor<T = unknown, R = unknown> = (task: Task<T>) => Promise<R>;

export interface WorkQueueOptions {
  maxConcurrent?: number;
  retryDelay?: number;
  onTaskComplete?: (result: TaskResult) => void;
  onTaskError?: (result: TaskResult) => void;
}

/**
 * Work Queue with priority support and parallel processing
 */
export class WorkQueue<T = unknown, R = unknown> {
  private queue: Task<T>[] = [];
  private running = new Set<string>();
  private completed = new Map<string, TaskResult<R>>();
  private processor: TaskProcessor<T, R>;
  private options: Required<WorkQueueOptions>;
  private isShuttingDown = false;

  constructor(processor: TaskProcessor<T, R>, options: WorkQueueOptions = {}) {
    this.processor = processor;
    this.options = {
      maxConcurrent: options.maxConcurrent ?? 10,
      retryDelay: options.retryDelay ?? 1000,
      onTaskComplete: options.onTaskComplete ?? (() => {}),
      onTaskError: options.onTaskError ?? (() => {}),
    };
  }

  /**
   * Add a task to the queue
   */
  enqueue(task: Task<T>): void {
    if (this.isShuttingDown) {
      throw new Error('Queue is shutting down');
    }

    // Insert in priority order (higher priority first)
    const index = this.queue.findIndex((t) => t.priority < task.priority);
    if (index === -1) {
      this.queue.push(task);
    } else {
      this.queue.splice(index, 0, task);
    }

    // Start processing if not already running
    this.process();
  }

  /**
   * Add multiple tasks at once
   */
  enqueueBatch(tasks: Task<T>[]): void {
    for (const task of tasks) {
      this.enqueue(task);
    }
  }

  /**
   * Process tasks from the queue
   */
  private async process(): Promise<void> {
    // Don't start new tasks if at limit or shutting down
    while (
      !this.isShuttingDown &&
      this.running.size < this.options.maxConcurrent &&
      this.queue.length > 0
    ) {
      const task = this.queue.shift();
      if (!task) break;

      this.running.add(task.id);

      // Execute task
      this.executeTask(task)
        .then((result) => {
          this.completed.set(task.id, result);
          this.options.onTaskComplete(result);
        })
        .catch((error) => {
          const result: TaskResult<R> = {
            taskId: task.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            retries: task.retries ?? 0,
          };
          this.completed.set(task.id, result);
          this.options.onTaskError(result);
        })
        .finally(() => {
          this.running.delete(task.id);
          // Continue processing
          this.process();
        });
    }
  }

  /**
   * Execute a single task with retry logic
   */
  private async executeTask(task: Task<T>): Promise<TaskResult<R>> {
    const retries = task.retries ?? 0;
    const maxRetries = task.maxRetries ?? 3;

    try {
      const result = await this.processor(task);
      return {
        taskId: task.id,
        success: true,
        result,
        retries,
      };
    } catch (error) {
      // Retry if allowed
      if (retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, this.options.retryDelay * (retries + 1)));

        // Re-enqueue with incremented retry count
        const retryTask: Task<T> = {
          ...task,
          retries: retries + 1,
        };
        this.enqueue(retryTask);

        return {
          taskId: task.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          retries: retries + 1,
        };
      }

      // Max retries exceeded
      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        retries,
      };
    }
  }

  /**
   * Wait for all tasks to complete
   */
  async waitForCompletion(): Promise<Map<string, TaskResult<R>>> {
    while (this.queue.length > 0 || this.running.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return new Map(this.completed);
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queued: number;
    running: number;
    completed: number;
  } {
    return {
      queued: this.queue.length,
      running: this.running.size,
      completed: this.completed.size,
    };
  }

  /**
   * Gracefully shutdown the queue
   * Waits for running tasks to complete, but doesn't start new ones
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    await this.waitForCompletion();
  }

  /**
   * Clear the queue (doesn't wait for running tasks)
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Get results for completed tasks
   */
  getResults(): Map<string, TaskResult<R>> {
    return new Map(this.completed);
  }

  /**
   * Get a specific task result
   */
  getResult(taskId: string): TaskResult<R> | undefined {
    return this.completed.get(taskId);
  }
}

