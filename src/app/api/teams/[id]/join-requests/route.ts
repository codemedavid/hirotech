import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { isTeamAdmin } from '@/lib/teams/permissions'
import { createDefaultPermissions } from '@/lib/teams/permissions'
import { logActivity } from '@/lib/teams/activity'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/teams/[id]/join-requests
 * Get pending join requests (admin only)
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

    const requests = await prisma.teamJoinRequest.findMany({
      where: {
        invite: { teamId: id },
        status: 'PENDING'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true
          }
        },
        invite: {
          select: {
            code: true,
            type: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Error fetching join requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch join requests' },
      { status: 500 }
    )
  }
}

