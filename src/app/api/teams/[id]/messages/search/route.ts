import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/teams/[id]/messages/search
 * Search team messages
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
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const threadId = searchParams.get('threadId')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    // Check if user is a member
    const member = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId: session.user.id, teamId: id }
      }
    })

    if (!member || member.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const where: {
      teamId: string
      isDeleted: boolean
      content: { contains: string; mode: 'insensitive' }
      threadId?: string
    } = {
      teamId: id,
      isDeleted: false,
      content: { contains: query, mode: 'insensitive' }
    }

    if (threadId) where.threadId = threadId

    const messages = await prisma.teamMessage.findMany({
      where,
      include: {
        sender: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        },
        thread: {
          select: {
            id: true,
            title: true,
            type: true
          }
        },
        replyTo: {
          include: {
            sender: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    image: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json({ messages, query })
  } catch (error) {
    console.error('Error searching team messages:', error)
    return NextResponse.json(
      { error: 'Failed to search team messages' },
      { status: 500 }
    )
  }
}

