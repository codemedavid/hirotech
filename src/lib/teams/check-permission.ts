import { getAuthUser } from '../supabase/auth-helpers';
import { Permission } from '@/lib/teams/permissions';

/**
 * Server-side permission check helper
 * Use this in API routes and server components
 */
export async function checkPermission(
  _permission: Permission,
  _facebookPageId?: string
): Promise<{ allowed: boolean; userId?: string; teamId?: string; memberId?: string }> {
  const user = await getAuthUser();
  
  if (!user?.id) {
    return { allowed: false };
  }

  // If not in team context, check organization role
  // In organization context, only ADMIN role has admin privileges
  const isAdmin = user.role === 'ADMIN';
  return {
    allowed: isAdmin,
    userId: user.id,
  };

  // TODO: Add team context support if needed
  // For now, we check organization-level permissions
}

/**
 * Require permission middleware for API routes
 * Throws error if permission denied
 */
export async function requirePermission(
  permission: Permission,
  _facebookPageId?: string
): Promise<{ userId: string; teamId?: string; memberId?: string }> {
  const result = await checkPermission(permission, _facebookPageId);
  
  if (!result.allowed) {
    throw new Error(`Permission denied: ${permission}`);
  }

  return {
    userId: result.userId!,
    teamId: result.teamId,
    memberId: result.memberId,
  };
}

