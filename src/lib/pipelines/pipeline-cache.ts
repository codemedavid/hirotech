import { prisma } from '@/lib/db';

interface PipelineStage {
  id: string;
  name: string;
  type: string;
  order: number;
  leadScoreMin: number;
  leadScoreMax: number;
  description?: string | null;
}

interface PipelineWithStages {
  id: string;
  name: string;
  description?: string | null;
  stages: PipelineStage[];
}

interface PipelineCacheEntry {
  pipeline: PipelineWithStages;
  cachedAt: number;
  ttl: number; // Time to live in milliseconds
}

/**
 * Pipeline Cache Manager
 * Caches pipeline data in memory to prevent repeated database queries
 * Reduces connection pool usage significantly
 */
class PipelineCache {
  private cache = new Map<string, PipelineCacheEntry>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100; // Prevent memory leaks

  /**
   * Get pipeline with stages from cache or database
   * @param pipelineId - The pipeline ID to fetch
   * @param ttl - Optional custom TTL in milliseconds (default: 5 minutes)
   * @returns Pipeline with stages
   */
  async get(pipelineId: string, ttl?: number): Promise<PipelineWithStages | null> {
    const cacheKey = pipelineId;
    const entry = this.cache.get(cacheKey);
    const now = Date.now();
    const cacheTtl = ttl || this.DEFAULT_TTL;

    // Check if cached entry is still valid
    if (entry && (now - entry.cachedAt) < entry.ttl) {
      console.log(`[Pipeline Cache] Cache hit for pipeline ${pipelineId}`);
      return entry.pipeline;
    }

    // Cache miss or expired - load from database
    console.log(`[Pipeline Cache] Cache miss for pipeline ${pipelineId}, loading from database...`);
    
    try {
      const pipeline = await prisma.pipeline.findUnique({
        where: { id: pipelineId },
        include: {
          stages: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              name: true,
              type: true,
              order: true,
              leadScoreMin: true,
              leadScoreMax: true,
              description: true,
            },
          },
        },
      });

      if (!pipeline) {
        console.warn(`[Pipeline Cache] Pipeline ${pipelineId} not found`);
        return null;
      }

      // Transform to match interface
      const pipelineWithStages: PipelineWithStages = {
        id: pipeline.id,
        name: pipeline.name,
        description: pipeline.description,
        stages: pipeline.stages.map((stage) => ({
          id: stage.id,
          name: stage.name,
          type: stage.type,
          order: stage.order,
          leadScoreMin: stage.leadScoreMin,
          leadScoreMax: stage.leadScoreMax,
          description: stage.description,
        })),
      };

      // Cache the result
      this.set(cacheKey, pipelineWithStages, cacheTtl);

      return pipelineWithStages;
    } catch (error) {
      console.error(`[Pipeline Cache] Error loading pipeline ${pipelineId}:`, error);
      return null;
    }
  }

  /**
   * Set pipeline in cache
   * @param pipelineId - The pipeline ID
   * @param pipeline - The pipeline data to cache
   * @param ttl - Time to live in milliseconds
   */
  private set(pipelineId: string, pipeline: PipelineWithStages, ttl: number): void {
    // Prevent memory leaks by limiting cache size
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entry (simple LRU-like behavior)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(pipelineId, {
      pipeline,
      cachedAt: Date.now(),
      ttl,
    });

    console.log(`[Pipeline Cache] Cached pipeline ${pipelineId} (TTL: ${ttl}ms)`);
  }

  /**
   * Invalidate cache for a specific pipeline
   * Useful when pipeline stages are updated
   */
  invalidate(pipelineId: string): void {
    this.cache.delete(pipelineId);
    console.log(`[Pipeline Cache] Invalidated cache for pipeline ${pipelineId}`);
  }

  /**
   * Clear all cached pipelines
   */
  clear(): void {
    this.cache.clear();
    console.log('[Pipeline Cache] Cleared all cached pipelines');
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; entries: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      entries: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const pipelineCache = new PipelineCache();

