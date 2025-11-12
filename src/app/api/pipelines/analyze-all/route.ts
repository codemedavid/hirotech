import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { autoGenerateAllPipelineRanges } from '@/lib/pipelines/stage-analyzer';

/**
 * POST /api/pipelines/analyze-all
 * Auto-generate intelligent lead score ranges for ALL pipelines in the organization
 * This is useful for initial setup or when restructuring pipelines
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Analyze All Pipelines] Starting for organization: ${session.user.organizationId}`);

    // Auto-generate score ranges for all pipelines
    const updatedCount = await autoGenerateAllPipelineRanges(session.user.organizationId);

    return NextResponse.json({
      success: true,
      message: `Successfully generated score ranges for ${updatedCount} pipelines`,
      updatedCount
    });

  } catch (error) {
    console.error('[Analyze All Pipelines] Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze pipelines' },
      { status: 500 }
    );
  }
}

