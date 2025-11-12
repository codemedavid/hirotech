import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { logLogin } from '@/lib/teams/activity'

/**
 * POST /api/teams/switch
 * Switch active team context
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { teamId } = body

    if (!teamId) {
      // Switch back to personal account
      await prisma.user.update({
        where: { id: session.user.id },
        data: { activeTeamId: null }
      })

      return NextResponse.json({ 
        success: true, 
        activeTeamId: null,
        message: 'Switched to personal account'
      })
    }

    // Check if user is a member of the team
    const member = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId: session.user.id, teamId }
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'You are not a member of this team' },
        { status: 403 }
      )
    }

    if (member.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Your membership is not active' },
        { status: 403 }
      )
    }

    if (member.team.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'This team is not active' },
        { status: 403 }
      )
    }

    // Update user's active team
    await prisma.user.update({
      where: { id: session.user.id },
      data: { activeTeamId: teamId }
    })

    // Log team login
    await logLogin(teamId, member.id)

    return NextResponse.json({ 
      success: true, 
      activeTeamId: teamId,
      team: member.team,
      message: `Switched to team: ${member.team.name}`
    })
  } catch (error) {
    console.error('Error switching team:', error)
    return NextResponse.json(
      { error: 'Failed to switch team' },
      { status: 500 }
    )
  }
}

