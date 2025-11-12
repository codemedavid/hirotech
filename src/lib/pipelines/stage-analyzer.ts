import { prisma } from '@/lib/db';

/**
 * Intelligent Stage Analyzer
 * Automatically assigns lead score ranges to pipeline stages based on:
 * - Stage type (LEAD, IN_PROGRESS, WON, LOST, ARCHIVED)
 * - Stage order (position in pipeline)
 * - Number of stages in pipeline
 */

interface StageScoreRange {
  stageId: string;
  leadScoreMin: number;
  leadScoreMax: number;
}

/**
 * Calculate optimal lead score ranges for all stages in a pipeline
 */
export async function calculateStageScoreRanges(pipelineId: string): Promise<StageScoreRange[]> {
  // Fetch pipeline with stages
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: {
      stages: {
        orderBy: { order: 'asc' }
      }
    }
  });

  if (!pipeline) {
    throw new Error(`Pipeline ${pipelineId} not found`);
  }

  const stages = pipeline.stages;
  if (stages.length === 0) {
    return [];
  }

  const scoreRanges: StageScoreRange[] = [];

  // Separate stages by type for smart scoring
  const leadStages = stages.filter(s => s.type === 'LEAD');
  const inProgressStages = stages.filter(s => s.type === 'IN_PROGRESS');
  const wonStages = stages.filter(s => s.type === 'WON');
  const lostStages = stages.filter(s => s.type === 'LOST');
  const archivedStages = stages.filter(s => s.type === 'ARCHIVED');

  // Calculate ranges based on pipeline structure
  let currentScore = 0;

  // 1. LEAD stages: 0-30 range (cold to warm leads)
  if (leadStages.length > 0) {
    const rangeSize = 30 / leadStages.length;
    leadStages.forEach((stage, index) => {
      const min = Math.round(currentScore);
      const max = index === leadStages.length - 1 
        ? 30 
        : Math.round(currentScore + rangeSize);
      
      scoreRanges.push({
        stageId: stage.id,
        leadScoreMin: min,
        leadScoreMax: max
      });
      
      currentScore = max;
    });
  }

  // 2. IN_PROGRESS stages: 31-80 range (qualified to closing)
  if (inProgressStages.length > 0) {
    currentScore = 31;
    const rangeSize = 50 / inProgressStages.length;
    
    inProgressStages.forEach((stage, index) => {
      const min = Math.round(currentScore);
      const max = index === inProgressStages.length - 1 
        ? 80 
        : Math.round(currentScore + rangeSize);
      
      scoreRanges.push({
        stageId: stage.id,
        leadScoreMin: min,
        leadScoreMax: max
      });
      
      currentScore = max;
    });
  }

  // 3. WON stages: 81-100 range (hot leads to closed won)
  if (wonStages.length > 0) {
    currentScore = 81;
    const rangeSize = 20 / wonStages.length;
    
    wonStages.forEach((stage, index) => {
      const min = Math.round(currentScore);
      const max = index === wonStages.length - 1 
        ? 100 
        : Math.round(currentScore + rangeSize);
      
      scoreRanges.push({
        stageId: stage.id,
        leadScoreMin: min,
        leadScoreMax: max
      });
      
      currentScore = max;
    });
  }

  // 4. LOST stages: 0-20 range (low scores indicate lost opportunity)
  if (lostStages.length > 0) {
    lostStages.forEach(stage => {
      scoreRanges.push({
        stageId: stage.id,
        leadScoreMin: 0,
        leadScoreMax: 20
      });
    });
  }

  // 5. ARCHIVED stages: 0-100 range (accept any score)
  if (archivedStages.length > 0) {
    archivedStages.forEach(stage => {
      scoreRanges.push({
        stageId: stage.id,
        leadScoreMin: 0,
        leadScoreMax: 100
      });
    });
  }

  console.log(`[Stage Analyzer] Calculated score ranges for pipeline ${pipeline.name}:`);
  scoreRanges.forEach(range => {
    const stage = stages.find(s => s.id === range.stageId);
    console.log(`  - ${stage?.name}: ${range.leadScoreMin}-${range.leadScoreMax}`);
  });

  return scoreRanges;
}

/**
 * Apply calculated score ranges to pipeline stages
 */
export async function applyStageScoreRanges(pipelineId: string): Promise<void> {
  const scoreRanges = await calculateStageScoreRanges(pipelineId);

  // Update each stage with its calculated range
  await Promise.all(
    scoreRanges.map(range =>
      prisma.pipelineStage.update({
        where: { id: range.stageId },
        data: {
          leadScoreMin: range.leadScoreMin,
          leadScoreMax: range.leadScoreMax
        }
      })
    )
  );

  console.log(`[Stage Analyzer] Applied score ranges to ${scoreRanges.length} stages`);
}

/**
 * Prevent high-score contacts from being downgraded to low stages
 * Protects valuable leads from being moved to early/low-value stages
 */
