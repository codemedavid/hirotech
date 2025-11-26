import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/api-keys/readonly
 * List API keys in read-only mode (all authenticated users)
 * Returns only metadata, no encrypted keys
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // All authenticated users can view API keys (read-only)
    const keys = await prisma.apiKey.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Return keys without encrypted data (for security)
    const safeKeys = (keys as Array<{
      id: string;
      name: string | null;
      status: string;
      rateLimitedAt: Date | null;
      lastUsedAt: Date | null;
      lastSuccessAt: Date | null;
      totalRequests: number;
      failedRequests: number;
      consecutiveFailures: number;
      metadata: unknown;
      createdAt: Date;
      updatedAt: Date;
    }>).map(key => ({
      id: key.id,
      name: key.name,
      status: key.status,
      rateLimitedAt: key.rateLimitedAt ? key.rateLimitedAt.toISOString() : null,
      lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
      lastSuccessAt: key.lastSuccessAt ? key.lastSuccessAt.toISOString() : null,
      totalRequests: key.totalRequests,
      failedRequests: key.failedRequests,
      consecutiveFailures: key.consecutiveFailures,
      metadata: key.metadata,
      createdAt: key.createdAt.toISOString(),
      updatedAt: key.updatedAt.toISOString(),
    }));

    return NextResponse.json(safeKeys);
  } catch (error) {
    console.error('Get API keys (readonly) error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

