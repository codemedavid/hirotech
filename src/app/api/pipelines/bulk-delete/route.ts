import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      pipelineIds: string[];
    };

    const { pipelineIds } = body;

    if (!Array.isArray(pipelineIds) || pipelineIds.length === 0) {
      return NextResponse.json(
        { error: 'pipelineIds must be a non-empty array' },
        { status: 400 }
      );
    }

    await prisma.pipeline.deleteMany({
      where: {
        id: { in: pipelineIds },
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({ 
      success: true,
      deletedCount: pipelineIds.length,
    });
  } catch (error: unknown) {
    console.error('Bulk delete pipelines error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete pipelines';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

