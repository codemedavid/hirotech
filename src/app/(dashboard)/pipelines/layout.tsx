import { getPageAccessStatus } from '@/lib/developer/get-page-access';
import UnderDevelopmentPage from '../under-development/page';

export default async function PipelinesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pageAccess = await getPageAccessStatus('/pipelines');
  
  if (pageAccess === false) {
    return <UnderDevelopmentPage searchParams={Promise.resolve({ page: '/pipelines' })} />;
  }

  return <>{children}</>;
}

