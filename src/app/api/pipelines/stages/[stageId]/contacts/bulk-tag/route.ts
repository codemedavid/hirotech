import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ stageId: string }> }
) {
  try {
    const { stageId } = await props.params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      contactIds: string[];
      tagName: string;
    };

    const { contactIds, tagName } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'contactIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!tagName || !tagName.trim()) {
      return NextResponse.json(
        { error: 'tagName is required' },
        { status: 400 }
      );
    }

    // Verify stage belongs to user's organization
    const stage = await prisma.pipelineStage.findFirst({
      where: {
        id: stageId,
        pipeline: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
    }

    // Add tag to contacts
    let updatedCount = 0;
    await prisma.$transaction(async (tx) => {
      // Get contacts in this stage
      const contacts = await tx.contact.findMany({
        where: {
          id: { in: contactIds },
          stageId: stageId,
        },
      });

      // Only add tag to contacts that don't have it yet
      for (const contact of contacts) {
        if (!contact.tags.includes(tagName)) {
          await tx.contact.update({
            where: { id: contact.id },
            data: {
              tags: {
                push: tagName,
              },
            },
          });

          // Create activity record
          await tx.contactActivity.create({
            data: {
              contactId: contact.id,
              type: 'TAG_ADDED',
              title: `Tag "${tagName}" added`,
              userId: session.user.id,
            },
          });

          updatedCount++;
        }
      }

      // Update tag contact count if the tag exists
      await tx.tag.updateMany({
        where: {
          name: tagName,
          organizationId: session.user.organizationId,
        },
        data: {
          contactCount: {
            increment: updatedCount,
          },
        },
      });
    });

    return NextResponse.json({ 
      success: true,
      taggedCount: contactIds.length,
    });
  } catch (error: unknown) {
    console.error('Bulk tag contacts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to tag contacts';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

