import { prisma } from '@/lib/db';

/**
 * Check if a developer has access to a specific page
 * @param userId - The user ID
 * @param pagePath - The page path (e.g., "/dashboard", "/contacts")
 * @returns true if access is enabled, false if disabled, null if no setting exists (default enabled)
 */
export async function checkPageAccess(
  userId: string,
  pagePath: string
): Promise<boolean | null> {
  try {
    const pageAccess = await prisma.pageAccess.findUnique({
      where: {
        userId_pagePath: {
          userId,
          pagePath,
        },
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

