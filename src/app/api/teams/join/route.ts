import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { validateJoinCode } from '@/lib/teams/join-codes'

/**
 * POST /api/teams/join
 * Join a team using a join code
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { joinCode, message } = body

    if (!joinCode) {
      return NextResponse.json(
        { error: 'Join code is required' },
        { status: 400 }
      )
    }

    // Validate join code
    const validation = await validateJoinCode(joinCode.toUpperCase())
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    const team = validation.team!

    // Check if user is already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId: session.user.id, teamId: team.id }
      }
    })

    if (existingMember) {
      if (existingMember.status === 'ACTIVE') {
        return NextResponse.json(
          { error: 'You are already a member of this team' },
          { status: 400 }
        )
      }
      
      if (existingMember.status === 'PENDING') {
        return NextResponse.json(
          { error: 'Your join request is pending approval' },
          { status: 400 }
        )
      }
      
      if (existingMember.status === 'SUSPENDED') {
        return NextResponse.json(
          { error: 'You have been suspended from this team' },
          { status: 403 }
        )
      }
    }

    // Create or find invite record
    let invite = await prisma.teamInvite.findFirst({
      where: {
        teamId: team.id,
        code: joinCode.toUpperCase(),
        status: 'ACTIVE'
      }
    })

    if (!invite) {
      // Create a new invite record for tracking
      invite = await prisma.teamInvite.create({
        data: {
          teamId: team.id,
          code: joinCode.toUpperCase(),
          type: 'CODE',
          status: 'ACTIVE',
          createdById: team.ownerId
        }
      })
    }

    // Create join request (pending approval)
    const joinRequest = await prisma.teamJoinRequest.create({
      data: {
        userId: session.user.id,
        inviteId: invite.id,
        status: 'PENDING',
        message: message?.trim()
      }
    })

    // Create team member with PENDING status
    const member = await prisma.teamMember.create({
      data: {
        userId: session.user.id,
        teamId: team.id,
        role: 'MEMBER',
        status: 'PENDING',
        displayName: session.user.name || undefined
      }
    })

    return NextResponse.json({
      success: true,
      status: 'PENDING',
      message: 'Your join request has been sent to the team admin for approval',
      team: {
        id: team.id,
        name: team.name,
        description: team.description
      }
    })
  } catch (error) {
    console.error('Error joining team:', error)
    return NextResponse.json(
      { error: 'Failed to join team' },
      { status: 500 }
    )
  }
}

