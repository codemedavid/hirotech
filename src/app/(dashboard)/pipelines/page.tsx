import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, GitBranch } from 'lucide-react';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { PipelinesListClient } from '@/components/pipelines/pipelines-list-client';
import { redirect } from 'next/navigation';

async function getPipelines(organizationId: string) {
  return await prisma.pipeline.findMany({
    where: {
      organizationId,
      isArchived: false,
    },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      stages: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          name: true,
          _count: {
            select: { contacts: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export default async function PipelinesPage() {
  const session = await auth();
  
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const pipelines = await getPipelines(session.user.organizationId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pipelines</h1>
          <p className="text-muted-foreground mt-2">
            Manage your sales and support pipelines
          </p>
        </div>

        <Link href="/pipelines/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Pipeline
          </Button>
        </Link>
      </div>

      {pipelines.length === 0 ? (
        <EmptyState
          icon={<GitBranch className="h-12 w-12" />}
          title="No pipelines yet"
          description="Create a pipeline to track contacts through stages"
          action={{
            label: 'Create Pipeline',
            href: '/pipelines/new',
          }}
        />
      ) : (
        <PipelinesListClient initialPipelines={pipelines} />
      )}
    </div>
  );
}
