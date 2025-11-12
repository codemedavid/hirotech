import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { StageType } from '@prisma/client';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      name: string;
      description?: string;
      color?: string;
      type?: StageType;
    };

    // Verify pipeline belongs to user's organization
    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id: id,
        organizationId: session.user.organizationId,
      },
      include: {
        stages: {
          orderBy: { order: 'desc' },
          take: 1,
        },
      },
    });

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    // Get the next order number
    const nextOrder = pipeline.stages.length > 0 ? pipeline.stages[0].order + 1 : 0;

    const stage = await prisma.pipelineStage.create({
      data: {
        name: body.name,
        description: body.description,
        color: body.color || '#64748b',
        type: body.type || 'IN_PROGRESS',
        order: nextOrder,
        pipelineId: id,
      },
      include: {
        _count: {
          select: { contacts: true },
        },
      },
    });

    return NextResponse.json(stage);
  } catch (error: unknown) {
    console.error('Create stage error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create stage';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

