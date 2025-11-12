import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { rotateJoinCodeIfExpired, generateUniqueJoinCode, getJoinCodeExpiration } from '@/lib/teams/join-codes'
import { isTeamAdmin } from '@/lib/teams/permissions'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/teams/[id]/join-code
 * Get current join code (auto-rotates if expired)
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if user is admin
    const admin = await isTeamAdmin(session.user.id, id)
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { code, expiresAt } = await rotateJoinCodeIfExpired(id)

    const timeUntilExpiry = Math.floor((expiresAt.getTime() - Date.now()) / 1000)

    return NextResponse.json({
      joinCode: code,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: timeUntilExpiry
    })
  } catch (error) {
    console.error('Error getting join code:', error)
    return NextResponse.json(
      { error: 'Failed to get join code' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/teams/[id]/join-code
 * Manually rotate join code
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if user is admin
    const admin = await isTeamAdmin(session.user.id, id)
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const newCode = await generateUniqueJoinCode()
    const newExpiration = getJoinCodeExpiration()

    const team = await prisma.team.update({
      where: { id },
      data: {
        joinCode: newCode,
        joinCodeExpiresAt: newExpiration
      }
    })

    const timeUntilExpiry = Math.floor((newExpiration.getTime() - Date.now()) / 1000)

    return NextResponse.json({
      joinCode: newCode,
      expiresAt: newExpiration.toISOString(),
      expiresInSeconds: timeUntilExpiry
    })
  } catch (error) {
    console.error('Error rotating join code:', error)
    return NextResponse.json(
      { error: 'Failed to rotate join code' },
      { status: 500 }
    )
  }
}

