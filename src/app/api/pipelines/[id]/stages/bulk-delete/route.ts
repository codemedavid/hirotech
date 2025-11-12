import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

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
      stageIds: string[];
    };

    const { stageIds } = body;

    if (!Array.isArray(stageIds) || stageIds.length === 0) {
      return NextResponse.json(
        { error: 'stageIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // Verify pipeline belongs to user's organization
    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id: id,
        organizationId: session.user.organizationId,
      },
    });

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    // Delete stages
    await prisma.pipelineStage.deleteMany({
      where: {
        id: { in: stageIds },
        pipelineId: id,
      },
    });

    return NextResponse.json({ 
      success: true,
      deletedCount: stageIds.length,
    });
  } catch (error: unknown) {
    console.error('Bulk delete stages error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete stages';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

