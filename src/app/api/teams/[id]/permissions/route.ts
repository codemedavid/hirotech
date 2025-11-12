import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getMemberPermissions } from '@/lib/teams/permissions';

/**
 * GET /api/teams/[id]/permissions
 * Get team member permissions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: teamId } = await params;
    const { searchParams } = new URL(request.url);
    const facebookPageId = searchParams.get('facebookPageId') || undefined;

    const permissions = await getMemberPermissions(session.user.id, teamId);

    if (!permissions) {
      return NextResponse.json(
        { error: 'You are not a member of this team' },
        { status: 403 }
      );
    }

    // Find specific page permissions if facebookPageId is provided
    let pagePermissions = permissions.defaultPermissions;
    
    if (facebookPageId && permissions.permissions.length > 0) {
      const pageSpecificPerm = permissions.permissions.find(
        p => p.facebookPageId === facebookPageId
      );
      
      if (pageSpecificPerm) {
        pagePermissions = {
          canViewContacts: pageSpecificPerm.canViewContacts,
          canEditContacts: pageSpecificPerm.canEditContacts,
          canDeleteContacts: pageSpecificPerm.canDeleteContacts,
          canViewCampaigns: pageSpecificPerm.canViewCampaigns,
          canCreateCampaigns: pageSpecificPerm.canCreateCampaigns,
          canEditCampaigns: pageSpecificPerm.canEditCampaigns,
          canDeleteCampaigns: pageSpecificPerm.canDeleteCampaigns,
          canSendCampaigns: pageSpecificPerm.canSendCampaigns,
          canViewConversations: pageSpecificPerm.canViewConversations,
          canSendMessages: pageSpecificPerm.canSendMessages,
          canViewPipelines: pageSpecificPerm.canViewPipelines,
          canEditPipelines: pageSpecificPerm.canEditPipelines,
          canViewTemplates: pageSpecificPerm.canViewTemplates,
          canEditTemplates: pageSpecificPerm.canEditTemplates,
          canViewAnalytics: pageSpecificPerm.canViewAnalytics,
          canExportData: pageSpecificPerm.canExportData,
          canManageTeam: pageSpecificPerm.canManageTeam,
        };
      }
    }

    return NextResponse.json({
      role: permissions.role,
      status: permissions.status,
      permissions: pagePermissions,
      availablePages: permissions.permissions.map(p => ({
        pageId: p.facebookPage?.id,
        pageName: p.facebookPage?.pageName,
      })).filter(p => p.pageId),
    });
  } catch (error) {
    console.error('Error fetching team permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}

