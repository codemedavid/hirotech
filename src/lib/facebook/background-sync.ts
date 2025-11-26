import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { FacebookClient, FacebookApiError } from './client';
import { analyzeWithFallback } from '@/lib/ai/enhanced-analysis';
import { autoAssignContactToPipeline } from '@/lib/pipelines/auto-assign';
import { applyStageScoreRanges } from '@/lib/pipelines/stage-analyzer';

interface BackgroundSyncResult {
  success: boolean;
  jobId: string;
  message: string;
}

/**
 * Concurrency limiter utility
 * Limits the number of concurrent operations
 * Properly processes queue to avoid pauses
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
    // Don't start new tasks if we're at the limit or queue is empty
    while (this.running < this.limit && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      this.running++;
      
      // Execute task asynchronously (don't await here, let it run in background)
      task.fn()
        .then((result) => {
          task.resolve(result);
        })
        .catch((error) => {
          task.reject(error);
        })
        .finally(() => {
          this.running--;
          // Process next task in queue
          this.process();
        });
    }
  }
}

/**
 * Starts a background sync job that tracks progress in the database
 * This allows syncing to continue even if the user navigates away
 */
export async function startBackgroundSync(facebookPageId: string): Promise<BackgroundSyncResult> {
  try {
    // Check if there's already an active sync job for this page
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
        message: 'Sync already in progress',
      };
    }

    // Create a new sync job
    const syncJob = await prisma.syncJob.create({
      data: {
        facebookPageId,
        status: 'PENDING',
      },
    });

    // Start the sync process asynchronously (don't await)
    executeBackgroundSync(syncJob.id, facebookPageId).catch((error) => {
      console.error(`Background sync failed for job ${syncJob.id}:`, error);
    });

    return {
      success: true,
      jobId: syncJob.id,
      message: 'Sync started',
    };
  } catch (error) {
    console.error('Failed to start background sync:', error);
    throw error;
  }
}

/**
 * Gets the latest sync job for a Facebook page
 * @param facebookPageId - The ID of the Facebook page
 * @returns The latest sync job for the page, or null if none exists
 */
