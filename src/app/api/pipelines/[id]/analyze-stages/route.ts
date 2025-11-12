import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { applyStageScoreRanges, getStageScoreDistribution } from '@/lib/pipelines/stage-analyzer';

/**
 * POST /api/pipelines/[id]/analyze-stages
 * Auto-generate intelligent lead score ranges for all stages in a pipeline
 */
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

    // Verify pipeline exists and belongs to user's organization
    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId
      },
      include: {
        stages: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    if (pipeline.stages.length === 0) {
      return NextResponse.json(
        { error: 'Pipeline has no stages to analyze' },
        { status: 400 }
      );
    }

    // Apply intelligent score ranges based on stage types and order
    await applyStageScoreRanges(id);

    // Get updated distribution
    const distribution = await getStageScoreDistribution(id);

    return NextResponse.json({
      success: true,
      message: 'Score ranges generated successfully',
      distribution
    });

  } catch (error) {
    console.error('[Analyze Stages] Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze stages' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pipelines/[id]/analyze-stages
 * Get current stage score distribution
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify pipeline exists and belongs to user's organization
    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId
      }
    });

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    const distribution = await getStageScoreDistribution(id);

    return NextResponse.json({ distribution });

  } catch (error) {
    console.error('[Get Stage Distribution] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get stage distribution' },
      { status: 500 }
    );
  }
}

