import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { startPipelineAnalysis } from '@/lib/facebook/pipeline-analyzer';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { facebookPageId } = body;

    if (!facebookPageId) {
      return NextResponse.json(
        { error: 'facebookPageId is required' },
        { status: 400 }
      );
    }

    // Verify the page belongs to the user's organization
    const page = await prisma.facebookPage.findFirst({
      where: {
        id: facebookPageId,
        organizationId: session.user.organizationId,
      },
      include: {
        autoPipeline: true,
      },
    });

    if (!page) {
      return NextResponse.json(
        { error: 'Facebook page not found or access denied' },
        { status: 404 }
      );
    }

    if (!page.autoPipelineId) {
      return NextResponse.json(
        { error: 'Auto-pipeline not configured for this page' },
        { status: 400 }
      );
    }

    // Start pipeline analysis
    const result = await startPipelineAnalysis(facebookPageId);

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to start pipeline analysis';
    console.error('Error starting pipeline analysis:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