export async function getLatestSyncJob(facebookPageId: string) {
  return await prisma.syncJob.findFirst({
    where: {
      facebookPageId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Check if sync job has been cancelled
 */
async function isJobCancelled(jobId: string): Promise<boolean> {
  const job = await prisma.syncJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });
  return job?.status === 'CANCELLED';
}

/**
 * Batch fetch existing contacts for early skip checks
 * Returns a map of participantId -> contact with pipelineId
 */
async function getExistingContactsMap(
  facebookPageId: string,
  participantIds: string[],
  platform: 'messenger' | 'instagram'
): Promise<Map<string, { id: string; pipelineId: string | null }>> {
  if (participantIds.length === 0) {
    return new Map();
  }

  const whereClause = platform === 'messenger'
    ? {
        messengerPSID: { in: participantIds },
        facebookPageId,
      }
    : {
        OR: [
          { instagramSID: { in: participantIds }, facebookPageId },
          { messengerPSID: { in: participantIds }, facebookPageId },
        ],
      };

  const contacts = await prisma.contact.findMany({
    where: whereClause,
    select: {
      id: true,
      messengerPSID: true,
      instagramSID: true,
      pipelineId: true,
    },
  });

  const map = new Map<string, { id: string; pipelineId: string | null }>();
  
  for (const contact of contacts) {
    const participantId = platform === 'messenger' 
      ? contact.messengerPSID 
      : contact.instagramSID || contact.messengerPSID;
    
    if (participantId) {
      map.set(participantId, {
        id: contact.id,
        pipelineId: contact.pipelineId,
      });
    }
  }

  return map;
}

/**
 * Process a batch of participant tasks (fetch messages, analyze, save)
 */
async function processParticipantBatch(
  batch: Array<{ participantId: string; conversationId: string; updatedTime: string }>,
  page: any,
  client: FacebookClient,
  jobId: string,
  messageFetchLimiter: ConcurrencyLimiter,
  analysisLimiter: ConcurrencyLimiter,
  existingContactsMap: Map<string, { id: string; pipelineId: string | null }>,
  platform: 'messenger' | 'instagram'
): Promise<{ syncedCount: number; failedCount: number; errors: Array<{ platform: string; id: string; error: string; code?: number }>; tokenExpired: boolean }> {
  let batchSyncedCount = 0;
  let batchFailedCount = 0;
  const batchErrors: Array<{ platform: string; id: string; error: string; code?: number }> = [];
  let batchTokenExpired = false;

        // Step 1: Fetch messages for this batch
        const messageResults = await Promise.all(
          batch.map(task =>
            messageFetchLimiter.execute(async () => {
              try {
                const messages = await client.getAllMessagesForConversation(task.conversationId);
                return { task, messages, error: null };
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const errorCode = error instanceof FacebookApiError ? error.code : undefined;
                return { task, messages: null, error: { message: errorMessage, code: errorCode } };
              }
            })
          )
        );

        // Step 2: Analyze this batch
        const analysisResults = await Promise.all(
          messageResults.map(({ task, messages, error }) =>
            analysisLimiter.execute(async () => {
              if (error) {
                return { task, processed: null, error };
              }

              if (!messages || messages.length === 0) {
          const defaultName = platform === 'messenger' 
            ? `User ${task.participantId.slice(-6)}`
            : `IG User ${task.participantId.slice(-6)}`;
          
                return {
                  task,
                  processed: {
                    participantId: task.participantId,
              firstName: defaultName,
                    lastName: null,
                    aiContext: null,
                    aiAnalysis: null,
                    lastInteraction: new Date(task.updatedTime),
                  },
                  error: null,
                };
              }

              try {
                // Extract name
          let firstName = platform === 'messenger' 
            ? `User ${task.participantId.slice(-6)}`
            : `IG User ${task.participantId.slice(-6)}`;
            let lastName: string | null = null;

                const userMessage = messages.find(
                  (msg: { from?: { id?: string } }) => msg.from?.id === task.participantId
              );

              if (userMessage?.from?.name) {
                const nameParts = userMessage.from.name.trim().split(' ');
                firstName = nameParts[0] || firstName;
                if (nameParts.length > 1) {
                  lastName = nameParts.slice(1).join(' ');
              }
          } else if (userMessage?.from?.username) {
            firstName = userMessage.from.username;
            }

                // Analyze with AI
            let aiContext: string | null = null;
            let aiAnalysis = null;
            
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

                if (messagesToAnalyze.length > 0) {
                  const { analysis, usedFallback } = await analyzeWithFallback(
                      messagesToAnalyze,
                    page.autoPipelineId && page.autoPipeline ? page.autoPipeline.stages : undefined,
                    new Date(task.updatedTime)
                    );
                  
                  aiAnalysis = analysis;
                  aiContext = analysis.summary;
                  
                  if (usedFallback) {
              console.warn(`[Background Sync ${jobId}] ${platform === 'instagram' ? 'IG: ' : ''}Used fallback scoring for ${task.participantId} - Score: ${analysis.leadScore}`);
                  }
                }

                return {
                  task,
                  processed: {
                    participantId: task.participantId,
                    firstName,
                    lastName,
                    aiContext,
                    aiAnalysis,
                    lastInteraction: new Date(task.updatedTime),
                  },
                  error: null,
                };
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                return { task, processed: null, error: { message: errorMessage, code: undefined } };
              }
            })
          )
        );

        // Step 3: Save this batch to database
        await Promise.all(
          analysisResults.map(({ task, processed, error }) => {
            if (error) {
        batchFailedCount++;
        batchErrors.push({
          platform: platform === 'messenger' ? 'Messenger' : 'Instagram',
                id: task.participantId,
                error: error.message,
                code: error.code,
              });
              if (error.code && error.code === 190) {
          batchTokenExpired = true;
              }
              return null;
            }

            if (!processed) {
              return null;
            }

      // Check if should skip (SKIP_EXISTING mode)
      if (page.autoPipelineMode === 'SKIP_EXISTING' && page.autoPipelineId) {
        const existing = existingContactsMap.get(task.participantId);
        if (existing && existing.pipelineId) {
          // Skip this contact - already has pipeline assignment
          return null;
        }
      }

      if (platform === 'messenger') {
            return prisma.contact
              .upsert({
              where: {
                messengerPSID_facebookPageId: {
                    messengerPSID: task.participantId,
                  facebookPageId: page.id,
                },
              },
              create: {
                  messengerPSID: task.participantId,
                  firstName: processed.firstName,
                  lastName: processed.lastName,
                hasMessenger: true,
                organizationId: page.organizationId,
                facebookPageId: page.id,
                  lastInteraction: processed.lastInteraction,
                  aiContext: processed.aiContext,
                  aiContextUpdatedAt: processed.aiContext ? new Date() : null,
              },
              update: {
                  firstName: processed.firstName,
                  lastName: processed.lastName,
                  lastInteraction: processed.lastInteraction,
                hasMessenger: true,
                  aiContext: processed.aiContext,
                  aiContextUpdatedAt: processed.aiContext ? new Date() : null,
              },
              })
              .then(async (savedContact) => {
            // Auto-assign to pipeline if enabled
                if (processed.aiAnalysis && page.autoPipelineId) {
              await autoAssignContactToPipeline({
                contactId: savedContact.id,
                    aiAnalysis: processed.aiAnalysis,
                pipelineId: page.autoPipelineId,
                updateMode: page.autoPipelineMode,
              });
            }
            batchSyncedCount++;
                return savedContact;
              })
              .catch((err) => {
            batchFailedCount++;
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                const errorCode = err instanceof FacebookApiError ? err.code : undefined;
            batchErrors.push({
                  platform: 'Messenger',
                  id: task.participantId,
                  error: errorMessage,
                  code: errorCode,
                });
                if (err instanceof FacebookApiError && err.isTokenExpired) {
              batchTokenExpired = true;
                }
                return null;
              });
      } else {
        // Instagram
        return prisma.contact
          .findFirst({
            where: {
              OR: [
                { instagramSID: task.participantId, facebookPageId: page.id },
                { messengerPSID: task.participantId, facebookPageId: page.id },
              ],
            },
          })
          .then(async (existingContact) => {
            let savedContact;
            if (existingContact) {
              savedContact = await prisma.contact.update({
                where: { id: existingContact.id },
                data: {
                  instagramSID: task.participantId,
                  firstName: processed.firstName,
                  lastName: processed.lastName,
                  hasInstagram: true,
                  lastInteraction: processed.lastInteraction,
                  aiContext: processed.aiContext,
                  aiContextUpdatedAt: processed.aiContext ? new Date() : null,
                },
              });
            } else {
              savedContact = await prisma.contact.create({
                data: {
                  instagramSID: task.participantId,
                  firstName: processed.firstName,
                  lastName: processed.lastName,
                  hasInstagram: true,
                  organizationId: page.organizationId,
                  facebookPageId: page.id,
                  lastInteraction: processed.lastInteraction,
                  aiContext: processed.aiContext,
                  aiContextUpdatedAt: processed.aiContext ? new Date() : null,
                },
              });
            }

            // Auto-assign to pipeline if enabled
            if (processed.aiAnalysis && page.autoPipelineId) {
              await autoAssignContactToPipeline({
                contactId: savedContact.id,
                aiAnalysis: processed.aiAnalysis,
                pipelineId: page.autoPipelineId,
                updateMode: page.autoPipelineMode,
              });
            }

            batchSyncedCount++;
            return savedContact;
          })
          .catch((err) => {
            batchFailedCount++;
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            const errorCode = err instanceof FacebookApiError ? err.code : undefined;
            batchErrors.push({
              platform: 'Instagram',
              id: task.participantId,
              error: errorMessage,
              code: errorCode,
            });
            if (err instanceof FacebookApiError && err.isTokenExpired) {
              batchTokenExpired = true;
            }
            return null;
          });
      }
    })
  );

  return {
    syncedCount: batchSyncedCount,
    failedCount: batchFailedCount,
    errors: batchErrors,
    tokenExpired: batchTokenExpired,
  };
}

/**
 * Executes the actual sync operation and updates the job status
 */
async function executeBackgroundSync(jobId: string, facebookPageId: string): Promise<void> {
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

    const client = new FacebookClient(page.pageAccessToken);
    let syncedCount = 0;
    let failedCount = 0;
    
    console.log(`[Background Sync ${jobId}] Auto-Pipeline Enabled:`, !!page.autoPipelineId);
    if (page.autoPipelineId && page.autoPipeline) {
      console.log(`[Background Sync ${jobId}] Target Pipeline:`, page.autoPipeline.name);
      console.log(`[Background Sync ${jobId}] Mode:`, page.autoPipelineMode);
      
      // Auto-generate score ranges if stages still have defaults
      const hasDefaultRanges = page.autoPipeline.stages.some(
        s => s.leadScoreMin === 0 && s.leadScoreMax === 100
      );

      if (hasDefaultRanges) {
        console.log(`[Background Sync ${jobId}] Detected default score ranges, auto-generating intelligent ranges...`);
        await applyStageScoreRanges(page.autoPipelineId);
        console.log(`[Background Sync ${jobId}] Score ranges applied successfully`);
        
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
    }
    let tokenExpired = false;
    const errors: Array<{ platform: string; id: string; error: string; code?: number }> = [];

    console.log(`[Background Sync ${jobId}] Starting contact sync for Facebook Page: ${page.pageId}`);

    // Set initial status - this helps UI show progress immediately
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        totalContacts: 0, // Will be updated once we know the count
      },
    });

    // Sync Messenger contacts
    try {
      console.log(`[Background Sync ${jobId}] Starting to stream Messenger conversations...`);

      interface ParticipantTask {
          participantId: string;
          conversationId: string;
          updatedTime: string;
        }

      const participantTasks: ParticipantTask[] = [];
      let conversationCount = 0;
      let processedCount = 0;
      const existingContactsMap = new Map<string, { id: string; pipelineId: string | null }>();

      // Initialize concurrency limiters
      const messageFetchLimiter = new ConcurrencyLimiter(50);
      const analysisLimiter = new ConcurrencyLimiter(50);

      // Stream conversations and process incrementally
      for await (const convo of client.fetchMessengerConversationsStream(page.pageId)) {
        conversationCount++;

        // Check if cancelled
        if (await isJobCancelled(jobId)) {
          console.log(`[Background Sync ${jobId}] Sync cancelled by user`);
          return;
        }

        // Collect participants immediately
          for (const participant of convo.participants.data) {
          if (participant.id === page.pageId) continue; // Skip page itself
          participantTasks.push({
              participantId: participant.id,
              conversationId: convo.id,
              updatedTime: convo.updated_time,
            });
          }

        // Update progress during fetching (every 10 conversations)
        if (conversationCount % 10 === 0) {
          await prisma.syncJob.update({
            where: { id: jobId },
            data: {
              totalContacts: participantTasks.length,
            },
          });
        }

        // Check existing contacts periodically (every 100 new participants)
        if (participantTasks.length % 100 === 0 && participantTasks.length > 0) {
          const newParticipantIds = participantTasks
            .slice(-100)
            .map(t => t.participantId);
          const newExistingMap = await getExistingContactsMap(
          page.id,
            newParticipantIds,
            'messenger'
          );
          // Merge with existing map
          newExistingMap.forEach((value, key) => existingContactsMap.set(key, value));
        }

        // Start processing first batch when we have 50 participants
        if (participantTasks.length >= 50 && processedCount === 0) {
          console.log(`[Background Sync ${jobId}] Starting analysis with first batch of 50 participants...`);
          const firstBatch = participantTasks.splice(0, 50);
          
          // Filter first batch for SKIP_EXISTING mode
          const firstBatchToProcess = firstBatch.filter(task => {
          if (page.autoPipelineMode === 'SKIP_EXISTING' && page.autoPipelineId) {
              const existing = existingContactsMap.get(task.participantId);
              if (existing && existing.pipelineId) {
                return false; // Skip
            }
          }
          return true;
        });

          const batchResult = await processParticipantBatch(
            firstBatchToProcess,
            page,
            client,
            jobId,
            messageFetchLimiter,
            analysisLimiter,
            existingContactsMap,
            'messenger'
          );

          syncedCount += batchResult.syncedCount;
          failedCount += batchResult.failedCount;
          errors.push(...batchResult.errors);
          if (batchResult.tokenExpired) {
            tokenExpired = true;
          }

          processedCount += firstBatchToProcess.length;

          // Update progress
        await prisma.syncJob.update({
          where: { id: jobId },
          data: {
              syncedContacts: syncedCount,
              failedContacts: failedCount,
          },
        });

          console.log(`[Background Sync ${jobId}] First batch complete: ${syncedCount} synced, ${failedCount} failed`);
        }
      }

      console.log(`[Background Sync ${jobId}] Finished streaming ${conversationCount} Messenger conversations, collected ${participantTasks.length} participants`);

      // Final existing contacts check for remaining participants
      if (participantTasks.length > 0) {
        const remainingIds = participantTasks.map(t => t.participantId);
        const finalExistingMap = await getExistingContactsMap(
        page.id,
          remainingIds,
        'messenger'
      );
        finalExistingMap.forEach((value, key) => existingContactsMap.set(key, value));

        // Filter remaining participants for SKIP_EXISTING mode
        const remainingToProcess = participantTasks.filter(task => {
        if (page.autoPipelineMode === 'SKIP_EXISTING' && page.autoPipelineId) {
          const existing = existingContactsMap.get(task.participantId);
            if (existing && existing.pipelineId) {
              return false; // Skip
          }
        }
        return true;
      });

        console.log(`[Background Sync ${jobId}] Processing remaining ${remainingToProcess.length} participants in batches...`);

        // Process remaining in batches
        const BATCH_SIZE = 50;
        for (let i = 0; i < remainingToProcess.length; i += BATCH_SIZE) {
          // Check if cancelled
          if (await isJobCancelled(jobId)) {
            console.log(`[Background Sync ${jobId}] Sync cancelled by user`);
            return;
          }

          const batch = remainingToProcess.slice(i, i + BATCH_SIZE);
          const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(remainingToProcess.length / BATCH_SIZE);

          console.log(`[Background Sync ${jobId}] Processing batch ${batchIndex}/${totalBatches} (${batch.length} contacts)...`);

          const batchResult = await processParticipantBatch(
            batch,
            page,
            client,
            jobId,
            messageFetchLimiter,
            analysisLimiter,
            existingContactsMap,
            'messenger'
          );

          syncedCount += batchResult.syncedCount;
          failedCount += batchResult.failedCount;
          errors.push(...batchResult.errors);
          if (batchResult.tokenExpired) {
            tokenExpired = true;
          }

          // Update progress after each batch
      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
              syncedContacts: syncedCount,
              failedContacts: failedCount,
        },
      });

          console.log(`[Background Sync ${jobId}] Batch ${batchIndex}/${totalBatches} complete: ${syncedCount} synced, ${failedCount} failed`);
        }
      }

      console.log(`[Background Sync ${jobId}] Messenger sync complete: ${syncedCount} synced, ${failedCount} failed`);
    } catch (error) {
      const errorCode = error instanceof FacebookApiError ? error.code : undefined;
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch conversations';

      if (error instanceof FacebookApiError && error.isTokenExpired) {
        tokenExpired = true;
      }

      console.error(`[Background Sync ${jobId}] Failed to fetch Messenger conversations:`, error);
      errors.push({
        platform: 'Messenger',
        id: 'conversations',
        error: errorMessage,
        code: errorCode,
      });
    }

    // Sync Instagram contacts (if connected)
    if (page.instagramAccountId) {
      try {
        console.log(`[Background Sync ${jobId}] Starting to stream Instagram conversations...`);

        interface InstagramParticipantTask {
          participantId: string;
          conversationId: string;
          updatedTime: string;
        }

        const igParticipantTasks: InstagramParticipantTask[] = [];
        let igConversationCount = 0;
        let igProcessedCount = 0;
        const igExistingContactsMap = new Map<string, { id: string; pipelineId: string | null }>();

        // Initialize concurrency limiters for Instagram
        const igMessageFetchLimiter = new ConcurrencyLimiter(50);
        const igAnalysisLimiter = new ConcurrencyLimiter(50);

        // Stream Instagram conversations and process incrementally
        for await (const convo of client.fetchInstagramConversationsStream(page.instagramAccountId)) {
          igConversationCount++;
        
        // Check if cancelled
        if (await isJobCancelled(jobId)) {
          console.log(`[Background Sync ${jobId}] Sync cancelled by user`);
          return;
        }

          // Collect participants immediately
          for (const participant of convo.participants.data) {
            if (participant.id === page.instagramAccountId) continue; // Skip page itself
            igParticipantTasks.push({
              participantId: participant.id,
              conversationId: convo.id,
              updatedTime: convo.updated_time,
            });
          }

          // Update progress during fetching (every 10 conversations)
          if (igConversationCount % 10 === 0) {
            const currentJob = await prisma.syncJob.findUnique({ where: { id: jobId } });
            await prisma.syncJob.update({
              where: { id: jobId },
              data: {
                totalContacts: (currentJob?.totalContacts || 0) + igParticipantTasks.length,
              },
            });
          }

          // Check existing contacts periodically (every 100 new participants)
          if (igParticipantTasks.length % 100 === 0 && igParticipantTasks.length > 0) {
            const newParticipantIds = igParticipantTasks
              .slice(-100)
              .map(t => t.participantId);
            const newExistingMap = await getExistingContactsMap(
              page.id,
              newParticipantIds,
              'instagram'
            );
            // Merge with existing map
            newExistingMap.forEach((value, key) => igExistingContactsMap.set(key, value));
          }

          // Start processing first batch when we have 50 participants
          if (igParticipantTasks.length >= 50 && igProcessedCount === 0) {
            console.log(`[Background Sync ${jobId}] Starting Instagram analysis with first batch of 50 participants...`);
            const firstBatch = igParticipantTasks.splice(0, 50);
            
            // Filter first batch for SKIP_EXISTING mode
            const firstBatchToProcess = firstBatch.filter(task => {
              if (page.autoPipelineMode === 'SKIP_EXISTING' && page.autoPipelineId) {
                const existing = igExistingContactsMap.get(task.participantId);
                if (existing && existing.pipelineId) {
                  return false; // Skip
                }
              }
              return true;
            });

            const batchResult = await processParticipantBatch(
              firstBatchToProcess,
              page,
              client,
              jobId,
              igMessageFetchLimiter,
              igAnalysisLimiter,
              igExistingContactsMap,
              'instagram'
            );

            syncedCount += batchResult.syncedCount;
            failedCount += batchResult.failedCount;
            errors.push(...batchResult.errors);
            if (batchResult.tokenExpired) {
              tokenExpired = true;
            }

            igProcessedCount += firstBatchToProcess.length;

            // Update progress
            await prisma.syncJob.update({
              where: { id: jobId },
                  data: {
                syncedContacts: syncedCount,
                failedContacts: failedCount,
                  },
                });

            console.log(`[Background Sync ${jobId}] Instagram first batch complete: ${syncedCount} synced, ${failedCount} failed`);
          }
        }

        console.log(`[Background Sync ${jobId}] Finished streaming ${igConversationCount} Instagram conversations, collected ${igParticipantTasks.length} participants`);

        // Final existing contacts check for remaining participants
        if (igParticipantTasks.length > 0) {
          const remainingIds = igParticipantTasks.map(t => t.participantId);
          const finalExistingMap = await getExistingContactsMap(
            page.id,
            remainingIds,
            'instagram'
          );
          finalExistingMap.forEach((value, key) => igExistingContactsMap.set(key, value));

          // Filter remaining participants for SKIP_EXISTING mode
          const remainingToProcess = igParticipantTasks.filter(task => {
            if (page.autoPipelineMode === 'SKIP_EXISTING' && page.autoPipelineId) {
              const existing = igExistingContactsMap.get(task.participantId);
              if (existing && existing.pipelineId) {
                return false; // Skip
              }
            }
            return true;
          });

          console.log(`[Background Sync ${jobId}] Processing remaining ${remainingToProcess.length} Instagram participants in batches...`);

          // Process remaining in batches
          const BATCH_SIZE = 50;
          for (let i = 0; i < remainingToProcess.length; i += BATCH_SIZE) {
            // Check if cancelled
            if (await isJobCancelled(jobId)) {
              console.log(`[Background Sync ${jobId}] Sync cancelled by user`);
              return;
            }

            const batch = remainingToProcess.slice(i, i + BATCH_SIZE);
            const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(remainingToProcess.length / BATCH_SIZE);

            console.log(`[Background Sync ${jobId}] Processing Instagram batch ${batchIndex}/${totalBatches} (${batch.length} contacts)...`);

            const batchResult = await processParticipantBatch(
              batch,
              page,
              client,
              jobId,
              igMessageFetchLimiter,
              igAnalysisLimiter,
              igExistingContactsMap,
              'instagram'
            );

            syncedCount += batchResult.syncedCount;
            failedCount += batchResult.failedCount;
            errors.push(...batchResult.errors);
            if (batchResult.tokenExpired) {
                    tokenExpired = true;
                  }

          // Update progress after each batch
                await prisma.syncJob.update({
                  where: { id: jobId },
                  data: {
                    syncedContacts: syncedCount,
                    failedContacts: failedCount,
                  },
              });

            console.log(`[Background Sync ${jobId}] Instagram batch ${batchIndex}/${totalBatches} complete: ${syncedCount} synced, ${failedCount} failed`);
      }
        }

        console.log(`[Background Sync ${jobId}] Instagram sync complete: ${syncedCount} synced, ${failedCount} failed`);
    } catch (error) {
      const errorCode = error instanceof FacebookApiError ? error.code : undefined;
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Instagram conversations';

      if (error instanceof FacebookApiError && error.isTokenExpired) {
        tokenExpired = true;
      }

      console.error(`[Background Sync ${jobId}] Failed to fetch Instagram conversations:`, error);
      errors.push({
        platform: 'Instagram',
        id: 'conversations',
        error: errorMessage,
        code: errorCode,
      });
    }
  }

    // Update last synced time if successful
    if (syncedCount > 0 || !tokenExpired) {
      await prisma.facebookPage.update({
        where: { id: page.id },
        data: { lastSyncedAt: new Date() },
      });
    }

    // Update job with final results
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: tokenExpired ? 'FAILED' : 'COMPLETED',
        syncedContacts: syncedCount,
        failedContacts: failedCount,
        errors: errors.length > 0 ? errors : undefined,
        completedAt: new Date(),
      },
    });

    console.log(`[Background Sync ${jobId}] Completed: ${syncedCount} synced, ${failedCount} failed${tokenExpired ? ' (Token expired)' : ''}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Background Sync ${jobId}] Fatal error:`, error);

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
