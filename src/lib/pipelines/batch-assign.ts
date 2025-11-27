import { prisma } from '@/lib/db';
import { AIContactAnalysis } from '@/lib/ai/google-ai-service';
import { LeadStatus, Prisma } from '@prisma/client';
import { findBestMatchingStage, shouldPreventDowngrade } from './stage-analyzer';
import { pipelineCache } from './pipeline-cache';

export interface BatchAssignOptions {
  contactId: string;
  aiAnalysis: AIContactAnalysis;
  pipelineId: string;
  updateMode: 'SKIP_EXISTING' | 'UPDATE_EXISTING';
  userId?: string;
}

export interface BatchAssignResult {
  assignedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ contactId: string; error: string }>;
}

/**
 * Batch process pipeline assignments
 * Loads pipeline once using cache, processes all assignments efficiently
 */
export async function batchAssignContactsToPipeline(
  assignments: BatchAssignOptions[]
): Promise<BatchAssignResult> {
  const result: BatchAssignResult = {
    assignedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    errors: [],
  };

  if (assignments.length === 0) {
    return result;
  }

  // Group by pipeline ID to load pipelines efficiently
  const assignmentsByPipeline = new Map<string, BatchAssignOptions[]>();
  for (const assignment of assignments) {
    if (!assignmentsByPipeline.has(assignment.pipelineId)) {
      assignmentsByPipeline.set(assignment.pipelineId, []);
    }
    assignmentsByPipeline.get(assignment.pipelineId)!.push(assignment);
  }

  // Process each pipeline group
  for (const [pipelineId, pipelineAssignments] of assignmentsByPipeline) {
    // Load pipeline with stages using cache
    const pipeline = await pipelineCache.get(pipelineId);

    if (!pipeline) {
      result.failedCount += pipelineAssignments.length;
      pipelineAssignments.forEach((a) => {
        result.errors.push({
          contactId: a.contactId,
          error: `Pipeline ${pipelineId} not found`,
        });
      });
      continue;
    }

    // Load all contacts in one query
    const contactIds = pipelineAssignments.map((a) => a.contactId);
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: {
        id: true,
        pipelineId: true,
        stageId: true,
        leadScore: true,
        stage: {
          select: {
            order: true,
            leadScoreMin: true,
            name: true,
          },
        },
      },
    });

    const contactMap = new Map(contacts.map((c) => [c.id, c]));

    // Process assignments
    const updates: Array<{
      contactId: string;
      stageId: string;
      leadScore: number;
      leadStatus: LeadStatus;
      fromStageId: string | null;
    }> = [];

    const activities: Array<{
      contactId: string;
      type: 'STAGE_CHANGED';
      title: string;
      description: string;
      toStageId: string;
      fromStageId?: string;
      userId?: string;
      metadata: Record<string, unknown>;
    }> = [];

    for (const assignment of pipelineAssignments) {
      const contact = contactMap.get(assignment.contactId);

      if (!contact) {
        result.failedCount++;
        result.errors.push({
          contactId: assignment.contactId,
          error: 'Contact not found',
        });
        continue;
      }

      // Check if should skip
      if (assignment.updateMode === 'SKIP_EXISTING' && contact.pipelineId) {
        result.skippedCount++;
        continue;
      }

      // Find best matching stage
      const targetStageId = await findBestMatchingStage(
        pipelineId,
        assignment.aiAnalysis.leadScore,
        assignment.aiAnalysis.leadStatus
      );

      let proposedStage = pipeline.stages.find((s) => s.id === targetStageId);

      // Try exact name match
      if (!proposedStage) {
        proposedStage = pipeline.stages.find(
          (s) => s.name.toLowerCase() === assignment.aiAnalysis.recommendedStage.toLowerCase()
        );
      }

      // Fallback to first stage
      if (!proposedStage) {
        proposedStage = pipeline.stages[0];
      }

      if (!proposedStage) {
        result.failedCount++;
        result.errors.push({
          contactId: assignment.contactId,
          error: 'No stages available in pipeline',
        });
        continue;
      }

      // Check downgrade protection
      if (contact.stage) {
        const shouldBlock = shouldPreventDowngrade(
          contact.stage.order,
          proposedStage.order,
          contact.leadScore ?? 0,
          assignment.aiAnalysis.leadScore,
          proposedStage.leadScoreMin
        );

        if (shouldBlock) {
          result.skippedCount++;
          continue;
        }
      }

      // Prepare update
      updates.push({
        contactId: assignment.contactId,
        stageId: proposedStage.id,
        leadScore: assignment.aiAnalysis.leadScore,
        leadStatus: assignment.aiAnalysis.leadStatus as LeadStatus,
        fromStageId: contact.stageId,
      });

      // Prepare activity log
      activities.push({
        contactId: assignment.contactId,
        type: 'STAGE_CHANGED',
        title: 'AI auto-assigned to pipeline',
        description: assignment.aiAnalysis.reasoning,
        toStageId: proposedStage.id,
        fromStageId: contact.stageId || undefined,
        userId: assignment.userId,
        metadata: {
          confidence: assignment.aiAnalysis.confidence,
          aiRecommendation: assignment.aiAnalysis.recommendedStage,
          leadScore: assignment.aiAnalysis.leadScore,
          leadStatus: assignment.aiAnalysis.leadStatus,
        },
      });
    }

    // Batch update contacts
    if (updates.length > 0) {
      await Promise.all(
        updates.map((update) =>
          prisma.contact.update({
            where: { id: update.contactId },
            data: {
              pipelineId,
              stageId: update.stageId,
              stageEnteredAt: new Date(),
              leadScore: update.leadScore,
              leadStatus: update.leadStatus,
            },
          })
        )
      );

      result.assignedCount += updates.length;
    }

    // Batch create activity logs
    if (activities.length > 0) {
      await prisma.contactActivity.createMany({
        data: activities.map((activity) => ({
          contactId: activity.contactId,
          type: activity.type,
          title: activity.title,
          description: activity.description,
          toStageId: activity.toStageId,
          fromStageId: activity.fromStageId,
          userId: activity.userId,
          metadata: activity.metadata as Prisma.InputJsonValue,
        })),
      });
    }
  }

  return result;
}

