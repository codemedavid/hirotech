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
    };

    const { contactIds } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'contactIds must be a non-empty array' },
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

    // Remove contacts from stage (set stageId to null)
    await prisma.contact.updateMany({
      where: {
        id: { in: contactIds },
        stageId: stageId,
      },
      data: {
        stageId: null,
        pipelineId: null,
      },
    });

    return NextResponse.json({ 
      success: true,
      removedCount: contactIds.length,
    });
  } catch (error: unknown) {
    console.error('Bulk remove contacts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to remove contacts';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

