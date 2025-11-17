import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { FacebookClient, FacebookApiError } from './client';
import { analyzeWithFallback } from '@/lib/ai/enhanced-analysis';
import { autoAssignContactToPipeline } from '@/lib/pipelines/auto-assign';
import { applyStageScoreRanges } from '@/lib/pipelines/stage-analyzer';

interface PipelineAnalysisResult {
  success: boolean;
  jobId: string;
  message: string;
}

/**
 * Concurrency limiter utility for parallel operations
 */
class ConcurrencyLimiter {
  private queue: Array<{ 
    fn: () => Promise<unknown>; 
    resolve: (value: unknown) => void; 
    reject: (error: unknown) => void 
  }> = [];
  private running = 0;

  constructor(private limit: number) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ 
        fn: fn as () => Promise<unknown>, 
        resolve: resolve as (value: unknown) => void, 
        reject: reject as (error: unknown) => void 
      });
      this.process();
    });
  }

  private async process() {
    while (this.running < this.limit && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      this.running++;
      
      task.fn()
        .then((result) => {
          task.resolve(result);
        })
        .catch((error) => {
          task.reject(error);
        })
        .finally(() => {
          this.running--;
          this.process();
        });
    }
  }
}

/**
 * Starts a pipeline analysis job that analyzes contacts without pipelines
 */
