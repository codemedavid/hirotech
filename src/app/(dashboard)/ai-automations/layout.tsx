import { getPageAccessStatus } from '@/lib/developer/get-page-access';
import UnderDevelopmentPage from '../under-development/page';

export default async function AIAutomationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pageAccess = await getPageAccessStatus('/ai-automations');
  
  if (pageAccess === false) {
    return <UnderDevelopmentPage searchParams={Promise.resolve({ page: '/ai-automations' })} />;
  }

  return <>{children}</>;
}

