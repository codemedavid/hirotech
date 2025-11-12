import { prisma } from '@/lib/db'
import { TeamActivityType, Prisma } from '@prisma/client'

export interface ActivityLogOptions {
  teamId: string
  memberId?: string
  type: TeamActivityType
  action: string
  entityType?: string
  entityId?: string
  entityName?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  duration?: number
}

/**
 * Logs a team activity
 */
export async function logActivity(options: ActivityLogOptions) {
  return prisma.teamActivity.create({
    data: {
      ...options,
      metadata: options.metadata ? (options.metadata as Prisma.InputJsonValue) : undefined
    }
  })
}

/**
 * Logs a page view
 */
export async function logPageView(
  teamId: string,
  memberId: string,
  pagePath: string,
  duration?: number
) {
  return logActivity({
    teamId,
    memberId,
    type: 'VIEW_PAGE',
    action: `Viewed ${pagePath}`,
    metadata: { pagePath },
    duration
  })
}

/**
 * Logs login activity
 */
export async function logLogin(
  teamId: string,
  memberId: string,
  ipAddress?: string,
  userAgent?: string
) {
  // Update member's last login
  await prisma.teamMember.update({
    where: { id: memberId },
    data: { lastLoginAt: new Date(), lastActiveAt: new Date() }
  })
  
  return logActivity({
    teamId,
    memberId,
    type: 'LOGIN',
    action: 'Logged in to team',
    ipAddress,
    userAgent
  })
}

/**
 * Logs entity creation
 */
export async function logEntityCreation(
  teamId: string,
  memberId: string,
  entityType: string,
  entityId: string,
  entityName: string
) {
  return logActivity({
    teamId,
    memberId,
    type: 'CREATE_ENTITY',
    action: `Created ${entityType}: ${entityName}`,
    entityType,
    entityId,
    entityName
  })
}

/**
 * Logs entity update
 */
export async function logEntityUpdate(
  teamId: string,
  memberId: string,
  entityType: string,
  entityId: string,
  entityName: string,
  changes?: Record<string, unknown>
) {
  return logActivity({
    teamId,
    memberId,
    type: 'EDIT_ENTITY',
    action: `Updated ${entityType}: ${entityName}`,
    entityType,
    entityId,
    entityName,
    metadata: changes ? { changes } : undefined
  })
}

/**
 * Logs entity deletion
 */
export async function logEntityDeletion(
  teamId: string,
  memberId: string,
  entityType: string,
  entityId: string,
  entityName: string
) {
  return logActivity({
    teamId,
    memberId,
    type: 'DELETE_ENTITY',
    action: `Deleted ${entityType}: ${entityName}`,
    entityType,
    entityId,
    entityName
  })
}

/**
 * Gets activity logs for a team with filters
 */
export async function getTeamActivities(
  teamId: string,
  filters?: {
    memberId?: string
    type?: TeamActivityType
    entityType?: string
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  }
) {
  const where: {
    teamId: string
    memberId?: string
    type?: TeamActivityType
    entityType?: string
    createdAt?: {
      gte?: Date
      lte?: Date
    }
  } = { teamId }
  
  if (filters?.memberId) where.memberId = filters.memberId
  if (filters?.type) where.type = filters.type
  if (filters?.entityType) where.entityType = filters.entityType
  
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {}
    if (filters.startDate) where.createdAt.gte = filters.startDate
    if (filters.endDate) where.createdAt.lte = filters.endDate
  }
  
  const [activities, total] = await Promise.all([
    prisma.teamActivity.findMany({
      where,
      include: {
        member: {
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
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0
    }),
    prisma.teamActivity.count({ where })
  ])
  
  return { activities, total }
}

/**
 * Gets engagement metrics for a team member
 */
export async function getMemberEngagementMetrics(
  teamId: string,
  memberId: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: {
    teamId: string
    memberId: string
    type?: TeamActivityType
    createdAt?: {
      gte?: Date
      lte?: Date
    }
  } = { teamId, memberId }
  
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = startDate
    if (endDate) where.createdAt.lte = endDate
  }
  
  const [
    totalActivities,
    messagesSent,
    tasksCompleted,
    pagesAccessed,
    totalTimeSpent
  ] = await Promise.all([
    prisma.teamActivity.count({ where }),
    prisma.teamActivity.count({ where: { ...where, type: 'SEND_MESSAGE' } }),
    prisma.teamActivity.count({ where: { ...where, type: 'COMPLETE_TASK' } }),
    prisma.teamActivity.count({ where: { ...where, type: 'VIEW_PAGE' } }),
    prisma.teamActivity.aggregate({
      where,
      _sum: { duration: true }
    })
  ])
  
  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { totalTimeSpent: true }
  })
  
  return {
    totalActivities,
    messagesSent,
    tasksCompleted,
    pagesAccessed,
    totalTimeSpent: member?.totalTimeSpent || 0,
    averageSessionDuration: totalTimeSpent._sum.duration || 0
  }
}

/**
 * Gets activity heatmap data
 */
export async function getActivityHeatmap(
  teamId: string,
  days: number = 30
) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  // Fetch all activities within the date range
  const activities = await prisma.teamActivity.findMany({
    where: {
      teamId,
      createdAt: { gte: startDate }
    },
    select: {
      createdAt: true
    }
  })
  
  // Group by day and hour
  const heatmap: Record<string, Record<number, number>> = {}
  
  activities.forEach(({ createdAt }) => {
    const date = new Date(createdAt)
    const day = date.toISOString().split('T')[0]
    const hour = date.getHours()
    
    if (!heatmap[day]) {
      heatmap[day] = {}
    }
    heatmap[day][hour] = (heatmap[day][hour] || 0) + 1
  })
  
  return heatmap
}

/**
 * Updates member's total time spent
 */
export async function updateMemberTimeSpent(
  memberId: string,
  additionalSeconds: number
) {
  return prisma.teamMember.update({
    where: { id: memberId },
    data: {
      totalTimeSpent: { increment: additionalSeconds },
      lastActiveAt: new Date()
    }
  })
}