export async function startPipelineAnalysis(facebookPageId: string): Promise<PipelineAnalysisResult> {
  try {
    // Check if there's already an active analysis job for this page
    const existingJob = await prisma.syncJob.findFirst({
      where: {
        facebookPageId,
        status: {
          in: ['PENDING', 'IN_PROGRESS'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingJob) {
      return {
        success: true,
        jobId: existingJob.id,
        message: 'Pipeline analysis already in progress',
      };
    }

    // Create a new sync job for analysis
    const syncJob = await prisma.syncJob.create({
      data: {
        facebookPageId,
        status: 'PENDING',
      },
    });

    // Start the analysis process asynchronously (don't await)
    executePipelineAnalysis(syncJob.id, facebookPageId).catch((error) => {
      console.error(`Pipeline analysis failed for job ${syncJob.id}:`, error);
    });

    return {
      success: true,
      jobId: syncJob.id,
      message: 'Pipeline analysis started',
    };
  } catch (error) {
    console.error('Failed to start pipeline analysis:', error);
    throw error;
  }
}

/**
 * Check if job has been cancelled
 */
async function isJobCancelled(jobId: string): Promise<boolean> {
  const job = await prisma.syncJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });
  return job?.status === 'CANCELLED';
}

/**
 * Executes the pipeline analysis - fetches conversations on-demand and analyzes contacts
 */
async function executePipelineAnalysis(jobId: string, facebookPageId: string): Promise<void> {
  try {
    // Update job status to in progress
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    const page = await prisma.facebookPage.findUnique({
      where: { id: facebookPageId },
      include: {
        autoPipeline: {
          include: {
            stages: { orderBy: { order: 'asc' } }
          }
        }
      }
    });

    if (!page) {
      throw new Error('Facebook page not found');
    }

    if (!page.autoPipelineId || !page.autoPipeline) {
      throw new Error('Auto-pipeline not configured for this page');
    }

    const client = new FacebookClient(page.pageAccessToken);
    let analyzedCount = 0;
    let failedCount = 0;
    let tokenExpired = false;
    const errors: Array<{ platform: string; id: string; error: string; code?: number }> = [];

    console.log(`[Pipeline Analysis ${jobId}] Starting analysis for Facebook Page: ${page.pageId}`);
    console.log(`[Pipeline Analysis ${jobId}] Target Pipeline: ${page.autoPipeline.name}`);
    console.log(`[Pipeline Analysis ${jobId}] Mode: ${page.autoPipelineMode}`);

    // Auto-generate score ranges if stages still have defaults
    const hasDefaultRanges = page.autoPipeline.stages.some(
      s => s.leadScoreMin === 0 && s.leadScoreMax === 100
    );

    if (hasDefaultRanges) {
      console.log(`[Pipeline Analysis ${jobId}] Detected default score ranges, auto-generating intelligent ranges...`);
      await applyStageScoreRanges(page.autoPipelineId);
      console.log(`[Pipeline Analysis ${jobId}] Score ranges applied successfully`);
      
      // Reload page with updated ranges
      const updatedPage = await prisma.facebookPage.findUnique({
        where: { id: page.id },
        include: {
          autoPipeline: {
            include: {
              stages: { orderBy: { order: 'asc' } }
            }
          }
        }
      });
      
      if (updatedPage?.autoPipeline) {
        page.autoPipeline = updatedPage.autoPipeline;
      }
    }

    // Query contacts without pipelineId for this page
    const contactsWithoutPipeline = await prisma.contact.findMany({
      where: {
        facebookPageId: page.id,
        pipelineId: null,
        OR: [
          { messengerPSID: { not: null } },
          { instagramSID: { not: null } },
        ],
      },
      select: {
        id: true,
        messengerPSID: true,
        instagramSID: true,
        firstName: true,
        lastName: true,
        lastInteraction: true,
      },
    });

    console.log(`[Pipeline Analysis ${jobId}] Found ${contactsWithoutPipeline.length} contacts without pipeline`);

    if (contactsWithoutPipeline.length === 0) {
      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          syncedContacts: 0,
          failedContacts: 0,
          totalContacts: 0,
          completedAt: new Date(),
        },
      });
      console.log(`[Pipeline Analysis ${jobId}] No contacts to analyze`);
      return;
    }

    // Update total contacts
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        totalContacts: contactsWithoutPipeline.length,
      },
    });

    // Fetch all conversations once (to match contacts to conversations)
    console.log(`[Pipeline Analysis ${jobId}] Fetching conversations to match contacts...`);
    const messengerConvos = await client.getMessengerConversations(page.pageId);
    console.log(`[Pipeline Analysis ${jobId}] Fetched ${messengerConvos.length} Messenger conversations`);

    // Create a map of participantId -> conversationId for Messenger
    // Store both conversation ID and updated_time for comparison
    const messengerConversationMap = new Map<string, { conversationId: string; updatedTime: string }>();
    for (const convo of messengerConvos) {
      for (const participant of convo.participants.data) {
        if (participant.id !== page.pageId) {
          // Use the most recent conversation for each participant
          const existing = messengerConversationMap.get(participant.id);
          if (!existing || new Date(convo.updated_time) > new Date(existing.updatedTime)) {
            messengerConversationMap.set(participant.id, {
              conversationId: convo.id,
              updatedTime: convo.updated_time,
            });
          }
        }
      }
    }

    // Fetch Instagram conversations if connected
    const instagramConversationMap = new Map<string, { conversationId: string; updatedTime: string }>();
    if (page.instagramAccountId) {
      try {
        console.log(`[Pipeline Analysis ${jobId}] Fetching Instagram conversations...`);
        const igConvos = await client.getInstagramConversations(page.instagramAccountId);
        console.log(`[Pipeline Analysis ${jobId}] Fetched ${igConvos.length} Instagram conversations`);

        for (const convo of igConvos) {
          for (const participant of convo.participants.data) {
            if (participant.id !== page.instagramAccountId) {
              const existing = instagramConversationMap.get(participant.id);
              if (!existing || new Date(convo.updated_time) > new Date(existing.updatedTime)) {
                instagramConversationMap.set(participant.id, {
                  conversationId: convo.id,
                  updatedTime: convo.updated_time,
                });
              }
            }
          }
        }
      } catch (error) {
        console.error(`[Pipeline Analysis ${jobId}] Failed to fetch Instagram conversations:`, error);
      }
    }

    // Process contacts in batches
    const BATCH_SIZE = 10; // Smaller batches for analysis (more expensive operations)
    const batches = [];
    for (let i = 0; i < contactsWithoutPipeline.length; i += BATCH_SIZE) {
      batches.push(contactsWithoutPipeline.slice(i, i + BATCH_SIZE));
    }

    const conversationFetchLimiter = new ConcurrencyLimiter(3); // Limit API calls
    const analysisLimiter = new ConcurrencyLimiter(3); // Limit AI analysis

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      if (await isJobCancelled(jobId)) {
        console.log(`[Pipeline Analysis ${jobId}] Analysis cancelled by user`);
        return;
      }

      console.log(`[Pipeline Analysis ${jobId}] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} contacts)...`);

      // Step 1: Fetch conversations and messages for this batch
      const conversationResults = await Promise.all(
        batch.map(contact =>
          conversationFetchLimiter.execute(async () => {
            try {
              // Find conversation ID for this contact (try Messenger first, then Instagram)
              let conversationInfo = contact.messengerPSID 
                ? messengerConversationMap.get(contact.messengerPSID)
                : null;

              if (!conversationInfo && contact.instagramSID) {
                conversationInfo = instagramConversationMap.get(contact.instagramSID);
              }

              if (!conversationInfo) {
                return { contact, messages: null, error: { message: 'Conversation not found', code: undefined } };
              }

              const conversationId = conversationInfo.conversationId;

              // Fetch messages from API
              const messages = await client.getAllMessagesForConversation(conversationId);
              return { contact, messages, error: null };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              const errorCode = error instanceof FacebookApiError ? error.code : undefined;
              return { contact, messages: null, error: { message: errorMessage, code: errorCode } };
            }
          })
        )
      );

      // Step 2: Analyze this batch
      const analysisResults = await Promise.all(
        conversationResults.map(({ contact, messages, error }) =>
          analysisLimiter.execute(async () => {
            if (error) {
              return { contact, analysis: null, error };
            }

            if (!messages || messages.length === 0) {
              return {
                contact,
                analysis: null,
                error: { message: 'No messages found', code: undefined },
              };
            }

            try {
              // Prepare messages for analysis
              const messagesToAnalyze = messages
                .filter((msg: { message?: string }) => msg.message)
                .map((msg: { 
                  from?: { name?: string; username?: string; id?: string }; 
                  message?: string; 
                  created_time?: string 
                }) => ({
                  from: msg.from?.name || msg.from?.username || msg.from?.id || 'Unknown',
                  text: msg.message || '',
                  timestamp: msg.created_time ? new Date(msg.created_time) : undefined,
                }))
                .reverse(); // Oldest first

              if (messagesToAnalyze.length === 0) {
                return {
                  contact,
                  analysis: null,
                  error: { message: 'No valid messages to analyze', code: undefined },
                };
              }

              // Analyze with AI
              const { analysis } = await analyzeWithFallback(
                messagesToAnalyze,
                page.autoPipeline.stages,
                contact.lastInteraction || undefined
              );

              return { contact, analysis, error: null };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              return { contact, analysis: null, error: { message: errorMessage, code: undefined } };
            }
          })
        )
      );

      // Step 3: Assign to pipeline and update contacts
      await Promise.all(
        analysisResults.map(async ({ contact, analysis, error }) => {
          if (error) {
            failedCount++;
            errors.push({
              platform: 'Messenger',
              id: contact.id,
              error: error.message,
              code: error.code,
            });
            if (error.code && error.code === 190) {
              tokenExpired = true;
            }
            return;
          }

          if (!analysis) {
            failedCount++;
            errors.push({
              platform: 'Messenger',
              id: contact.id,
              error: 'No analysis result',
              code: undefined,
            });
            return;
          }

          try {
            // Update contact with AI context
            await prisma.contact.update({
              where: { id: contact.id },
              data: {
                aiContext: analysis.summary,
                aiContextUpdatedAt: new Date(),
              },
            });

            // Assign to pipeline
            await autoAssignContactToPipeline({
              contactId: contact.id,
              aiAnalysis: analysis,
              pipelineId: page.autoPipelineId!,
              updateMode: page.autoPipelineMode,
            });

            analyzedCount++;
          } catch (error) {
            failedCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorCode = error instanceof FacebookApiError ? error.code : undefined;
            errors.push({
              platform: 'Messenger',
              id: contact.id,
              error: errorMessage,
              code: errorCode,
            });
            if (error instanceof FacebookApiError && error.isTokenExpired) {
              tokenExpired = true;
            }
          }
        })
      );

      // Update progress after each batch
      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          syncedContacts: analyzedCount,
          failedContacts: failedCount,
        },
      });

      console.log(`[Pipeline Analysis ${jobId}] Batch ${batchIndex + 1}/${batches.length} complete: ${analyzedCount} analyzed, ${failedCount} failed`);
    }

    // Update job with final results
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: tokenExpired ? 'FAILED' : 'COMPLETED',
        syncedContacts: analyzedCount,
        failedContacts: failedCount,
        totalContacts: analyzedCount + failedCount,
        errors: errors.length > 0 ? errors : Prisma.JsonNull,
        tokenExpired,
        completedAt: new Date(),
      },
    });

    console.log(`[Pipeline Analysis ${jobId}] Completed: ${analyzedCount} analyzed, ${failedCount} failed${tokenExpired ? ' (Token expired)' : ''}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Pipeline Analysis ${jobId}] Fatal error:`, error);

    // Mark job as failed
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errors: [{ error: errorMessage }],
        completedAt: new Date(),
      },
    });
  }
}

/**
 * Gets the status of a pipeline analysis job
 */
export async function getPipelineAnalysisJobStatus(jobId: string) {
  const job = await prisma.syncJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error('Analysis job not found');
  }

  return job;
}

/**
 * Gets the latest pipeline analysis job for a Facebook page
 */
export async function getLatestPipelineAnalysisJob(facebookPageId: string) {
  return prisma.syncJob.findFirst({
    where: {
      facebookPageId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

