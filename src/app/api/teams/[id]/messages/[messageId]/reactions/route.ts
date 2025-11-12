import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string; messageId: string }>
}

/**
 * POST /api/teams/[id]/messages/[messageId]/reactions
 * Add or remove a reaction to/from a message
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

    const { id, messageId } = await params

    // Check if user is a member
    const member = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId: session.user.id, teamId: id }
      }
    })

    if (!member || member.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const message = await prisma.teamMessage.findUnique({
      where: { id: messageId }
    })

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    const body = await request.json()
    const { emoji } = body

    if (!emoji) {
      return NextResponse.json(
        { error: 'Emoji is required' },
        { status: 400 }
      )
    }

    // Get current reactions
    const reactions = (message.reactions as Record<string, string[]>) || {}

    // Toggle reaction
    if (reactions[emoji]) {
      if (reactions[emoji].includes(member.id)) {
        // Remove reaction
        reactions[emoji] = reactions[emoji].filter(id => id !== member.id)
        if (reactions[emoji].length === 0) {
          delete reactions[emoji]
        }
      } else {
        // Add reaction
        reactions[emoji].push(member.id)
      }
    } else {
      // Add new reaction
      reactions[emoji] = [member.id]
    }

    const updatedMessage = await prisma.teamMessage.update({
      where: { id: messageId },
      data: { reactions },
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
    })

    return NextResponse.json({ message: updatedMessage })
  } catch (error) {
    console.error('Error adding reaction:', error)
    return NextResponse.json(
      { error: 'Failed to add reaction' },
      { status: 500 }
    )
  }
}

