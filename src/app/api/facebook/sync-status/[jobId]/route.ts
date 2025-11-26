import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { validateSession } from '@/lib/api/validate-session';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await auth();
    const validation = validateSession(session);
    if ('error' in validation) {
      return validation.error;
    }
    const { session: validatedSession } = validation;

    const params = await props.params;
    const { jobId } = params;

    // Optimize: Combine both queries into one with a join to avoid sequential database calls
    const job = await prisma.syncJob.findUnique({
      where: { id: jobId },
      include: {
        facebookPage: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Sync job not found' },
        { status: 404 }
      );
    }

    if (!job.facebookPage) {
      return NextResponse.json(
        { error: 'Facebook page not found for this sync job' },
        { status: 404 }
      );
    }

    // Verify the job belongs to a page in the user's organization
    if (job.facebookPage.organizationId !== validatedSession.user.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized access to sync job' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      syncedContacts: job.syncedContacts,
      failedContacts: job.failedContacts,
      totalContacts: job.totalContacts,
      tokenExpired: job.tokenExpired,
      errors: job.errors,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch sync status';
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

