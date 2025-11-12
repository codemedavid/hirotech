import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { validateContactIds } from '@/lib/pipelines/validation';

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
      targetStageId: string;
    };

    const { contactIds, targetStageId } = body;

    // Validate contact IDs
    const validation = validateContactIds(contactIds);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 }
      );
    }

    if (!targetStageId || typeof targetStageId !== 'string') {
      return NextResponse.json(
        { error: 'targetStageId is required and must be a string' },
        { status: 400 }
      );
    }

    // Verify both stages belong to user's organization
    const [sourceStage, targetStage] = await Promise.all([
      prisma.pipelineStage.findFirst({
        where: {
          id: stageId,
          pipeline: {
            organizationId: session.user.organizationId,
          },
        },
        include: {
          pipeline: true,
        },
      }),
      prisma.pipelineStage.findFirst({
        where: {
          id: targetStageId,
          pipeline: {
            organizationId: session.user.organizationId,
          },
        },
        include: {
          pipeline: true,
        },
      }),
    ]);

    if (!sourceStage || !targetStage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
    }

    // Move contacts to target stage
    await prisma.$transaction(async (tx) => {
      await tx.contact.updateMany({
        where: {
          id: { in: contactIds },
          stageId: stageId,
        },
        data: {
          stageId: targetStageId,
          pipelineId: targetStage.pipelineId,
          stageEnteredAt: new Date(),
        },
      });

      // Create activity records for each contact
      const activities = contactIds.map((contactId) => ({
        contactId,
        type: 'STAGE_CHANGED' as const,
        title: `Moved from ${sourceStage.name} to ${targetStage.name}`,
        fromStageId: stageId,
        toStageId: targetStageId,
        userId: session.user.id,
      }));

      await tx.contactActivity.createMany({
        data: activities,
      });
    });

    return NextResponse.json({ 
      success: true,
      movedCount: contactIds.length,
    });
  } catch (error: unknown) {
    console.error('Bulk move contacts error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to move contacts';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

