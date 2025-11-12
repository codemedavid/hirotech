import { prisma } from '@/lib/db'

/**
 * Auto-create default team threads when a team is created or a member joins
 */
export async function createDefaultTeamThreads(teamId: string) {
  try {
    // Check if default threads already exist
    const existingThreads = await prisma.teamThread.findFirst({
      where: {
        teamId,
        title: 'General Discussion'
      }
    })

    if (existingThreads) {
      console.log('[Auto-Create] Default threads already exist for team:', teamId)
      return
    }

    // Get all team members
    const members = await prisma.teamMember.findMany({
      where: {
        teamId,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            name: true
          }
        }
      }
    })

    if (members.length === 0) {
      console.log('[Auto-Create] No active members found for team:', teamId)
      return
    }

    const participantIds = members.map(m => m.id)

    // Create default "General Discussion" thread
    const generalThread = await prisma.teamThread.create({
      data: {
        teamId,
        title: 'General Discussion',
        description: 'Team-wide conversation space for everyone',
        type: 'DISCUSSION',
        participantIds,
        isChannel: true,
        enableTopics: false,
        isPinned: true,
        pinnedAt: new Date()
      }
    })

    console.log('[Auto-Create] Created General Discussion thread:', generalThread.id)

    // Create welcome message
    if (members.length > 0) {
      const firstMember = members[0]
      await prisma.teamMessage.create({
        data: {
          teamId,
          threadId: generalThread.id,
          senderId: firstMember.id,
          content: `Welcome to the team! 🎉 This is your General Discussion channel where everyone can collaborate and share updates.`,
          mentions: []
        }
      })

      // Update last message time
      await prisma.teamThread.update({
        where: { id: generalThread.id },
        data: { lastMessageAt: new Date() }
      })
    }

    console.log('[Auto-Create] Default threads created successfully for team:', teamId)
    return { generalThread }
  } catch (error) {
    console.error('[Auto-Create] Error creating default threads:', error)
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Add a new member to all existing channel threads
 */
export async function addMemberToChannelThreads(teamId: string, memberId: string) {
  try {
    // Find all channel threads for this team
    const channelThreads = await prisma.teamThread.findMany({
      where: {
        teamId,
        isChannel: true
      }
    })

    // Add member to all channel threads
    for (const thread of channelThreads) {
      if (!thread.participantIds.includes(memberId)) {
        await prisma.teamThread.update({
          where: { id: thread.id },
          data: {
            participantIds: {
              push: memberId
            }
          }
        })
      }
    }

    console.log(`[Auto-Create] Added member ${memberId} to ${channelThreads.length} channel threads`)
  } catch (error) {
    console.error('[Auto-Create] Error adding member to channel threads:', error)
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Remove a member from all threads
 */
export async function removeMemberFromThreads(teamId: string, memberId: string) {
  try {
    const threads = await prisma.teamThread.findMany({
      where: {
        teamId,
        participantIds: {
          has: memberId
        }
      }
    })

    for (const thread of threads) {
      await prisma.teamThread.update({
        where: { id: thread.id },
        data: {
          participantIds: thread.participantIds.filter(id => id !== memberId)
        }
      })
    }

    console.log(`[Auto-Create] Removed member ${memberId} from ${threads.length} threads`)
  } catch (error) {
    console.error('[Auto-Create] Error removing member from threads:', error)
  }
}

