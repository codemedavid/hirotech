import { prisma } from '@/lib/db'
import { NotificationType } from '@prisma/client'
import { TaskNotificationInput } from './validation'

interface NotificationPayload {
  memberId: string
  type: NotificationType
  title: string
  message: string
  entityType?: string
  entityId?: string
  entityUrl?: string
}

/**
 * Create a notification for a team member
 */
export async function createNotification(payload: NotificationPayload) {
  try {
    const notification = await prisma.teamNotification.create({
      data: {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        ...payload,
        isRead: false,
        createdAt: new Date()
      },
      include: {
        TeamMember: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            }
          }
        }
      }
    })

    return notification
  } catch (error) {
    console.error('Error creating notification:', error)
    throw error
  }
}

/**
 * Create notifications for multiple members
 */
export async function createBulkNotifications(
  notifications: Omit<NotificationPayload, 'memberId'> & { memberIds: string[] }
) {
  const { memberIds, ...payload } = notifications

  try {
    const notificationData = memberIds.map((memberId) => ({
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      memberId,
      ...payload,
      isRead: false,
      createdAt: new Date()
    }))

    const result = await prisma.teamNotification.createMany({
      data: notificationData,
      skipDuplicates: true
    })

    return result
  } catch (error) {
    console.error('Error creating bulk notifications:', error)
    throw error
  }
}

/**
 * Send task assignment notification
 */
export async function notifyTaskAssigned({
  taskId,
  assigneeId,
  taskTitle,
  assignedBy,
  teamId,
  dueDate
}: {
  taskId: string
  assigneeId: string
  taskTitle: string
  assignedBy: string
  teamId: string
  dueDate?: Date | null
}) {
  const dueDateText = dueDate 
    ? ` Due ${new Date(dueDate).toLocaleDateString()}`
    : ''

  return createNotification({
    memberId: assigneeId,
    type: 'TASK_ASSIGNED',
    title: 'New Task Assigned',
    message: `You've been assigned: "${taskTitle}"${dueDateText}`,
    entityType: 'task',
    entityId: taskId,
    entityUrl: `/team?tab=tasks&taskId=${taskId}`
  })
}

/**
 * Send task updated notification
 */
export async function notifyTaskUpdated({
  taskId,
  assigneeId,
  taskTitle,
  changesSummary,
  updatedBy,
  teamId
}: {
  taskId: string
  assigneeId: string
  taskTitle: string
  changesSummary: string
  updatedBy: string
  teamId: string
}) {
  return createNotification({
    memberId: assigneeId,
    type: 'TASK_UPDATED',
    title: 'Task Updated',
    message: `"${taskTitle}" was updated: ${changesSummary}`,
    entityType: 'task',
    entityId: taskId,
    entityUrl: `/team?tab=tasks&taskId=${taskId}`
  })
}

/**
 * Send task completed notification
 */
export async function notifyTaskCompleted({
  taskId,
  creatorId,
  taskTitle,
  completedBy,
  teamId
}: {
  taskId: string
  creatorId: string
  taskTitle: string
  completedBy: string
  teamId: string
}) {
  // Don't notify if creator is the one who completed it
  if (creatorId === completedBy) {
    return null
  }

  return createNotification({
    memberId: creatorId,
    type: 'TASK_COMPLETED',
    title: 'Task Completed',
    message: `"${taskTitle}" has been completed`,
    entityType: 'task',
    entityId: taskId,
    entityUrl: `/team?tab=tasks&taskId=${taskId}`
  })
}

/**
 * Send task due soon notification
 */
export async function notifyTaskDueSoon({
  taskId,
  assigneeId,
  taskTitle,
  dueDate,
  teamId
}: {
  taskId: string
  assigneeId: string
  taskTitle: string
  dueDate: Date
  teamId: string
}) {
  const hoursUntilDue = Math.round((dueDate.getTime() - Date.now()) / (1000 * 60 * 60))
  
  return createNotification({
    memberId: assigneeId,
    type: 'TASK_DUE_SOON',
    title: 'Task Due Soon',
    message: `"${taskTitle}" is due in ${hoursUntilDue} hours`,
    entityType: 'task',
    entityId: taskId,
    entityUrl: `/team?tab=tasks&taskId=${taskId}`
  })
}

/**
 * Send mention notification
 */
export async function notifyMentioned({
  messageId,
  threadId,
  mentionedMemberIds,
  senderName,
  messagePreview,
  teamId
}: {
  messageId: string
  threadId: string
  mentionedMemberIds: string[]
  senderName: string
  messagePreview: string
  teamId: string
}) {
  const preview = messagePreview.length > 100
    ? messagePreview.substring(0, 100) + '...'
    : messagePreview

  return createBulkNotifications({
    memberIds: mentionedMemberIds,
    type: 'MESSAGE_MENTION',
    title: 'You Were Mentioned',
    message: `${senderName} mentioned you: "${preview}"`,
    entityType: 'message',
    entityId: messageId,
    entityUrl: `/team?tab=inbox&threadId=${threadId}&messageId=${messageId}`
  })
}

