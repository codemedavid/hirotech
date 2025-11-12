/**
 * Team Management Cron Jobs
 * 
 * These functions should be scheduled to run periodically:
 * - rotateExpiredJoinCodes: Every 10 minutes
 * - cleanupExpiredInvites: Daily
 * - sendTaskReminders: Hourly
 */

import { prisma } from '@/lib/db'
import { rotateAllExpiredJoinCodes } from './join-codes'

/**
 * Rotates all expired join codes
 * Should run every 10 minutes
 */
export async function rotateExpiredJoinCodesJob() {
  console.log('[CRON] Starting join code rotation job...')
  
  try {
    const result = await rotateAllExpiredJoinCodes()
    console.log('[CRON] Join code rotation complete:', result)
    return result
  } catch (error) {
    console.error('[CRON] Error rotating join codes:', error)
    throw error
  }
}

/**
 * Cleans up expired and exhausted invites
 * Should run daily
 */
export async function cleanupExpiredInvitesJob() {
  console.log('[CRON] Starting invite cleanup job...')
  
  try {
    const now = new Date()
    
    // Mark expired invites
    const expiredResult = await prisma.teamInvite.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: now }
      },
      data: { status: 'EXPIRED' }
    })
    
    // Mark exhausted invites
    const exhaustedResult = await prisma.teamInvite.updateMany({
      where: {
        status: 'ACTIVE',
        maxUses: { not: null },
        usedCount: { gte: prisma.teamInvite.fields.maxUses }
      },
      data: { status: 'EXHAUSTED' }
    })
    
    console.log('[CRON] Invite cleanup complete:', {
      expired: expiredResult.count,
      exhausted: exhaustedResult.count
    })
    
    return {
      expired: expiredResult.count,
      exhausted: exhaustedResult.count
    }
  } catch (error) {
    console.error('[CRON] Error cleaning up invites:', error)
    throw error
  }
}

/**
 * Sends reminders for overdue tasks
 * Should run hourly
 */
export async function sendTaskRemindersJob() {
  console.log('[CRON] Starting task reminders job...')
  
  try {
    const now = new Date()
    
    // Find overdue tasks that haven't been completed
    const overdueTasks = await prisma.teamTask.findMany({
      where: {
        status: { in: ['TODO', 'IN_PROGRESS'] },
        dueDate: { lt: now },
        // Add a metadata field to track if reminder was sent today
      },
      include: {
        assignedTo: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        },
        team: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
    
    // TODO: Send notifications to assigned users
    // This would integrate with your notification system
    
    console.log('[CRON] Task reminders sent:', overdueTasks.length)
    return { remindersSent: overdueTasks.length }
  } catch (error) {
    console.error('[CRON] Error sending task reminders:', error)
    throw error
  }
}

/**
 * Checks for suspended members whose suspension has expired
 * Should run hourly
 */
export async function unsuspendExpiredSuspensionsJob() {
  console.log('[CRON] Starting unsuspend job...')
  
  try {
    const now = new Date()
    
    const result = await prisma.teamMember.updateMany({
      where: {
        status: 'SUSPENDED',
        suspendedUntil: { lt: now }
      },
      data: {
        status: 'ACTIVE',
        suspendedAt: null,
        suspendedUntil: null,
        suspendedReason: null
      }
    })
    
    console.log('[CRON] Unsuspend job complete:', result.count)
    return { unsuspended: result.count }
  } catch (error) {
    console.error('[CRON] Error unsuspending members:', error)
    throw error
  }
}

/**
 * Main cron job scheduler
 * Call this from your cron setup (e.g., Vercel Cron, node-cron, etc.)
 */
export async function runScheduledJobs(jobType: 'every-10-min' | 'hourly' | 'daily') {
  console.log(`[CRON] Running ${jobType} jobs...`)
  
  try {
    switch (jobType) {
      case 'every-10-min':
        await rotateExpiredJoinCodesJob()
        break
      
      case 'hourly':
        await Promise.allSettled([
          sendTaskRemindersJob(),
          unsuspendExpiredSuspensionsJob()
        ])
        break
      
      case 'daily':
        await cleanupExpiredInvitesJob()
        break
    }
    
    console.log(`[CRON] ${jobType} jobs completed successfully`)
  } catch (error) {
    console.error(`[CRON] Error running ${jobType} jobs:`, error)
  }
}

