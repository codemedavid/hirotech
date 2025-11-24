import { prisma } from '@/lib/db';
import { FacebookClient } from './client';
import { analyzeWithFallback } from '@/lib/ai/enhanced-analysis';
import { analyzeConversation } from '@/lib/ai/google-ai-service';
import { autoAssignContactToPipeline } from '@/lib/pipelines/auto-assign';

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

interface AnalyzeSelectedContactsResult {
  successCount: number;
  failedCount: number;
  errors: Array<{ contactId: string; error: string }>;
}

/**
 * Analyzes selected contacts by fetching their conversations and assigning to pipeline
 */
export async function analyzeSelectedContacts(
  contactIds: string[],
  organizationId: string
): Promise<AnalyzeSelectedContactsResult> {
  let successCount = 0;
  let failedCount = 0;
  const errors: Array<{ contactId: string; error: string }> = [];

  console.log(`[Analyze Selected] Starting analysis for ${contactIds.length} contacts`);

  // Fetch contacts with their Facebook page info
  const contacts = await prisma.contact.findMany({
    where: {
      id: { in: contactIds },
      organizationId,
    },
    include: {
      facebookPage: {
        include: {
          autoPipeline: {
            include: {
              stages: { orderBy: { order: 'asc' } }
            }
          }
        }
      }
    },
  });

  if (contacts.length === 0) {
    return { successCount: 0, failedCount: 0, errors: [] };
  }

  // Group contacts by Facebook page (to reuse client and conversations)
  const contactsByPage = new Map<string, typeof contacts>();
  for (const contact of contacts) {
    const pageId = contact.facebookPageId;
    if (!contactsByPage.has(pageId)) {
      contactsByPage.set(pageId, []);
    }
    contactsByPage.get(pageId)!.push(contact);
  }

  // Process each page's contacts
  for (const [, pageContacts] of contactsByPage) {
    const page = pageContacts[0].facebookPage;
    
    const hasAutoPipeline = page.autoPipelineId && page.autoPipeline;
    
    if (!hasAutoPipeline) {
      console.log(`[Analyze Selected] Page ${page.pageName} has no auto-pipeline configured, will analyze without pipeline assignment`);
    }

    const client = new FacebookClient(page.pageAccessToken);

    // Build list of participant IDs we need to find
    const neededParticipantIds = new Set<string>();
    for (const contact of pageContacts) {
      if (contact.messengerPSID) neededParticipantIds.add(contact.messengerPSID);
      if (contact.instagramSID) neededParticipantIds.add(contact.instagramSID);
    }

    // Fetch conversations incrementally, stopping when we find all needed participants
    console.log(`[Analyze Selected] Fetching conversations for page ${page.pageName} (looking for ${neededParticipantIds.size} participants)...`);
    const messengerConvos = await client.getMessengerConversationsUntilFound(
      page.pageId,
      neededParticipantIds
    );
    console.log(`[Analyze Selected] Fetched ${messengerConvos.length} Messenger conversations (stopped early when all participants found)`);
    
    // Create conversation maps - only for participants we need
    const messengerConversationMap = new Map<string, { conversationId: string; updatedTime: string }>();
    let foundCount = 0;
    for (const convo of messengerConvos) {
      // Early exit if we've found all needed participants
      if (foundCount >= neededParticipantIds.size) {
        console.log(`[Analyze Selected] Found all ${foundCount} participants, skipping remaining conversations`);
        break;
      }

      for (const participant of convo.participants.data) {
        if (participant.id !== page.pageId && neededParticipantIds.has(participant.id)) {
          const existing = messengerConversationMap.get(participant.id);
          if (!existing || new Date(convo.updated_time) > new Date(existing.updatedTime)) {
            messengerConversationMap.set(participant.id, {
              conversationId: convo.id,
              updatedTime: convo.updated_time,
            });
            if (!existing) foundCount++;
          }
        }
      }
    }
    console.log(`[Analyze Selected] Found conversations for ${messengerConversationMap.size} Messenger participants`);

    // Fetch Instagram conversations if connected - only for needed participants
    const instagramConversationMap = new Map<string, { conversationId: string; updatedTime: string }>();
    if (page.instagramAccountId) {
      try {
        const igConvos = await client.getInstagramConversationsUntilFound(
          page.instagramAccountId,
          neededParticipantIds
        );
        console.log(`[Analyze Selected] Fetched ${igConvos.length} Instagram conversations (stopped early when all participants found)`);
        let igFoundCount = 0;
        for (const convo of igConvos) {
          // Early exit if we've found all needed participants
          if (igFoundCount >= neededParticipantIds.size) {
            console.log(`[Analyze Selected] Found all ${igFoundCount} IG participants, skipping remaining conversations`);
            break;
          }

          for (const participant of convo.participants.data) {
            if (participant.id !== page.instagramAccountId && neededParticipantIds.has(participant.id)) {
              const existing = instagramConversationMap.get(participant.id);
              if (!existing || new Date(convo.updated_time) > new Date(existing.updatedTime)) {
                instagramConversationMap.set(participant.id, {
                  conversationId: convo.id,
                  updatedTime: convo.updated_time,
                });
                if (!existing) igFoundCount++;
              }
            }
          }
        }
        console.log(`[Analyze Selected] Found conversations for ${instagramConversationMap.size} Instagram participants`);
      } catch (error) {
        console.error(`[Analyze Selected] Failed to fetch Instagram conversations:`, error);
      }
    }

    // Process all contacts continuously - each contact completes independently
    const conversationFetchLimiter = new ConcurrencyLimiter(50); // Higher concurrency
    const analysisLimiter = new ConcurrencyLimiter(50); // Higher concurrency

    console.log(`[Analyze Selected] Processing ${pageContacts.length} contacts continuously...`);

    // Process all contacts in one continuous flow
    await Promise.all(
      pageContacts.map(async (contact) => {
        try {
          // Step 1: Find conversation ID
          let conversationInfo = contact.messengerPSID 
            ? messengerConversationMap.get(contact.messengerPSID)
            : null;

          if (!conversationInfo && contact.instagramSID) {
            conversationInfo = instagramConversationMap.get(contact.instagramSID);
          }

          if (!conversationInfo) {
            failedCount++;
            errors.push({ contactId: contact.id, error: 'Conversation not found' });
            return;
          }

          // Step 2: Fetch messages (concurrency limited)
          const messages = await conversationFetchLimiter.execute(async () => {
            try {
              // Use recent messages only (last 100) for faster analysis
              return await client.getRecentMessagesForConversation(conversationInfo!.conversationId, 100);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              throw errorMessage;
            }
          });

          if (!messages || messages.length === 0) {
            failedCount++;
            errors.push({ contactId: contact.id, error: 'No messages found' });
            return;
          }

          // Step 3: Prepare messages for analysis
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
            .reverse();

          if (messagesToAnalyze.length === 0) {
            failedCount++;
            errors.push({ contactId: contact.id, error: 'No valid messages to analyze' });
            return;
          }

          // Step 4: Analyze with AI (concurrency limited)
          let analysis: { summary: string; leadScore?: number; recommendedStage?: string; leadStatus?: string; confidence?: number; reasoning?: string } | null = null;
          
          if (hasAutoPipeline && page.autoPipeline) {
            // Use pipeline-based analysis with stage recommendation
            const result = await analysisLimiter.execute(async () => {
              return await analyzeWithFallback(
                messagesToAnalyze,
                page.autoPipeline!.stages,
                contact.lastInteraction || undefined
              );
            });
            analysis = result.analysis;
          } else {
            // Use simple analysis without pipeline
            const summary = await analysisLimiter.execute(async () => {
              return await analyzeConversation(messagesToAnalyze);
            });
            
            if (!summary) {
              throw new Error('AI analysis returned no summary');
            }
            
            analysis = {
              summary,
              leadScore: 50, // Default score when no pipeline
              recommendedStage: undefined,
              leadStatus: undefined,
              confidence: undefined,
              reasoning: undefined,
            };
          }
          
          if (!analysis) {
            throw new Error('Analysis failed');
          }

          // Step 5: Update contact with AI context (immediate - contact appears in pipeline now)
          try {
            await prisma.contact.update({
              where: { id: contact.id },
              data: {
                aiContext: analysis.summary,
                aiContextUpdatedAt: new Date(),
              },
            });
          } catch (dbError: unknown) {
            // Handle database connection errors
            const dbErrorObj = dbError as { code?: string; message?: string };
            if (dbErrorObj?.code === 'P1001' || dbErrorObj?.message?.includes("Can't reach database")) {
              console.error(`[Analyze Selected] Database connection error for contact ${contact.id}:`, dbErrorObj.message);
              failedCount++;
              errors.push({ 
                contactId: contact.id, 
                error: 'Database connection failed. Please try again.' 
              });
              return; // Skip pipeline assignment if DB update failed
            }
            throw dbError; // Re-throw other errors
          }

          // Step 6: Assign to pipeline (only if auto-pipeline is configured and analysis has required fields)
          if (hasAutoPipeline && page.autoPipelineId) {
            // Check if we have the minimum required fields for pipeline assignment
            const hasLeadScore = analysis.leadScore !== undefined && analysis.leadScore !== null;
            const hasRecommendedStage = analysis.recommendedStage && analysis.recommendedStage.trim().length > 0;
            
            if (!hasLeadScore || !hasRecommendedStage) {
              console.warn(`[Analyze Selected] Missing required fields for pipeline assignment for contact ${contact.id}:`, {
                hasLeadScore,
                leadScore: analysis.leadScore,
                hasRecommendedStage,
                recommendedStage: analysis.recommendedStage,
              });
              // Use fallback values if missing
              const fallbackLeadScore = analysis.leadScore ?? 50;
              const fallbackStage = analysis.recommendedStage || page.autoPipeline?.stages[0]?.name || 'New Lead';
              
              console.log(`[Analyze Selected] Using fallback values: score=${fallbackLeadScore}, stage=${fallbackStage}`);
              
              try {
                await autoAssignContactToPipeline({
                  contactId: contact.id,
                  aiAnalysis: {
                    summary: analysis.summary,
                    leadScore: fallbackLeadScore,
                    recommendedStage: fallbackStage,
                    leadStatus: analysis.leadStatus || 'NEW',
                    confidence: analysis.confidence || 50,
                    reasoning: analysis.reasoning || `AI analysis completed but some fields missing. Score: ${fallbackLeadScore}`,
                  },
                  pipelineId: page.autoPipelineId,
                  updateMode: page.autoPipelineMode,
                });
                console.log(`[Analyze Selected] Successfully assigned contact ${contact.id} to pipeline using fallback values`);
              } catch (fallbackError: unknown) {
                const fallbackErrorObj = fallbackError as { code?: string; message?: string };
                console.error(`[Analyze Selected] Failed to assign contact ${contact.id} to pipeline even with fallback values:`, fallbackErrorObj.message);
                failedCount++;
                errors.push({ 
                  contactId: contact.id, 
                  error: `Pipeline assignment failed: ${fallbackErrorObj.message || 'Unknown error'}` 
                });
              }
            } else {
              // All required fields present - normal assignment
              try {
                await autoAssignContactToPipeline({
                  contactId: contact.id,
                  aiAnalysis: {
                    summary: analysis.summary,
                    leadScore: analysis.leadScore!,
                    recommendedStage: analysis.recommendedStage!,
                    leadStatus: analysis.leadStatus || 'NEW',
                    confidence: analysis.confidence || 50,
                    reasoning: analysis.reasoning || 'AI analysis',
                  },
                  pipelineId: page.autoPipelineId,
                  updateMode: page.autoPipelineMode,
                });
                console.log(`[Analyze Selected] Successfully assigned contact ${contact.id} to pipeline`);
              } catch (pipelineError: unknown) {
                // Handle database connection errors during pipeline assignment
                const pipelineErrorObj = pipelineError as { code?: string; message?: string };
                if (pipelineErrorObj?.code === 'P1001' || pipelineErrorObj?.message?.includes("Can't reach database")) {
                  console.error(`[Analyze Selected] Database connection error during pipeline assignment for contact ${contact.id}:`, pipelineErrorObj.message);
                  // Contact was updated but pipeline assignment failed - still count as partial success
                  failedCount++;
                  errors.push({ 
                    contactId: contact.id, 
                    error: 'Contact analyzed but pipeline assignment failed due to database connection issue.' 
                  });
                  return;
                }
                console.error(`[Analyze Selected] Pipeline assignment error for contact ${contact.id}:`, pipelineErrorObj.message);
                throw pipelineError; // Re-throw other errors
              }
            }
          } else {
            console.log(`[Analyze Selected] Skipping pipeline assignment for contact ${contact.id} - ${!hasAutoPipeline ? 'no auto-pipeline configured' : 'missing pipeline ID'}`);
          }

          successCount++;
        } catch (error) {
          failedCount++;
          const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : 'Unknown error');
          errors.push({ contactId: contact.id, error: errorMessage });
        }
      })
    );
  }

  console.log(`[Analyze Selected] Completed: ${successCount} analyzed, ${failedCount} failed`);
  return { successCount, failedCount, errors };
}

