import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/teams/[id]/members/autocomplete
 * Get team members for mention autocomplete
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

    const { id: teamId } = await params
    const { searchParams } = new URL(request.url)
    
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '10')
    const excludeIds = searchParams.get('excludeIds')?.split(',') || []

    // Check if user is a member
    const member = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId: session.user.id, teamId }
      }
    })

    if (!member || member.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build where clause with proper Prisma types
    const where: Prisma.TeamMemberWhereInput = {
      teamId,
      status: 'ACTIVE',
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
      ...(query.trim() ? {
        OR: [
          {
            user: {
              name: {
                contains: query,
                mode: 'insensitive'
              }
            }
          },
          {
            user: {
              email: {
                contains: query,
                mode: 'insensitive'
              }
            }
          }
        ]
      } : {})
    }

    // Fetch members
    const members = await prisma.teamMember.findMany({
      where,
      select: {
        id: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        role: true
      },
      orderBy: [
        { role: 'asc' }, // Owners/Admins first
        { user: { name: 'asc' } }
      ],
      take: limit
    })

    // Format response
    const suggestions = members.map(m => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name || m.user.email,
      email: m.user.email,
      image: m.user.image,
      role: m.role
    }))

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Error fetching member autocomplete:', error)
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    )
  }
}
