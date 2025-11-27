import { analyzeWithFallback, EnhancedAnalysisResult } from './enhanced-analysis';
import { AIContactAnalysis } from './google-ai-service';

export interface MessageSet {
  messages: Array<{
    from: string;
    text: string;
    timestamp?: Date;
  }>;
  conversationAge?: Date;
  metadata?: {
    contactId?: string;
    conversationId?: string;
  };
}

export interface ParallelAnalysisResult {
  result: EnhancedAnalysisResult;
  metadata?: {
    contactId?: string;
    conversationId?: string;
  };
}

/**
 * Parallel AI Analysis Queue
 * Processes multiple AI analyses in parallel with intelligent batching,
 * rate limit management, and automatic retry with key rotation.
 */
export class ParallelAnalyzer {
  private readonly maxConcurrent: number;
  private readonly batchSize: number;
  private readonly delayBetweenBatches: number;

  constructor(
    maxConcurrent = 20,
    batchSize = 50,
    delayBetweenBatches = 100
  ) {
    this.maxConcurrent = maxConcurrent;
    this.batchSize = batchSize;
    this.delayBetweenBatches = delayBetweenBatches;
  }

  /**
   * Process multiple message sets in parallel
   * Returns a map of results keyed by contactId or conversationId
   */
  async analyzeParallel(
    messageSets: MessageSet[],
    pipelineStages?: Array<{
      name: string;
      type: string;
      description?: string | null;
      leadScoreMin?: number;
      leadScoreMax?: number;
    }>,
    maxRetries = 3
  ): Promise<Map<string, ParallelAnalysisResult>> {
    const results = new Map<string, ParallelAnalysisResult>();

    if (messageSets.length === 0) {
      return results;
    }

    // Process in batches to manage memory and rate limits
    for (let i = 0; i < messageSets.length; i += this.batchSize) {
      const batch = messageSets.slice(i, i + this.batchSize);
      const batchResults = await this.processBatch(batch, pipelineStages, maxRetries);

      // Merge results
      for (const [key, result] of batchResults) {
        results.set(key, result);
      }

      // Delay between batches to respect rate limits
      if (i + this.batchSize < messageSets.length) {
        await new Promise((resolve) => setTimeout(resolve, this.delayBetweenBatches));
      }
    }

    return results;
  }

  /**
   * Process a single batch with concurrency control
   */
  private async processBatch(
    batch: MessageSet[],
    pipelineStages: Array<{
      name: string;
      type: string;
      description?: string | null;
      leadScoreMin?: number;
      leadScoreMax?: number;
    }> | undefined,
    maxRetries: number
  ): Promise<Map<string, ParallelAnalysisResult>> {
    const results = new Map<string, ParallelAnalysisResult>();
    const queue = [...batch];
    const running = new Set<Promise<void>>();

    // Process with concurrency limit
    while (queue.length > 0 || running.size > 0) {
      // Start new tasks up to concurrency limit
      while (running.size < this.maxConcurrent && queue.length > 0) {
        const messageSet = queue.shift()!;
        const key = messageSet.metadata?.contactId || messageSet.metadata?.conversationId || `task-${Date.now()}-${Math.random()}`;

        const task = this.analyzeSingle(messageSet, pipelineStages, maxRetries)
          .then((result) => {
            results.set(key, {
              result,
              metadata: messageSet.metadata,
            });
          })
          .catch((error) => {
            console.error(`[Parallel Analyzer] Failed to analyze ${key}:`, error);
            // Provide fallback result
            results.set(key, {
              result: {
                analysis: {
                  summary: 'Analysis failed',
                  recommendedStage: pipelineStages?.[0]?.name || 'New Lead',
                  leadScore: 15,
                  leadStatus: 'NEW',
                  confidence: 0,
                  reasoning: 'Analysis failed due to error',
                },
                usedFallback: true,
                retryCount: maxRetries,
              },
              metadata: messageSet.metadata,
            });
          })
          .finally(() => {
            running.delete(task);
          });

        running.add(task);
      }

      // Wait for at least one task to complete
      if (running.size > 0) {
        await Promise.race(Array.from(running));
      }
    }

    return results;
  }

  /**
   * Analyze a single message set
   */
  private async analyzeSingle(
    messageSet: MessageSet,
    pipelineStages: Array<{
      name: string;
      type: string;
      description?: string | null;
      leadScoreMin?: number;
      leadScoreMax?: number;
    }> | undefined,
    maxRetries: number
  ): Promise<EnhancedAnalysisResult> {
    return analyzeWithFallback(
      messageSet.messages,
      pipelineStages,
      messageSet.conversationAge,
      maxRetries
    );
  }

  /**
   * Analyze with progress callback
   * Useful for long-running operations
   */
  async analyzeWithProgress(
    messageSets: MessageSet[],
    pipelineStages: Array<{
      name: string;
      type: string;
      description?: string | null;
      leadScoreMin?: number;
      leadScoreMax?: number;
    }> | undefined,
    onProgress?: (completed: number, total: number) => void,
    maxRetries = 3
  ): Promise<Map<string, ParallelAnalysisResult>> {
    const results = new Map<string, ParallelAnalysisResult>();
    let completed = 0;
    const total = messageSets.length;

    // Process in batches
    for (let i = 0; i < messageSets.length; i += this.batchSize) {
      const batch = messageSets.slice(i, i + this.batchSize);
      const batchResults = await this.processBatch(batch, pipelineStages, maxRetries);

      // Merge results
      for (const [key, result] of batchResults) {
        results.set(key, result);
        completed++;
        onProgress?.(completed, total);
      }

      // Delay between batches
      if (i + this.batchSize < messageSets.length) {
        await new Promise((resolve) => setTimeout(resolve, this.delayBetweenBatches));
      }
    }

    return results;
  }
}

/**
 * Default instance for convenience
 */
export const parallelAnalyzer = new ParallelAnalyzer();

/**
 * Convenience function for parallel analysis
 */
export async function analyzeParallel(
  messageSets: MessageSet[],
  pipelineStages?: Array<{
    name: string;
    type: string;
    description?: string | null;
    leadScoreMin?: number;
    leadScoreMax?: number;
  }>,
  maxConcurrent = 20,
  maxRetries = 3
): Promise<Map<string, ParallelAnalysisResult>> {
  const analyzer = new ParallelAnalyzer(maxConcurrent);
  return analyzer.analyzeParallel(messageSets, pipelineStages, maxRetries);
}

