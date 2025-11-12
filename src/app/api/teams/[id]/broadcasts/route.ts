import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { isTeamAdmin } from '@/lib/teams/permissions'
import { logActivity } from '@/lib/teams/activity'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/teams/[id]/broadcasts
 * Get team broadcasts
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

    // Check if user is a member
    const member = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId: session.user.id, teamId: id }
      }
    })

    if (!member || member.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const broadcasts = await prisma.teamBroadcast.findMany({
      where: {
        teamId: id,
        sentAt: { not: null }
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      },
      orderBy: [
        { isPinned: 'desc' },
        { sentAt: 'desc' }
      ]
    })

    return NextResponse.json({ broadcasts })
  } catch (error) {
    console.error('Error fetching team broadcasts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team broadcasts' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/teams/[id]/broadcasts
 * Create and send a broadcast (admin only)
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

    const body = await request.json()
    const { title, content, priority, targetRole, isPinned, pinnedUntil, scheduledFor, attachments } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    const broadcast = await prisma.teamBroadcast.create({
      data: {
        teamId: id,
        senderId: session.user.id,
        title: title.trim(),
        content: content.trim(),
        priority: priority || 'NORMAL',
        targetRole: targetRole || null,
        isPinned: isPinned || false,
        pinnedUntil: pinnedUntil ? new Date(pinnedUntil) : null,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        sentAt: scheduledFor ? null : new Date(),
        attachments: attachments || null
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    })

    // Get member for logging
    const member = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId: session.user.id, teamId: id }
      }
    })

    if (member) {
      await logActivity({
        teamId: id,
        memberId: member.id,
        type: 'CREATE_ENTITY',
        action: `Sent broadcast: ${title}`,
        entityType: 'broadcast',
        entityId: broadcast.id,
        entityName: title
      })
    }

    // TODO: Send notifications to all team members

    return NextResponse.json({ broadcast }, { status: 201 })
  } catch (error) {
    console.error('Error creating team broadcast:', error)
    return NextResponse.json(
      { error: 'Failed to create team broadcast' },
      { status: 500 }
    )
  }
}

