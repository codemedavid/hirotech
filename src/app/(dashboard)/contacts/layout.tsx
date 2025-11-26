import { getPageAccessStatus } from '@/lib/developer/get-page-access';
import UnderDevelopmentPage from '../under-development/page';

export default async function ContactsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pageAccess = await getPageAccessStatus('/contacts');
  
  if (pageAccess === false) {
    return <UnderDevelopmentPage searchParams={Promise.resolve({ page: '/contacts' })} />;
  }

  return <>{children}</>;
}

