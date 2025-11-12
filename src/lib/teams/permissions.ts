import { prisma } from '@/lib/db'
import { TeamRole } from '@prisma/client'

export type Permission = 
  | 'canViewContacts'
  | 'canEditContacts'
  | 'canDeleteContacts'
  | 'canViewCampaigns'
  | 'canCreateCampaigns'
  | 'canEditCampaigns'
  | 'canDeleteCampaigns'
  | 'canSendCampaigns'
  | 'canViewConversations'
  | 'canSendMessages'
  | 'canViewPipelines'
  | 'canEditPipelines'
  | 'canViewTemplates'
  | 'canEditTemplates'
  | 'canViewAnalytics'
  | 'canExportData'
  | 'canManageTeam'

/**
 * Default permissions by role
 */
export const DEFAULT_PERMISSIONS: Record<TeamRole, Record<Permission, boolean>> = {
  OWNER: {
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
  },
  ADMIN: {
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
  },
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
  MEMBER: {
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
  },
}

/**
 * Checks if a user has a specific permission in a team
 */
export async function hasPermission(
  userId: string,
  teamId: string,
  permission: Permission,
  facebookPageId?: string
): Promise<boolean> {
  const member = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: { userId, teamId }
    },
    include: {
      permissions: {
        where: facebookPageId ? { facebookPageId } : {}
      }
    }
  })
  
  if (!member || member.status !== 'ACTIVE') {
    return false
  }
  
  // Owner and Admin have all permissions
  if (member.role === 'OWNER' || member.role === 'ADMIN') {
    return true
  }
  
  // Check specific permissions
  if (member.permissions.length > 0) {
    const perm = member.permissions[0]
    return perm[permission] ?? DEFAULT_PERMISSIONS[member.role][permission]
  }
  
  // Fall back to role-based permissions
  return DEFAULT_PERMISSIONS[member.role][permission]
}

/**
 * Checks if a user is an admin or owner of a team
 */
export async function isTeamAdmin(userId: string, teamId: string): Promise<boolean> {
  const member = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: { userId, teamId }
    },
    select: { role: true, status: true }
  })
  
  return member?.status === 'ACTIVE' && (member.role === 'OWNER' || member.role === 'ADMIN')
}

/**
 * Checks if a user is the owner of a team
 */
export async function isTeamOwner(userId: string, teamId: string): Promise<boolean> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true }
  })
  
  return team?.ownerId === userId
}

/**
 * Gets all permissions for a team member
 */
export async function getMemberPermissions(userId: string, teamId: string) {
  const member = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: { userId, teamId }
    },
    include: {
      permissions: {
        include: {
          facebookPage: {
            select: {
              id: true,
              pageName: true,
              pageId: true
            }
          }
        }
      }
    }
  })
  
  if (!member) {
    return null
  }
  
  return {
    role: member.role,
    status: member.status,
    permissions: member.permissions,
    defaultPermissions: DEFAULT_PERMISSIONS[member.role]
  }
}

/**
 * Creates default permissions for a new team member
 */
export async function createDefaultPermissions(memberId: string, role: TeamRole = 'MEMBER') {
  const permissions = DEFAULT_PERMISSIONS[role]
  
  await prisma.teamMemberPermission.create({
    data: {
      memberId,
      ...permissions
    }
  })
}

/**
 * Updates permissions for a team member
 */
export async function updateMemberPermissions(
  memberId: string,
  permissions: Partial<Record<Permission, boolean>>,
  facebookPageId?: string
) {
  const existing = await prisma.teamMemberPermission.findFirst({
    where: {
      memberId,
      facebookPageId: facebookPageId || null
    }
  })
  
  if (existing) {
    return prisma.teamMemberPermission.update({
      where: { id: existing.id },
      data: permissions
    })
  } else {
    return prisma.teamMemberPermission.create({
      data: {
        memberId,
        facebookPageId,
        ...permissions
      }
    })
  }
}