export function shouldPreventDowngrade(
  currentStageOrder: number | null,
  targetStageOrder: number,
  currentScore: number,
  newScore: number,
  targetStageMin: number
): boolean {
  // Prevent contacts with 80+ scores from going to stages with min score < 50
  // These are hot leads that deserve advanced stages
  if (newScore >= 80 && targetStageMin < 50) {
    console.log(`[Stage Analyzer] Prevented downgrade: Score ${newScore} too high for stage (min: ${targetStageMin})`);
    return true;
  }

  // Prevent contacts with 50+ scores from going to "New Lead" type stages (min score < 20)
  // Qualified leads shouldn't be sent back to initial stages
  if (newScore >= 50 && targetStageMin < 20) {
    console.log(`[Stage Analyzer] Prevented downgrade: Score ${newScore} blocked from low stage (min: ${targetStageMin})`);
    return true;
  }

  // Allow movement if score is higher and stage is appropriate
  return false;
}

/**
 * Find the best matching stage for a contact based on lead score and status
 */
export async function findBestMatchingStage(
  pipelineId: string,
  leadScore: number,
  leadStatus: string
): Promise<string | null> {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: {
      stages: {
        orderBy: { order: 'asc' }
      }
    }
  });

  if (!pipeline) {
    return null;
  }

  const stages = pipeline.stages;

  // 1. PRIORITY ROUTING: Route by status first
  // If status is WON, route to WON stage
  if (leadStatus === 'WON') {
    const wonStage = stages.find(s => s.type === 'WON');
    if (wonStage) {
      console.log(`[Stage Analyzer] Status-based routing: WON → ${wonStage.name}`);
      return wonStage.id;
    }
  }

  // If status is LOST, route to LOST stage
  if (leadStatus === 'LOST') {
    const lostStage = stages.find(s => s.type === 'LOST');
    if (lostStage) {
      console.log(`[Stage Analyzer] Status-based routing: LOST → ${lostStage.name}`);
      return lostStage.id;
    }
  }

  // 2. SCORE-BASED ROUTING: Find stage where lead score falls within range
  const matchingStage = stages.find(stage => 
    leadScore >= stage.leadScoreMin && 
    leadScore <= stage.leadScoreMax &&
    stage.type !== 'WON' &&  // Skip WON/LOST unless explicitly matched above
    stage.type !== 'LOST' &&
    stage.type !== 'ARCHIVED'
  );

  if (matchingStage) {
    console.log(`[Stage Analyzer] Score-based routing: ${leadScore} → ${matchingStage.name} (${matchingStage.leadScoreMin}-${matchingStage.leadScoreMax})`);
    return matchingStage.id;
  }

  // 3. FALLBACK: Find closest stage by lead score
  let closestStage = stages[0];
  let closestDistance = Math.abs((stages[0].leadScoreMin + stages[0].leadScoreMax) / 2 - leadScore);

  for (const stage of stages) {
    if (stage.type === 'ARCHIVED') continue;
    
    const stageMidpoint = (stage.leadScoreMin + stage.leadScoreMax) / 2;
    const distance = Math.abs(stageMidpoint - leadScore);
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestStage = stage;
    }
  }

  console.log(`[Stage Analyzer] Fallback routing: ${leadScore} → ${closestStage.name} (closest match)`);
  return closestStage.id;
}

/**
 * Get stage score distribution summary
 */
export async function getStageScoreDistribution(pipelineId: string) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: {
      stages: {
        orderBy: { order: 'asc' },
        include: {
          _count: {
            select: { contacts: true }
          }
        }
      }
    }
  });

  if (!pipeline) {
    return null;
  }

  return {
    pipelineName: pipeline.name,
    stages: pipeline.stages.map(stage => ({
      name: stage.name,
      type: stage.type,
      scoreRange: `${stage.leadScoreMin}-${stage.leadScoreMax}`,
      contactCount: stage._count.contacts,
      avgScore: stage.leadScoreMin + (stage.leadScoreMax - stage.leadScoreMin) / 2
    }))
  };
}

/**
 * Auto-generate score ranges for all pipelines in an organization
 */
export async function autoGenerateAllPipelineRanges(organizationId: string): Promise<number> {
  const pipelines = await prisma.pipeline.findMany({
    where: { organizationId, isArchived: false },
    include: {
      stages: {
        orderBy: { order: 'asc' }
      }
    }
  });

  console.log(`[Stage Analyzer] Auto-generating score ranges for ${pipelines.length} pipelines...`);

  let updatedCount = 0;
  for (const pipeline of pipelines) {
    if (pipeline.stages.length > 0) {
      await applyStageScoreRanges(pipeline.id);
      updatedCount++;
    }
  }

  console.log(`[Stage Analyzer] Updated ${updatedCount} pipelines with intelligent score ranges`);
  return updatedCount;
}

