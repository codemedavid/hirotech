import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { generateFollowUpMessage } from '@/lib/ai/google-ai-service';
import { FacebookClient } from '@/lib/facebook/client';
import { isContactEligibleForAutomation } from '@/lib/ai/conflict-prevention';

// POST /api/ai-automations/execute - Manual trigger of automation rule
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { ruleId } = body;

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    // Get rule
    const rule = await prisma.aIAutomationRule.findFirst({
      where: {
        id: ruleId,
        userId: session.user.id,
      },
      include: {
        FacebookPage: true,
      },
    });

    if (!rule) {
      return NextResponse.json(
        { error: 'Automation rule not found' },
        { status: 404 }
      );
    }

    console.log(`[AI Automations] Manual execution of rule: ${rule.name}`);

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Calculate time threshold
    const now = new Date();
    const thresholdMs =
      (rule.timeIntervalDays || 0) * 24 * 60 * 60 * 1000 +
      (rule.timeIntervalHours || 0) * 60 * 60 * 1000 +
      (rule.timeIntervalMinutes || 0) * 60 * 1000;

    const thresholdDate = new Date(now.getTime() - thresholdMs);

    // Build where clause for finding eligible conversations
    const whereClause: any = {
      organizationId: user.organizationId,
      lastInteraction: {
        lte: thresholdDate,
      },
    };

    // Filter by Facebook page if specified
    if (rule.facebookPageId) {
      whereClause.facebookPageId = rule.facebookPageId;
    }

    // Filter by tags if specified
    if (rule.includeTags.length > 0) {
      whereClause.tags = {
        hasSome: rule.includeTags,
      };
    }

    // Get eligible contacts
    let eligibleContacts = await prisma.contact.findMany({
      where: whereClause,
      include: {
        facebookPage: true,
        conversations: {
          where: {
            platform: 'MESSENGER',
          },
          orderBy: {
            lastMessageAt: 'desc',
          },
          take: 1,
        },
      },
      take: 50, // Limit for manual testing
    });

    // Exclude contacts with excluded tags
    if (rule.excludeTags.length > 0) {
      eligibleContacts = eligibleContacts.filter(contact => {
        return !rule.excludeTags.some(tag => contact.tags.includes(tag));
      });
    }

    // Filter out contacts that have been stopped for this rule
    const stoppedContactIds = await prisma.aIAutomationStop.findMany({
      where: {
        ruleId: rule.id,
      },
      select: {
        contactId: true,
      },
    });

    const stoppedIds = stoppedContactIds.map(s => s.contactId);
    eligibleContacts = eligibleContacts.filter(c => !stoppedIds.includes(c.id));

    console.log(`[AI Automations] Found ${eligibleContacts.length} eligible contacts`);

    let sent = 0;
    let failed = 0;

    // Process each eligible contact
    for (const contact of eligibleContacts) {
      try {
        // ⭐ CONFLICT PREVENTION: Check if contact is eligible
        const eligibilityCheck = await isContactEligibleForAutomation(
          contact.id,
          rule.excludeTags
        );

        if (!eligibilityCheck.eligible) {
          console.log(`[AI Automations] Contact ${contact.id} not eligible: ${eligibilityCheck.reason}`);
          continue;
        }

        const conversation = contact.conversations[0];
        if (!conversation) {
          console.log(`[AI Automations] No conversation found for contact: ${contact.id}`);
          failed++;
          continue;
        }

        // Get conversation history
        const messages = await prisma.message.findMany({
          where: {
            conversationId: conversation.id,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 20,
        });

        if (messages.length === 0) {
          console.log(`[AI Automations] No messages in conversation: ${conversation.id}`);
          failed++;
          continue;
        }

        // Format messages for AI
        const conversationHistory = messages.reverse().map(msg => ({
          from: msg.isFromBusiness ? 'Business' : contact.firstName || 'Customer',
          text: msg.content,
          timestamp: msg.createdAt,
        }));

        // Generate AI message
        const aiResult = await generateFollowUpMessage(
          contact.firstName || 'there',
          conversationHistory,
          rule.customPrompt,
          rule.languageStyle
        );

        if (!aiResult) {
          console.error(`[AI Automations] Failed to generate message for contact: ${contact.id}`);
          failed++;
          
          // Log execution failure
          await prisma.aIAutomationExecution.create({
            data: {
              id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              ruleId: rule.id,
              userId: session.user.id,
              contactId: contact.id,
              conversationId: conversation.id,
              recipientPSID: contact.messengerPSID || 'unknown',
              recipientName: `${contact.firstName} ${contact.lastName || ''}`.trim(),
              aiPromptUsed: rule.customPrompt,
              status: 'failed',
              errorMessage: 'Failed to generate AI message',
              executedAt: new Date(),
            },
          });
          
          continue;
        }

        // Send message via Facebook
        const facebookClient = new FacebookClient(contact.facebookPage.pageAccessToken);
        const result = await facebookClient.sendMessengerMessage({
          recipientId: contact.messengerPSID!,
          message: aiResult.message,
          messageTag: rule.messageTag || 'ACCOUNT_UPDATE',
        });

        if (result.success) {
          // Log successful execution
          await prisma.aIAutomationExecution.create({
            data: {
              id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              ruleId: rule.id,
              userId: session.user.id,
              contactId: contact.id,
              conversationId: conversation.id,
              recipientPSID: contact.messengerPSID || 'unknown',
              recipientName: `${contact.firstName} ${contact.lastName || ''}`.trim(),
              aiPromptUsed: rule.customPrompt,
              generatedMessage: aiResult.message,
              aiReasoning: aiResult.reasoning,
              previousMessages: conversationHistory as any,
              status: 'sent',
              facebookMessageId: result.data?.message_id,
              executedAt: new Date(),
            },
          });

          // Save message to database
          await prisma.message.create({
            data: {
              content: aiResult.message,
              platform: 'MESSENGER',
              status: 'SENT',
              messageTag: rule.messageTag || 'ACCOUNT_UPDATE',
              facebookMessageId: result.data?.message_id,
              contactId: contact.id,
              conversationId: conversation.id,
              isFromBusiness: true,
              sentAt: new Date(),
            },
          });

          sent++;
          console.log(`[AI Automations] Sent message to ${contact.firstName}: "${aiResult.message}"`);
        } else {
          failed++;
          
          // Log execution failure
          await prisma.aIAutomationExecution.create({
            data: {
              id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              ruleId: rule.id,
              userId: session.user.id,
              contactId: contact.id,
              conversationId: conversation.id,
              recipientPSID: contact.messengerPSID || 'unknown',
              recipientName: `${contact.firstName} ${contact.lastName || ''}`.trim(),
              aiPromptUsed: rule.customPrompt,
              generatedMessage: aiResult.message,
              aiReasoning: aiResult.reasoning,
              status: 'failed',
              errorMessage: result.error || 'Unknown error',
              executedAt: new Date(),
            },
          });
          
          console.error(`[AI Automations] Failed to send message: ${result.error}`);
        }
      } catch (error) {
        console.error(`[AI Automations] Error processing contact ${contact.id}:`, error);
        failed++;
      }
    }

    // Update rule statistics
    await prisma.aIAutomationRule.update({
      where: { id: rule.id },
      data: {
        lastExecutedAt: now,
        executionCount: { increment: 1 },
        successCount: { increment: sent },
        failureCount: { increment: failed },
        updatedAt: new Date(),
      },
    });

    console.log(`[AI Automations] Execution complete: ${sent} sent, ${failed} failed`);

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: eligibleContacts.length,
    });
  } catch (error) {
    console.error('[AI Automations] Execute error:', error);
    return NextResponse.json(
      { error: 'Failed to execute automation rule' },
      { status: 500 }
    );
  }
}

