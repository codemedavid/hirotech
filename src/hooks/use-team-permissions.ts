'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/hooks/use-session';
import { Permission } from '@/lib/teams/permissions';

interface PermissionState {
  loading: boolean;
  permissions: Record<Permission, boolean> | null;
  hasPermission: (permission: Permission) => boolean;
}

/**
 * Hook to check team member permissions
 * Falls back to organization-level permissions if not in team context
 */
export function useTeamPermissions(facebookPageId?: string): PermissionState {
  const { data: session } = useSession();
  const [permissions, setPermissions] = useState<Record<Permission, boolean> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPermissions() {
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }

      // If in team context, fetch team permissions
      if (session.user.teamContext?.teamId) {
        try {
          const response = await fetch(
            `/api/teams/${session.user.teamContext.teamId}/permissions?facebookPageId=${facebookPageId || ''}`
          );
          
          if (response.ok) {
            const data = await response.json();
            setPermissions(data.permissions);
          } else {
            // If permissions fetch fails, assume default based on role
            setPermissions(getDefaultPermissions(session.user.teamContext.memberRole));
          }
        } catch (error) {
          console.error('Error fetching team permissions:', error);
          setPermissions(getDefaultPermissions(session.user.teamContext.memberRole));
        }
      } else {
        // Not in team context - use organization role permissions
        // For organization admins/owners, grant all permissions
        const isOrgAdmin = session.user.role === 'ADMIN';
        setPermissions(isOrgAdmin ? getAllPermissions() : getMemberPermissions());
      }
      
      setLoading(false);
    }

    fetchPermissions();
  }, [session, facebookPageId]);

  const hasPermission = (permission: Permission): boolean => {
    if (!permissions) return false;
    return permissions[permission] ?? false;
  };

  return { loading, permissions, hasPermission };
}

function getDefaultPermissions(role: string): Record<Permission, boolean> {
  const defaults = {
    OWNER: getAllPermissions(),
    ADMIN: getAllPermissions(),
    MANAGER: {
      canViewContacts: true,
      canEditContacts: true,
      canDeleteContacts: false,
      canViewCampaigns: true,
      canCreateCampaigns: true,
      canEditCampaigns: true,
      canDeleteCampaigns: false,
      canSendCampaigns: true,
      canViewConversations: true,
      canSendMessages: true,
      canViewPipelines: true,
      canEditPipelines: true,
      canViewTemplates: true,
      canEditTemplates: true,
      canViewAnalytics: true,
      canExportData: false,
      canManageTeam: false,
    },
    MEMBER: getMemberPermissions(),
  };

  return defaults[role as keyof typeof defaults] || getMemberPermissions();
}

function getAllPermissions(): Record<Permission, boolean> {
  return {
    canViewContacts: true,
    canEditContacts: true,
    canDeleteContacts: true,
    canViewCampaigns: true,
    canCreateCampaigns: true,
    canEditCampaigns: true,
    canDeleteCampaigns: true,
    canSendCampaigns: true,
    canViewConversations: true,
    canSendMessages: true,
    canViewPipelines: true,
    canEditPipelines: true,
    canViewTemplates: true,
    canEditTemplates: true,
    canViewAnalytics: true,
    canExportData: true,
    canManageTeam: true,
  };
}

function getMemberPermissions(): Record<Permission, boolean> {
  return {
    canViewContacts: true,
    canEditContacts: false,
    canDeleteContacts: false,
    canViewCampaigns: true,
    canCreateCampaigns: false,
    canEditCampaigns: false,
    canDeleteCampaigns: false,
    canSendCampaigns: false,
    canViewConversations: true,
    canSendMessages: true,
    canViewPipelines: true,
    canEditPipelines: false,
    canViewTemplates: true,
    canEditTemplates: false,
    canViewAnalytics: false,
    canExportData: false,
    canManageTeam: false,
  };
}

