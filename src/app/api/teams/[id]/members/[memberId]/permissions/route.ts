import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { isTeamAdmin } from '@/lib/teams/permissions'
import { updateMemberPermissions, getMemberPermissions } from '@/lib/teams/permissions'
import { logActivity } from '@/lib/teams/activity'

interface RouteParams {
  params: Promise<{ id: string; memberId: string }>
}

/**
 * GET /api/teams/[id]/members/[memberId]/permissions
 * Get member permissions
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

    const { id, memberId } = await params

    // Check if user is admin or viewing own permissions
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      select: { userId: true }
    })

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const isOwnPermissions = member.userId === session.user.id
    const admin = await isTeamAdmin(session.user.id, id)

    if (!isOwnPermissions && !admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const permissions = await getMemberPermissions(member.userId, id)

    return NextResponse.json({ permissions })
  } catch (error) {
    console.error('Error fetching member permissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch member permissions' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/teams/[id]/members/[memberId]/permissions
 * Update member permissions
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, memberId } = await params

    // Check if user is admin
    const admin = await isTeamAdmin(session.user.id, id)
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { permissions, facebookPageId } = body

    if (!permissions || typeof permissions !== 'object') {
      return NextResponse.json(
        { error: 'Invalid permissions data' },
        { status: 400 }
      )
    }

    const updated = await updateMemberPermissions(
      memberId,
      permissions,
      facebookPageId
    )

    // Log activity
    const loggerMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId: session.user.id, teamId: id }
      }
    })

    if (loggerMember) {
      await logActivity({
        teamId: id,
        memberId: loggerMember.id,
        type: 'PERMISSION_CHANGED',
        action: 'Updated member permissions',
        metadata: { targetMemberId: memberId, permissions }
      })
    }

    return NextResponse.json({ permissions: updated })
  } catch (error) {
    console.error('Error updating member permissions:', error)
    return NextResponse.json(
      { error: 'Failed to update member permissions' },
      { status: 500 }
    )
  }
}

