'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Client component to check page access and redirect if disabled
 * This runs on the client side to get the current pathname
 */
export function PageAccessCheck() {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      // Skip check for certain pages
      if (
        pathname.startsWith('/settings/developer') ||
        pathname === '/under-development' ||
        pathname.startsWith('/api/') ||
        pathname === '/login' ||
        pathname === '/register' ||
        !pathname
      ) {
        setChecked(true);
        return;
      }

      try {
        const response = await fetch(`/api/developer/page-access/check?path=${encodeURIComponent(pathname)}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.isEnabled === false) {
            // Page is disabled, redirect to under-development page
            router.replace(`/under-development?page=${encodeURIComponent(pathname)}`);
            return;
          }
        }
      } catch (error) {
        // On error, allow access (fail open)
        console.error('Error checking page access:', error);
      } finally {
        setChecked(true);
      }
    }

    if (!checked) {
      checkAccess();
    }
  }, [pathname, router, checked]);

  return null;
}

