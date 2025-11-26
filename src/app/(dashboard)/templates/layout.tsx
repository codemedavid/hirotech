import { getPageAccessStatus } from '@/lib/developer/get-page-access';
import UnderDevelopmentPage from '../under-development/page';

export default async function TemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pageAccess = await getPageAccessStatus('/templates');
  
  if (pageAccess === false) {
    return <UnderDevelopmentPage searchParams={Promise.resolve({ page: '/templates' })} />;
  }

  return <>{children}</>;
}

