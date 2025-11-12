'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Settings, Loader2 } from 'lucide-react'

interface Permission {
  facebookPageId?: string | null
  canViewContacts: boolean
  canEditContacts: boolean
  canDeleteContacts: boolean
  canViewCampaigns: boolean
  canCreateCampaigns: boolean
  canEditCampaigns: boolean
  canDeleteCampaigns: boolean
  canSendCampaigns: boolean
  canViewConversations: boolean
  canSendMessages: boolean
  canViewPipelines: boolean
  canEditPipelines: boolean
  canViewTemplates: boolean
  canEditTemplates: boolean
  canViewAnalytics: boolean
  canExportData: boolean
  canManageTeam: boolean
}

interface FacebookPage {
  id: string
  pageName: string
  pageId: string
}

interface MemberPermissionsDialogProps {
  teamId: string
  memberId: string
  memberName: string
  currentPermissions?: Permission[]
  onUpdate: () => void
}

export function MemberPermissionsDialog({
  teamId,
  memberId,
  memberName,
  currentPermissions,
  onUpdate
}: MemberPermissionsDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [facebookPages, setFacebookPages] = useState<FacebookPage[]>([])
  const [selectedPages, setSelectedPages] = useState<string[]>([])
  const [permissions, setPermissions] = useState({
    canViewContacts: true,
    canEditContacts: false,
    canDeleteContacts: false,
    canViewCampaigns: true,
    canCreateCampaigns: false,
    canEditCampaigns: false,
    canDeleteCampaigns: false,
    canSendCampaigns: false,
    canViewConversations: true,
    canSendMessages: false,
    canViewPipelines: true,
    canEditPipelines: false,
    canViewTemplates: true,
    canEditTemplates: false,
    canViewAnalytics: true,
    canExportData: false,
    canManageTeam: false
  })

  useEffect(() => {
    if (open) {
      fetchFacebookPages()
      if (currentPermissions) {
        loadCurrentPermissions()
      }
    }
  }, [open])

  async function fetchFacebookPages() {
    try {
      const response = await fetch('/api/facebook/pages')
      const data = await response.json()
      setFacebookPages(data.pages || [])
    } catch (error) {
      console.error('Error fetching Facebook pages:', error)
    }
  }

  function loadCurrentPermissions() {
    // Load existing permissions if available
    if (currentPermissions && currentPermissions.length > 0) {
      const perms = currentPermissions[0]
      setPermissions({
        canViewContacts: perms.canViewContacts,
        canEditContacts: perms.canEditContacts,
        canDeleteContacts: perms.canDeleteContacts,
        canViewCampaigns: perms.canViewCampaigns,
        canCreateCampaigns: perms.canCreateCampaigns,
        canEditCampaigns: perms.canEditCampaigns,
        canDeleteCampaigns: perms.canDeleteCampaigns,
        canSendCampaigns: perms.canSendCampaigns,
        canViewConversations: perms.canViewConversations,
        canSendMessages: perms.canSendMessages,
        canViewPipelines: perms.canViewPipelines,
        canEditPipelines: perms.canEditPipelines,
        canViewTemplates: perms.canViewTemplates,
        canEditTemplates: perms.canEditTemplates,
        canViewAnalytics: perms.canViewAnalytics,
        canExportData: perms.canExportData,
        canManageTeam: perms.canManageTeam
      })

      const pageIds = currentPermissions
        .filter((p) => p.facebookPageId)
        .map((p) => p.facebookPageId as string)
      setSelectedPages(pageIds)
    }
  }

  function togglePage(pageId: string) {
    setSelectedPages(prev =>
      prev.includes(pageId)
        ? prev.filter(id => id !== pageId)
        : [...prev, pageId]
    )
  }

  async function savePermissions() {
    setLoading(true)
    try {
      // Save permissions for each selected Facebook page
      for (const pageId of selectedPages) {
        const response = await fetch(
          `/api/teams/${teamId}/members/${memberId}/permissions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              facebookPageId: pageId,
              ...permissions
            })
          }
        )

        if (!response.ok) {
          throw new Error('Failed to save permissions')
        }
      }

      toast.success('Permissions updated successfully')
      onUpdate()
      setOpen(false)
    } catch (error) {
      toast.error('Failed to update permissions')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 mr-2" />
          Permissions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Permissions: {memberName}</DialogTitle>
          <DialogDescription>
            Configure what {memberName} can access and do in the team
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Facebook Pages Access */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Facebook Pages Access</Label>
            <p className="text-sm text-muted-foreground">
              Select which Facebook pages this member can access
            </p>
            <ScrollArea className="h-[150px] border rounded-lg p-4">
              {facebookPages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No Facebook pages connected
                </p>
              ) : (
                <div className="space-y-2">
                  {facebookPages.map((page) => (
                    <div
                      key={page.id}
                      className="flex items-center justify-between p-2 hover:bg-muted rounded"
                    >
                      <div>
                        <p className="text-sm font-medium">{page.pageName}</p>
                        <p className="text-xs text-muted-foreground">
                          Page ID: {page.pageId}
                        </p>
                      </div>
                      <Switch
                        checked={selectedPages.includes(page.id)}
                        onCheckedChange={() => togglePage(page.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <Separator />

          {/* Feature Permissions */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Feature Permissions</Label>

            {/* Contacts */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Contacts</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="viewContacts" className="text-sm">View</Label>
                  <Switch
                    id="viewContacts"
                    checked={permissions.canViewContacts}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canViewContacts: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="editContacts" className="text-sm">Edit</Label>
                  <Switch
                    id="editContacts"
                    checked={permissions.canEditContacts}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canEditContacts: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="deleteContacts" className="text-sm">Delete</Label>
                  <Switch
                    id="deleteContacts"
                    checked={permissions.canDeleteContacts}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canDeleteContacts: checked })
                    }
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Campaigns */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Campaigns</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="viewCampaigns" className="text-sm">View</Label>
                  <Switch
                    id="viewCampaigns"
                    checked={permissions.canViewCampaigns}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canViewCampaigns: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="createCampaigns" className="text-sm">Create</Label>
                  <Switch
                    id="createCampaigns"
                    checked={permissions.canCreateCampaigns}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canCreateCampaigns: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="editCampaigns" className="text-sm">Edit</Label>
                  <Switch
                    id="editCampaigns"
                    checked={permissions.canEditCampaigns}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canEditCampaigns: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="deleteCampaigns" className="text-sm">Delete</Label>
                  <Switch
                    id="deleteCampaigns"
                    checked={permissions.canDeleteCampaigns}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canDeleteCampaigns: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="sendCampaigns" className="text-sm">Send</Label>
                  <Switch
                    id="sendCampaigns"
                    checked={permissions.canSendCampaigns}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canSendCampaigns: checked })
                    }
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Conversations */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Conversations</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="viewConversations" className="text-sm">View</Label>
                  <Switch
                    id="viewConversations"
                    checked={permissions.canViewConversations}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canViewConversations: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="sendMessages" className="text-sm">Send Messages</Label>
                  <Switch
                    id="sendMessages"
                    checked={permissions.canSendMessages}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canSendMessages: checked })
                    }
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Other Permissions */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Other</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="viewPipelines" className="text-sm">View Pipelines</Label>
                  <Switch
                    id="viewPipelines"
                    checked={permissions.canViewPipelines}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canViewPipelines: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="editPipelines" className="text-sm">Edit Pipelines</Label>
                  <Switch
                    id="editPipelines"
                    checked={permissions.canEditPipelines}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canEditPipelines: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="viewTemplates" className="text-sm">View Templates</Label>
                  <Switch
                    id="viewTemplates"
                    checked={permissions.canViewTemplates}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canViewTemplates: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="editTemplates" className="text-sm">Edit Templates</Label>
                  <Switch
                    id="editTemplates"
                    checked={permissions.canEditTemplates}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canEditTemplates: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="viewAnalytics" className="text-sm">View Analytics</Label>
                  <Switch
                    id="viewAnalytics"
                    checked={permissions.canViewAnalytics}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canViewAnalytics: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="exportData" className="text-sm">Export Data</Label>
                  <Switch
                    id="exportData"
                    checked={permissions.canExportData}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canExportData: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="manageTeam" className="text-sm">Manage Team</Label>
                  <Switch
                    id="manageTeam"
                    checked={permissions.canManageTeam}
                    onCheckedChange={(checked) =>
                      setPermissions({ ...permissions, canManageTeam: checked })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={savePermissions} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Permissions'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

