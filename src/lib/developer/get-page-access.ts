import { prisma } from '@/lib/db';

/**
 * Get page access status for a specific page
 * Returns null if page is enabled (no restriction)
 * Returns false if page is disabled
 */
export async function getPageAccessStatus(pagePath: string): Promise<boolean | null> {
  try {
    const pageAccess = await prisma.pageAccess.findUnique({
      where: { pagePath },
    });

    if (!pageAccess) {
      // No setting = enabled by default
      return null;
    }

    return pageAccess.isEnabled;
  } catch (error) {
    console.error('Error getting page access:', error);
    // On error, default to enabled
    return null;
  }
}

