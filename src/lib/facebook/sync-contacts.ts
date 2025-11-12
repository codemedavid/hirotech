import { prisma } from '@/lib/db';
import { FacebookClient, FacebookApiError } from './client';
import { analyzeWithFallback } from '@/lib/ai/enhanced-analysis';
import { autoAssignContactToPipeline } from '@/lib/pipelines/auto-assign';
import { applyStageScoreRanges } from '@/lib/pipelines/stage-analyzer';

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ platform: string; id: string; error: string; code?: number }>;
  tokenExpired?: boolean;
}

export async function syncContacts(facebookPageId: string): Promise<SyncResult> {
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

  if (!page) throw new Error('Facebook page not found');

  const client = new FacebookClient(page.pageAccessToken);
  let syncedCount = 0;
  let failedCount = 0;
  let tokenExpired = false;
  const errors: Array<{ platform: string; id: string; error: string; code?: number }> = [];

  console.log(`[Sync] Starting contact sync for Facebook Page: ${page.pageId}`);
  console.log('[Auto-Pipeline] Enabled:', !!page.autoPipelineId);
  if (page.autoPipelineId && page.autoPipeline) {
    console.log('[Auto-Pipeline] Target Pipeline:', page.autoPipeline.name);
    console.log('[Auto-Pipeline] Mode:', page.autoPipelineMode);
    console.log('[Auto-Pipeline] Stages:', page.autoPipeline.stages.length);
    
    // Auto-generate score ranges if stages still have defaults
    const hasDefaultRanges = page.autoPipeline.stages.some(
      s => s.leadScoreMin === 0 && s.leadScoreMax === 100
    );
    
    if (hasDefaultRanges) {
      console.log('[Auto-Pipeline] Detected default score ranges, auto-generating intelligent ranges...');
      await applyStageScoreRanges(page.autoPipelineId);
      console.log('[Auto-Pipeline] Score ranges applied successfully');
      
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

  // Sync Messenger contacts
  try {
    console.log('[Sync] Fetching Messenger conversations (with pagination)...');
    const messengerConvos = await client.getMessengerConversations(page.pageId);
    console.log(`[Sync] Fetched ${messengerConvos.length} Messenger conversations`);

    for (const convo of messengerConvos) {
      for (const participant of convo.participants.data) {
        if (participant.id === page.pageId) continue; // Skip page itself

        try {
          // Fetch ALL messages for comprehensive analysis
          console.log(`[Sync] Fetching all messages for conversation ${convo.id}...`);
          const allMessages = await client.getAllMessagesForConversation(convo.id);
          
          // Extract name from conversation messages (if available)
          let firstName = `User ${participant.id.slice(-6)}`; // Fallback name
          let lastName: string | null = null;
          
          if (allMessages && allMessages.length > 0) {
            // Find a message from this participant
            const userMessage = allMessages.find(
              (msg: any) => msg.from?.id === participant.id
            );
            
            if (userMessage?.from?.name) {
              // Split name into first and last
              const nameParts = userMessage.from.name.trim().split(' ');
              firstName = nameParts[0] || firstName;
              
              // Get last name (everything after first name)
              if (nameParts.length > 1) {
                lastName = nameParts.slice(1).join(' ');
              }
            }
          }
          
          // Analyze conversation with AI if messages exist
          let aiContext: string | null = null;
          let aiAnalysis = null;
          
          if (allMessages && allMessages.length > 0) {
            try {
              console.log(`[Sync] Processing ${allMessages.length} messages for analysis`);
              
              const messagesToAnalyze = allMessages
                .filter((msg: any) => msg.message)
                .map((msg: any) => ({
                  from: msg.from?.name || msg.from?.id || 'Unknown',
                  text: msg.message,
                  timestamp: msg.created_time ? new Date(msg.created_time) : undefined
                }))
                .reverse(); // Oldest first for chronological analysis

              if (messagesToAnalyze.length > 0) {
                // Enhanced AI analysis with fallback scoring (PREVENTS 0 lead scores)
                console.log('[Sync] Analyzing full conversation with enhanced fallback...');
                
                const { analysis, usedFallback, retryCount } = await analyzeWithFallback(
                    messagesToAnalyze,
                  page.autoPipelineId && page.autoPipeline ? page.autoPipeline.stages : undefined,
                  new Date(convo.updated_time)
                  );
                
                aiAnalysis = analysis;
                aiContext = analysis.summary;
                
                if (usedFallback) {
                  console.warn(`[Sync] Used fallback scoring after ${retryCount} attempts - Score: ${analysis.leadScore}`);
                } else {
                  console.log('[Sync] AI Analysis successful:', {
                    stage: analysis.recommendedStage,
                    score: analysis.leadScore,
                    status: analysis.leadStatus,
                    confidence: analysis.confidence
                  });
                }
                
                // Rate limit delay (shorter since retries are built-in)
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            } catch (error) {
              console.error(`[Sync] Failed to analyze conversation for ${participant.id}:`, error);
              // Add delay even on error to prevent rapid-fire failures
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          const savedContact = await prisma.contact.upsert({
            where: {
              messengerPSID_facebookPageId: {
                messengerPSID: participant.id,
                facebookPageId: page.id,
              },
            },
            create: {
              messengerPSID: participant.id,
              firstName: firstName,
              lastName: lastName,
              hasMessenger: true,
              organizationId: page.organizationId,
              facebookPageId: page.id,
              lastInteraction: new Date(convo.updated_time),
              aiContext: aiContext,
              aiContextUpdatedAt: aiContext ? new Date() : null,
            },
            update: {
              firstName: firstName,
              lastName: lastName,
              lastInteraction: new Date(convo.updated_time),
              hasMessenger: true,
              aiContext: aiContext,
              aiContextUpdatedAt: aiContext ? new Date() : null,
            },
          });
          
          // Auto-assign to pipeline if enabled
          if (aiAnalysis && page.autoPipelineId) {
            console.log('[Auto-Pipeline] Assigning contact to pipeline...');
            await autoAssignContactToPipeline({
              contactId: savedContact.id,
              aiAnalysis,
              pipelineId: page.autoPipelineId,
              updateMode: page.autoPipelineMode,
            });
            console.log('[Auto-Pipeline] Assignment complete for contact:', savedContact.id);
          }
          
          syncedCount++;
        } catch (error: any) {
          failedCount++;
          const errorMessage = error.message || 'Unknown error';
          const errorCode = error instanceof FacebookApiError ? error.code : undefined;
          
          // Check if token is expired
          if (error instanceof FacebookApiError && error.isTokenExpired) {
            tokenExpired = true;
          }
          
          console.error(`Failed to sync Messenger contact ${participant.id}:`, errorMessage);
          errors.push({
            platform: 'Messenger',
            id: participant.id,
            error: errorMessage,
            code: errorCode,
          });
        }
      }
    }
  } catch (error: any) {
    const errorCode = error instanceof FacebookApiError ? error.code : undefined;
    
    // Check if token is expired
    if (error instanceof FacebookApiError && error.isTokenExpired) {
      tokenExpired = true;
    }
    
    console.error('Failed to fetch Messenger conversations:', error);
    errors.push({
      platform: 'Messenger',
      id: 'conversations',
      error: error.message || 'Failed to fetch conversations',
      code: errorCode,
    });
  }

  // Sync Instagram contacts (if connected)
  if (page.instagramAccountId) {
    try {
      console.log('[Sync] Fetching Instagram conversations (with pagination)...');
      const igConvos = await client.getInstagramConversations(page.instagramAccountId);
      console.log(`[Sync] Fetched ${igConvos.length} Instagram conversations`);

      for (const convo of igConvos) {
        for (const participant of convo.participants.data) {
          if (participant.id === page.instagramAccountId) continue;

          try {
            // Fetch ALL messages for comprehensive analysis
            console.log(`[Sync] Fetching all IG messages for conversation ${convo.id}...`);
            const allMessages = await client.getAllMessagesForConversation(convo.id);
            
            // Extract name from conversation messages (if available)
            let firstName = `IG User ${participant.id.slice(-6)}`; // Fallback name
            let lastName: string | null = null;
            
            if (allMessages && allMessages.length > 0) {
              // Find a message from this participant
              const userMessage = allMessages.find(
                (msg: any) => msg.from?.id === participant.id
              );
              
              if (userMessage?.from?.name) {
                // Split name into first and last
                const nameParts = userMessage.from.name.trim().split(' ');
                firstName = nameParts[0] || firstName;
                
                // Get last name (everything after first name)
                if (nameParts.length > 1) {
                  lastName = nameParts.slice(1).join(' ');
                }
              } else if (userMessage?.from?.username) {
                // Fallback to username if name not available
                firstName = userMessage.from.username;
              }
            }
            
            // Analyze conversation with AI if messages exist
            let aiContext: string | null = null;
            let aiAnalysis = null;
            
            if (allMessages && allMessages.length > 0) {
              try {
                console.log(`[Sync] Processing ${allMessages.length} IG messages for analysis`);
                
                const messagesToAnalyze = allMessages
                  .filter((msg: any) => msg.message)
                  .map((msg: any) => ({
                    from: msg.from?.name || msg.from?.username || msg.from?.id || 'Unknown',
                    text: msg.message,
                    timestamp: msg.created_time ? new Date(msg.created_time) : undefined
                  }))
                  .reverse(); // Oldest first for chronological analysis

                if (messagesToAnalyze.length > 0) {
                  // Enhanced AI analysis with fallback scoring (PREVENTS 0 lead scores)
                  console.log('[Sync] Analyzing full IG conversation with enhanced fallback...');
                  
                  const { analysis, usedFallback, retryCount } = await analyzeWithFallback(
                      messagesToAnalyze,
                    page.autoPipelineId && page.autoPipeline ? page.autoPipeline.stages : undefined,
                    new Date(convo.updated_time)
                    );
                  
                  aiAnalysis = analysis;
                  aiContext = analysis.summary;
                  
                  if (usedFallback) {
                    console.warn(`[Sync] IG: Used fallback scoring after ${retryCount} attempts - Score: ${analysis.leadScore}`);
                  } else {
                    console.log('[Sync] IG AI Analysis successful:', {
                      stage: analysis.recommendedStage,
                      score: analysis.leadScore,
                      status: analysis.leadStatus,
                      confidence: analysis.confidence
                    });
                  }
                  
                  // Rate limit delay (shorter since retries are built-in)
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              } catch (error) {
                console.error(`[Sync] Failed to analyze IG conversation for ${participant.id}:`, error);
                // Add delay even on error to prevent rapid-fire failures
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            
            // Check if contact exists by Instagram ID or Messenger PSID
            const existingContact = await prisma.contact.findFirst({
              where: {
                OR: [
                  { instagramSID: participant.id, facebookPageId: page.id },
                  {
                    messengerPSID: participant.id,
                    facebookPageId: page.id,
                  },
                ],
              },
            });

            let savedContact;
            if (existingContact) {
              // Update existing contact
              savedContact = await prisma.contact.update({
                where: { id: existingContact.id },
                data: {
                  instagramSID: participant.id,
                  firstName: firstName,
                  lastName: lastName,
                  hasInstagram: true,
                  lastInteraction: new Date(convo.updated_time),
                  aiContext: aiContext,
                  aiContextUpdatedAt: aiContext ? new Date() : null,
                },
              });
            } else {
              // Create new contact with full name from messages
              savedContact = await prisma.contact.create({
                data: {
                  instagramSID: participant.id,
                  firstName: firstName,
                  lastName: lastName,
                  hasInstagram: true,
                  organizationId: page.organizationId,
                  facebookPageId: page.id,
                  lastInteraction: new Date(convo.updated_time),
                  aiContext: aiContext,
                  aiContextUpdatedAt: aiContext ? new Date() : null,
                },
              });
            }
            
            // Auto-assign to pipeline if enabled
            if (aiAnalysis && page.autoPipelineId) {
              console.log('[Auto-Pipeline] Assigning IG contact to pipeline...');
              await autoAssignContactToPipeline({
                contactId: savedContact.id,
                aiAnalysis,
                pipelineId: page.autoPipelineId,
                updateMode: page.autoPipelineMode,
              });
              console.log('[Auto-Pipeline] IG assignment complete for contact:', savedContact.id);
            }
            
            syncedCount++;
          } catch (error: any) {
            failedCount++;
            const errorMessage = error.message || 'Unknown error';
            const errorCode = error instanceof FacebookApiError ? error.code : undefined;
            
            // Check if token is expired
            if (error instanceof FacebookApiError && error.isTokenExpired) {
              tokenExpired = true;
            }
            
            console.error(`Failed to sync IG contact ${participant.id}:`, errorMessage);
            errors.push({
              platform: 'Instagram',
              id: participant.id,
              error: errorMessage,
              code: errorCode,
            });
          }
        }
      }
    } catch (error: any) {
      const errorCode = error instanceof FacebookApiError ? error.code : undefined;
      
      // Check if token is expired
      if (error instanceof FacebookApiError && error.isTokenExpired) {
        tokenExpired = true;
      }
      
      console.error('Failed to fetch Instagram conversations:', error);
      errors.push({
        platform: 'Instagram',
        id: 'conversations',
        error: error.message || 'Failed to fetch conversations',
        code: errorCode,
      });
    }
  }

  // Update last synced time only if sync was at least partially successful
  if (syncedCount > 0 || !tokenExpired) {
    await prisma.facebookPage.update({
      where: { id: page.id },
      data: { lastSyncedAt: new Date() },
    });
  }

  console.log(`[Sync] Sync completed: ${syncedCount} synced, ${failedCount} failed${tokenExpired ? ' (Token expired)' : ''}`);

  return {
    success: true,
    synced: syncedCount,
    failed: failedCount,
    errors,
    tokenExpired,
  };
}


