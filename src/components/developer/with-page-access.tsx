import { getPageAccessStatus } from '@/lib/developer/get-page-access';
import UnderDevelopmentPage from '@/app/(dashboard)/under-development/page';

/**
 * Higher-order component to protect pages with global access control
 * Usage: Wrap your page component with this
 */
export async function withPageAccess<T extends object>(
  pagePath: string,
  Component: React.ComponentType<T>
) {
  return async function ProtectedPage(props: T) {
    const isEnabled = await getPageAccessStatus(pagePath);

    if (isEnabled === false) {
      return <UnderDevelopmentPage searchParams={Promise.resolve({ page: pagePath })} />;
    }

    return <Component {...props} />;
  };
}

