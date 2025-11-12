import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { FacebookPageSettingsForm } from '@/components/settings/facebook-page-settings-form';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Facebook Page Settings',
  description: 'Configure automatic pipeline assignment for contacts',
};

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

async function getPageData(pageId: string, organizationId: string) {
  // Fetch pipelines for the organization
  const pipelines = await prisma.pipeline.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Fetch page settings
  const page = await prisma.facebookPage.findFirst({
    where: {
      id: pageId,
      organizationId,
    },
  });

  return {
    pipelines,
    pageSettings: {
      autoPipelineId: page ? (page as unknown as { autoPipelineId: string | null }).autoPipelineId : null,
      autoPipelineMode: page ? (page as unknown as { autoPipelineMode: string }).autoPipelineMode : 'SKIP_EXISTING',
    },
  };
}

export default async function FacebookPageSettingsPage({ params }: PageProps) {
  const session = await auth();
  
  if (!session?.user?.id || !session.user.organizationId) {
    redirect('/login');
  }

  const { id } = await params;
  const { pipelines, pageSettings } = await getPageData(id, session.user.organizationId);

  return (
    <FacebookPageSettingsForm
      pageId={id}
      pipelines={pipelines}
      initialSettings={pageSettings}
    />
  );
}
