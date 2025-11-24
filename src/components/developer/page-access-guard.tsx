import { redirect } from 'next/navigation';
import { getPageAccessStatus } from '@/lib/developer/get-page-access';
import UnderDevelopmentPage from '@/app/(dashboard)/under-development/page';

interface PageAccessGuardProps {
  pagePath: string;
  children: React.ReactNode;
}

/**
 * Server Component that checks if a page is enabled globally
 * If disabled, shows "under development" message
 */
export async function PageAccessGuard({ pagePath, children }: PageAccessGuardProps) {
  const isEnabled = await getPageAccessStatus(pagePath);

  // If page is disabled, show under development page
  if (isEnabled === false) {
    return <UnderDevelopmentPage searchParams={Promise.resolve({ page: pagePath })} />;
  }

  // Page is enabled, render normally
  return <>{children}</>;
}