/**
 * Send message reply notification
 */
export async function notifyMessageReply({
  messageId,
  threadId,
  originalAuthorId,
  replierName,
  replyPreview,
  teamId
}: {
  messageId: string
  threadId: string
  originalAuthorId: string
  replierName: string
  replyPreview: string
  teamId: string
}) {
  const preview = replyPreview.length > 100
    ? replyPreview.substring(0, 100) + '...'
    : replyPreview

  return createNotification({
    memberId: originalAuthorId,
    type: 'MESSAGE_REPLY',
    title: 'New Reply',
    message: `${replierName} replied: "${preview}"`,
    entityType: 'message',
    entityId: messageId,
    entityUrl: `/team?tab=inbox&threadId=${threadId}&messageId=${messageId}`
  })
}

/**
 * Send member joined notification (to admins)
 */
export async function notifyMemberJoined({
  teamId,
  newMemberName,
  newMemberEmail,
  adminIds
}: {
  teamId: string
  newMemberName: string
  newMemberEmail: string
  adminIds: string[]
}) {
  return createBulkNotifications({
    memberIds: adminIds,
    type: 'MEMBER_JOINED',
    title: 'New Team Member',
    message: `${newMemberName} (${newMemberEmail}) joined the team`,
    entityType: 'member',
    entityUrl: `/team?tab=members`
  })
}

/**
 * Send role changed notification
 */
export async function notifyRoleChanged({
  memberId,
  oldRole,
  newRole,
  changedBy,
  teamId
}: {
  memberId: string
  oldRole: string
  newRole: string
  changedBy: string
  teamId: string
}) {
  return createNotification({
    memberId,
    type: 'ROLE_CHANGED',
    title: 'Role Updated',
    message: `Your role was changed from ${oldRole} to ${newRole}`,
    entityType: 'member',
    entityUrl: `/team?tab=members`
  })
}

/**
 * Send team announcement (to all active members)
 */
export async function notifyTeamAnnouncement({
  teamId,
  title,
  message,
  senderName,
  broadcastId
}: {
  teamId: string
  title: string
  message: string
  senderName: string
  broadcastId?: string
}) {
  // Get all active team members
  const members = await prisma.teamMember.findMany({
    where: {
      teamId,
      status: 'ACTIVE'
    },
    select: {
      id: true
    }
  })

  return createBulkNotifications({
    memberIds: members.map(m => m.id),
    type: 'TEAM_ANNOUNCEMENT',
    title: `📢 ${title}`,
    message: `${senderName}: ${message}`,
    entityType: 'broadcast',
    entityId: broadcastId,
    entityUrl: `/team?tab=overview`
  })
}

/**
 * Get unread notification count for a member
 */
export async function getUnreadCount(memberId: string): Promise<number> {
  try {
    const count = await prisma.teamNotification.count({
      where: {
        memberId,
        isRead: false
      }
    })

    return count
  } catch (error) {
    console.error('Error getting unread count:', error)
    return 0
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    const notification = await prisma.teamNotification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date()
      }
    })

    return notification
  } catch (error) {
    console.error('Error marking notification as read:', error)
    throw error
  }
}

/**
 * Mark all notifications as read for a member
 */
export async function markAllNotificationsAsRead(memberId: string) {
  try {
    const result = await prisma.teamNotification.updateMany({
      where: {
        memberId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    })

    return result
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    throw error
  }
}

/**
 * Get notifications for a member with pagination
 */
export async function getNotifications({
  memberId,
  limit = 50,
  offset = 0,
  unreadOnly = false
}: {
  memberId: string
  limit?: number
  offset?: number
  unreadOnly?: boolean
}) {
  try {
    const where: any = { memberId }
    if (unreadOnly) {
      where.isRead = false
    }

    const [notifications, total] = await Promise.all([
      prisma.teamNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.teamNotification.count({ where })
    ])

    return { notifications, total }
  } catch (error) {
    console.error('Error fetching notifications:', error)
    throw error
  }
}

/**
 * Delete old read notifications (cleanup job)
 * Keeps notifications for 30 days after being read
 */
export async function cleanupOldNotifications() {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  try {
    const result = await prisma.teamNotification.deleteMany({
      where: {
        isRead: true,
        readAt: {
          lt: thirtyDaysAgo
        }
      }
    })

    console.log(`Cleaned up ${result.count} old notifications`)
    return result
  } catch (error) {
    console.error('Error cleaning up notifications:', error)
    throw error
  }
}
