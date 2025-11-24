import { prisma } from '@/lib/db';

/**
 * Check if a page is globally enabled (affects all users)
 * @param pagePath - The page path (e.g., "/dashboard", "/contacts")
 * @returns true if enabled, false if disabled, null if no setting exists (default enabled)
 */
export async function checkPageAccess(
  pagePath: string
): Promise<boolean | null> {
  try {
    const pageAccess = await prisma.pageAccess.findUnique({
      where: {
        pagePath,
      },
    });

    // If no setting exists, return null (default enabled)
    if (!pageAccess) {
      return null;
    }

    return pageAccess.isEnabled;
  } catch (error) {
    console.error('Error checking page access:', error);
    // On error, default to enabled
    return null;
  }
}

/**
 * Check if user is a developer
 */
export async function isDeveloper(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    return user?.role === 'DEVELOPER';
  } catch (error) {
    console.error('Error checking developer role:', error);
    return false;
  }
}

