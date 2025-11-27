import { prisma } from '@/lib/db';
import { AIContactAnalysis } from '@/lib/ai/google-ai-service';
import { LeadStatus } from '@prisma/client';
import { findBestMatchingStage, shouldPreventDowngrade } from './stage-analyzer';
import { pipelineCache } from './pipeline-cache';
import { batchUpdateContacts, BatchContactUpdate } from './batch-update-contacts';
import { batchCreateActivities, BatchActivityData } from './batch-create-activities';

export interface BatchAutoAssignOptions {
  contactId: string;
  aiAnalysis: AIContactAnalysis;
  pipelineId: string;
  updateMode: 'SKIP_EXISTING' | 'UPDATE_EXISTING';
  userId?: string;
}

export interface BatchAutoAssignResult {
  assignedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ contactId: string; error: string }>;
}

/**
 * Batch auto-assign multiple contacts to pipeline
 * Reduces database queries from 4N to ~4 queries total
 * 
 * Before: 4 queries × N contacts (contact.findUnique, pipeline.findUnique, contact.update, activity.create)
 * After: 4 queries total (contact.findMany, pipeline.findUnique/cache, contact.updateMany, activity.createMany)
 */
export async function batchAutoAssign(
  assignments: BatchAutoAssignOptions[]
): Promise<BatchAutoAssignResult> {
  const result: BatchAutoAssignResult = {
    assignedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    errors: [],
  };

  if (assignments.length === 0) {
    return result;
  }

  // Group by pipeline ID to process efficiently
  const assignmentsByPipeline = new Map<string, BatchAutoAssignOptions[]>();
  for (const assignment of assignments) {
    if (!assignmentsByPipeline.has(assignment.pipelineId)) {
      assignmentsByPipeline.set(assignment.pipelineId, []);
    }
    assignmentsByPipeline.get(assignment.pipelineId)!.push(assignment);
  }

  // Process each pipeline group
  for (const [pipelineId, pipelineAssignments] of assignmentsByPipeline) {
    try {
      // 1. Load pipeline ONCE (or use cache) - saves N-1 queries
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

      // 2. Load all contacts in ONE query - saves N-1 queries
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

      // 3. Process all assignments and collect updates/activities
      const contactUpdates: BatchContactUpdate[] = [];
      const activities: BatchActivityData[] = [];

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

        // Try exact name match from AI recommendation
        if (!proposedStage) {
          proposedStage = pipeline.stages.find(
            (s) => s.name.toLowerCase() === assignment.aiAnalysis.recommendedStage.toLowerCase()
          );
          if (proposedStage) {
            console.log(`[Batch Auto-Assign] Using AI-recommended stage by name: ${proposedStage.name}`);
          }
        }

        // Fallback to first stage
        if (!proposedStage) {
          console.warn(`[Batch Auto-Assign] No matching stage found for contact ${assignment.contactId}, using first stage`);
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
            console.log(
              `[Batch Auto-Assign] Keeping contact ${assignment.contactId} in current stage (${contact.stage.name}) - preventing downgrade from score ${assignment.aiAnalysis.leadScore}`
            );
            result.skippedCount++;
            continue;
          }
        }

        // Collect update
        contactUpdates.push({
          contactId: assignment.contactId,
          pipelineId,
          stageId: proposedStage.id,
          stageEnteredAt: new Date(),
          leadScore: assignment.aiAnalysis.leadScore,
          leadStatus: assignment.aiAnalysis.leadStatus as LeadStatus,
        });

        // Collect activity
        activities.push({
          contactId: assignment.contactId,
          type: 'STAGE_CHANGED',
          title: 'AI auto-assigned to pipeline',
          description: assignment.aiAnalysis.reasoning || undefined,
          toStageId: proposedStage.id,
          fromStageId: contact.stageId ?? null,
          userId: assignment.userId ?? null,
          metadata: {
            confidence: assignment.aiAnalysis.confidence,
            aiRecommendation: assignment.aiAnalysis.recommendedStage,
            leadScore: assignment.aiAnalysis.leadScore,
            leadStatus: assignment.aiAnalysis.leadStatus,
          },
        });
      }

      // 4. Batch update contacts - ONE query instead of N
      if (contactUpdates.length > 0) {
        const updateResult = await batchUpdateContacts(contactUpdates);
        result.assignedCount += updateResult.updated;
        result.failedCount += updateResult.failed;
        result.errors.push(...updateResult.errors);
      }

      // 5. Batch create activities - ONE query instead of N
      if (activities.length > 0) {
        const activityResult = await batchCreateActivities(activities);
        // Activities are non-critical, log failures but don't count as assignment failures
        if (activityResult.failed > 0) {
          console.warn(`[Batch Auto-Assign] Failed to create ${activityResult.failed} activities`);
        }
      }

      console.log(
        `[Batch Auto-Assign] Pipeline ${pipeline.name}: ${result.assignedCount} assigned, ${result.skippedCount} skipped, ${result.failedCount} failed`
      );
    } catch (error) {
      // If pipeline processing fails, mark all assignments as failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Batch Auto-Assign] Error processing pipeline ${pipelineId}:`, errorMessage);
      
      pipelineAssignments.forEach((a) => {
        result.failedCount++;
        result.errors.push({
          contactId: a.contactId,
          error: `Pipeline processing failed: ${errorMessage}`,
        });
      });
    }
  }

  console.log(
    `[Batch Auto-Assign] Complete: ${result.assignedCount} assigned, ${result.skippedCount} skipped, ${result.failedCount} failed`
  );
  return result;
}

