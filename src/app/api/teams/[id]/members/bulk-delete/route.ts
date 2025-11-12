import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { isTeamAdmin } from '@/lib/teams/permissions'
import { logActivity } from '@/lib/teams/activity'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * DELETE /api/teams/[id]/members/bulk-delete
 * Bulk remove team members
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: teamId } = await params

    // Check if user is admin
    const isAdmin = await isTeamAdmin(session.user.id, teamId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { memberIds } = body

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json(
        { error: 'Member IDs array is required' },
        { status: 400 }
      )
    }

    if (memberIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 members per bulk operation' },
        { status: 400 }
      )
    }

    // Get current member for logging
    const currentMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId: session.user.id, teamId }
      }
    })

    if (!currentMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Verify all members belong to this team and get their info
    const members = await prisma.teamMember.findMany({
      where: {
        id: { in: memberIds },
        teamId
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (members.length !== memberIds.length) {
      return NextResponse.json(
        { error: 'Some members not found or do not belong to this team' },
        { status: 400 }
      )
    }

    // Prevent removing owners
    const ownerMembers = members.filter(m => m.role === 'OWNER')
    if (ownerMembers.length > 0) {
      return NextResponse.json(
        { error: 'Cannot remove team owners' },
        { status: 403 }
      )
    }

    // Prevent removing self
    if (memberIds.includes(currentMember.id)) {
      return NextResponse.json(
        { error: 'Cannot remove yourself' },
        { status: 400 }
      )
    }

    // Delete members
    const result = await prisma.teamMember.deleteMany({
      where: {
        id: { in: memberIds },
        teamId
      }
    })

    // Log activity
    await logActivity({
      teamId,
      memberId: currentMember.id,
      type: 'DELETE_ENTITY',
      action: `Removed ${result.count} members from team`,
      metadata: {
        memberIds,
        removedMembers: members.map(m => ({
          id: m.id,
          name: m.user.name,
          email: m.user.email
        }))
      }
    })

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `Successfully removed ${result.count} members`
    })
  } catch (error) {
    console.error('Error in bulk member delete:', error)
    return NextResponse.json(
      { error: 'Failed to remove members' },
      { status: 500 }
    )
  }
}

