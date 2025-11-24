import { prisma } from '@/lib/db';

/**
 * Server-side function to check if a developer has access to a specific page
 * Use this in Server Components and API routes (not in middleware/Edge Runtime)
 */
export async function checkDeveloperPageAccess(
  userId: string,
  pagePath: string
): Promise<boolean> {
  try {
    // Check if user is a developer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== 'DEVELOPER') {
      // Not a developer, allow access (normal users aren't restricted)
      return true;
    }

    // Check page access setting
    const pageAccess = await prisma.pageAccess.findUnique({
      where: {
        userId_pagePath: {
          userId,
          pagePath,
        },
      },
    });

    // If no setting exists, default to enabled
    if (!pageAccess) {
      return true;
    }

    return pageAccess.isEnabled;
  } catch (error) {
    console.error('Error checking developer page access:', error);
    // On error, default to enabled (fail open)
    return true;
  }
}

