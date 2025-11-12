import crypto from 'crypto'
import { prisma } from '@/lib/db'

/**
 * Generates a secure random join code
 * Format: 6 alphanumeric characters (e.g., ABC123)
 */
export function generateJoinCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  
  const randomBytes = crypto.randomBytes(6)
  for (let i = 0; i < 6; i++) {
    code += characters[randomBytes[i] % characters.length]
  }
  
  return code
}

/**
 * Generates a unique join code that doesn't exist in the database
 */
export async function generateUniqueJoinCode(): Promise<string> {
  let code = generateJoinCode()
  let attempts = 0
  const maxAttempts = 10
  
  while (attempts < maxAttempts) {
    const existing = await prisma.team.findUnique({
      where: { joinCode: code }
    })
    
    if (!existing) {
      return code
    }
    
    code = generateJoinCode()
    attempts++
  }
  
  throw new Error('Failed to generate unique join code')
}

/**
 * Gets the expiration time for a join code (10 minutes from now)
 */
export function getJoinCodeExpiration(): Date {
  return new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
}

/**
 * Checks if a join code is expired
 */
export function isJoinCodeExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt
}

/**
 * Rotates the join code for a team if it's expired
 */
export async function rotateJoinCodeIfExpired(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { joinCodeExpiresAt: true, joinCode: true }
  })
  
  if (!team) {
    throw new Error('Team not found')
  }
  
  if (isJoinCodeExpired(team.joinCodeExpiresAt)) {
    const newCode = await generateUniqueJoinCode()
    const newExpiration = getJoinCodeExpiration()
    
    await prisma.team.update({
      where: { id: teamId },
      data: {
        joinCode: newCode,
        joinCodeExpiresAt: newExpiration
      }
    })
    
    return { code: newCode, expiresAt: newExpiration }
  }
  
  return { code: team.joinCode, expiresAt: team.joinCodeExpiresAt }
}

/**
 * Rotates all expired join codes
 * Should be run as a background job
 */
export async function rotateAllExpiredJoinCodes() {
  const now = new Date()
  
  const expiredTeams = await prisma.team.findMany({
    where: {
      joinCodeExpiresAt: { lt: now },
      status: 'ACTIVE'
    },
    select: { id: true }
  })
  
  const results = await Promise.allSettled(
    expiredTeams.map(async (team) => {
      const newCode = await generateUniqueJoinCode()
      const newExpiration = getJoinCodeExpiration()
      
      return prisma.team.update({
        where: { id: team.id },
        data: {
          joinCode: newCode,
          joinCodeExpiresAt: newExpiration
        }
      })
    })
  )
  
  return {
    total: expiredTeams.length,
    successful: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length
  }
}

/**
 * Generates a temporary invite link
 */
export async function generateInviteLink(
  teamId: string,
  userId: string,
  expiresInHours: number = 24,
  maxUses: number = 1
): Promise<string> {
  const code = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
  
  await prisma.teamInvite.create({
    data: {
      teamId,
      code,
      type: 'LINK',
      inviteLink: code,
      expiresAt,
      maxUses,
      createdById: userId,
      status: 'ACTIVE'
    }
  })
  
  return code
}

/**
 * Validates a join code
 */
export async function validateJoinCode(code: string) {
  const team = await prisma.team.findUnique({
    where: { joinCode: code },
    include: {
      organization: true,
      owner: { select: { id: true, name: true, email: true } }
    }
  })
  
  if (!team) {
    return { valid: false, error: 'Invalid join code' }
  }
  
  if (team.status !== 'ACTIVE') {
    return { valid: false, error: 'Team is not active' }
  }
  
  if (isJoinCodeExpired(team.joinCodeExpiresAt)) {
    // Auto-rotate the code
    await rotateJoinCodeIfExpired(team.id)
    return { valid: false, error: 'Join code has expired. Please request a new code.' }
  }
  
  return { valid: true, team }
}

/**
 * Validates an invite link
 */
export async function validateInviteLink(linkCode: string) {
  const invite = await prisma.teamInvite.findUnique({
    where: { inviteLink: linkCode },
    include: {
      team: {
        include: {
          organization: true
        }
      }
    }
  })
  
  if (!invite) {
    return { valid: false, error: 'Invalid invite link' }
  }
  
  if (invite.status !== 'ACTIVE') {
    return { valid: false, error: 'Invite link is no longer active' }
  }
  
  if (invite.expiresAt && new Date() > invite.expiresAt) {
    // Mark as expired
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: 'EXPIRED' }
    })
    return { valid: false, error: 'Invite link has expired' }
  }
  
  if (invite.maxUses && invite.usedCount >= invite.maxUses) {
    // Mark as exhausted
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: 'EXHAUSTED' }
    })
    return { valid: false, error: 'Invite link has been used up' }
  }
  
  return { valid: true, invite, team: invite.team }
}

