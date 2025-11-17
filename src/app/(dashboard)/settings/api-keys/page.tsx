import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { ApiKeysClient } from '@/components/settings/api-keys-client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Keys Management',
  description: 'Manage API keys for AI services',
};

// SSR helper to fetch API keys for initial render
async function getInitialKeys() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keys = await (prisma as any).apiKey.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });

  const typedKeys = keys as Array<{
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
  }>;

  return typedKeys.map(key => ({
    id: key.id,
    name: key.name,
    status: key.status as 'ACTIVE' | 'RATE_LIMITED' | 'DISABLED',
    rateLimitedAt: key.rateLimitedAt ? key.rateLimitedAt.toISOString() : null,
    lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
    lastSuccessAt: key.lastSuccessAt ? key.lastSuccessAt.toISOString() : null,
    totalRequests: key.totalRequests,
    failedRequests: key.failedRequests,
    consecutiveFailures: key.consecutiveFailures,
    metadata: key.metadata,
    createdAt: key.createdAt.toISOString(),
    updatedAt: key.updatedAt.toISOString(),
    successRate: key.totalRequests > 0
      ? ((key.totalRequests - key.failedRequests) / key.totalRequests * 100).toFixed(1)
      : '0',
    timeUntilActive: key.rateLimitedAt && key.status === 'RATE_LIMITED'
      ? Math.max(
          0,
          24 * 60 * 60 * 1000 - (Date.now() - key.rateLimitedAt.getTime())
        )
      : null,
  }));
}

export default async function ApiKeysPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/login');
  }

  // Check admin role
  if (session.user.role !== 'ADMIN') {
    redirect('/settings');
  }

  const initialKeys = await getInitialKeys();

  return <ApiKeysClient initialKeys={initialKeys} />;
}

