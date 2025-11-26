import { getPageAccessStatus } from '@/lib/developer/get-page-access';
import UnderDevelopmentPage from '../under-development/page';
import { redirect } from 'next/navigation';

export default async function CampaignsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pageAccess = await getPageAccessStatus('/campaigns');
  
  if (pageAccess === false) {
    return <UnderDevelopmentPage searchParams={Promise.resolve({ page: '/campaigns' })} />;
  }

  return <>{children}</>;
}

