import { prisma } from '@/lib/db';
import { AIContactAnalysis } from '@/lib/ai/google-ai-service';
import { LeadStatus } from '@prisma/client';
import { findBestMatchingStage, shouldPreventDowngrade } from './stage-analyzer';

interface AutoAssignOptions {
  contactId: string;
  aiAnalysis: AIContactAnalysis;
  pipelineId: string;
  updateMode: 'SKIP_EXISTING' | 'UPDATE_EXISTING';
  userId?: string;
}

export async function autoAssignContactToPipeline(options: AutoAssignOptions) {
  const { contactId, aiAnalysis, pipelineId, updateMode, userId } = options;

  // Get contact with current assignment and score
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { 
      pipelineId: true, 
      stageId: true,
      leadScore: true,
      stage: {
        select: {
          order: true,
          leadScoreMin: true,
          name: true
        }
      }
    }
  });

  if (!contact) return;

  // Check if should skip
  if (updateMode === 'SKIP_EXISTING' && contact.pipelineId) {
    console.log(`[Auto-Assign] Skipping contact ${contactId} - already assigned`);
    return;
  }

  // Get pipeline stages
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: { stages: { orderBy: { order: 'asc' } } }
  });

  if (!pipeline) {
    console.error(`[Auto-Assign] Pipeline ${pipelineId} not found`);
    return;
  }

  // INTELLIGENT STAGE MATCHING
  // Priority 1: Use AI-powered stage analyzer with score ranges and status routing
  const targetStageId = await findBestMatchingStage(
    pipelineId,
    aiAnalysis.leadScore,
    aiAnalysis.leadStatus
  );

  let proposedStage = pipeline.stages.find(s => s.id === targetStageId);

  // Priority 2: Try exact name match from AI recommendation
  if (!proposedStage) {
    proposedStage = pipeline.stages.find(
    s => s.name.toLowerCase() === aiAnalysis.recommendedStage.toLowerCase()
  );

    if (proposedStage) {
      console.log(`[Auto-Assign] Using AI-recommended stage by name: ${proposedStage.name}`);
    }
  }

  // Fallback: Use first stage if nothing matched
  if (!proposedStage) {
    console.warn(`[Auto-Assign] No matching stage found, using first stage`);
    proposedStage = pipeline.stages[0];
  }

  // DOWNGRADE PROTECTION: Prevent high-score contacts from being moved to low stages
  if (proposedStage && contact.stage) {
    const shouldBlock = shouldPreventDowngrade(
      contact.stage.order,
      proposedStage.order,
      contact.leadScore,
      aiAnalysis.leadScore,
      proposedStage.leadScoreMin
    );

    if (shouldBlock) {
      console.log(`[Auto-Assign] Keeping contact in current stage (${contact.stage.name}) - preventing downgrade from score ${aiAnalysis.leadScore}`);
      return; // Don't reassign - keep in current stage
    }
  }

  const targetStage = proposedStage;

  // Update contact
  await prisma.contact.update({
    where: { id: contactId },
    data: {
      pipelineId,
      stageId: targetStage.id,
      stageEnteredAt: new Date(),
      leadScore: aiAnalysis.leadScore,
      leadStatus: aiAnalysis.leadStatus as LeadStatus,
    }
  });

  // Log activity
  await prisma.contactActivity.create({
    data: {
      contactId,
      type: 'STAGE_CHANGED',
      title: 'AI auto-assigned to pipeline',
      description: aiAnalysis.reasoning,
      toStageId: targetStage.id,
      fromStageId: contact.stageId || undefined,
      userId,
      metadata: {
        confidence: aiAnalysis.confidence,
        aiRecommendation: aiAnalysis.recommendedStage,
        leadScore: aiAnalysis.leadScore,
        leadStatus: aiAnalysis.leadStatus
      }
    }
  });

  console.log(`[Auto-Assign] Contact ${contactId} → ${pipeline.name} → ${targetStage.name} (score: ${aiAnalysis.leadScore}, confidence: ${aiAnalysis.confidence}%)`);
}

