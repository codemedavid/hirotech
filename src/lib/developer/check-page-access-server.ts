import { prisma } from '@/lib/db';

/**
 * Server-side function to check if a page is globally enabled (affects all users)
 * Use this in Server Components and API routes (not in middleware/Edge Runtime)
 * @param pagePath - The page path to check
 * @returns true if page is enabled, false if disabled
 */
export async function checkPageAccessGlobal(pagePath: string): Promise<boolean> {
  try {
    const pageAccess = await prisma.pageAccess.findUnique({
      where: {
        pagePath,
      },
    });

    // If no setting exists, default to enabled
    if (!pageAccess) {
      return true;
    }

    return pageAccess.isEnabled;
  } catch (error) {
    console.error('Error checking page access:', error);
    // On error, default to enabled (fail open)
    return true;
  }
}

