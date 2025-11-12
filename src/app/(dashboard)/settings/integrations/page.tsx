import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { IntegrationsClient } from '@/components/settings/integrations-client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Integrations',
  description: 'Connect your Facebook pages for Messenger bulk messaging',
};

async function getTotalContacts(organizationId: string) {
  try {
    const count = await prisma.contact.count({
      where: {
        facebookPage: {
          organizationId,
        },
      },
    });
    return count;
  } catch (error) {
    console.error('Error fetching total contacts:', error);
    return 0;
  }
}

export default async function IntegrationsPage() {
  const session = await auth();
  
  if (!session?.user?.id || !session.user.organizationId) {
    redirect('/login');
  }

  const totalContacts = await getTotalContacts(session.user.organizationId);

  return <IntegrationsClient initialTotalContacts={totalContacts} />;
}
