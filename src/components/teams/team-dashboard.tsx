'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TeamSelector } from './team-selector'
import { TeamActivity } from './team-activity'
import { EnhancedTeamInbox } from './enhanced-team-inbox'
import { TeamTasks } from './team-tasks'
import { TeamMembers } from './team-members'
import { EnhancedTeamMembers } from './enhanced-team-members'
import { TeamSettings } from './team-settings'
import { JoinRequestQueue } from './join-request-queue'
import { TeamAnalytics } from './team-analytics'
import { Users, MessageSquare, CheckSquare, BarChart3, Settings, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { TeamNotificationsDropdown } from './team-notifications-dropdown'

interface Team {
  id: string
  name: string
  description: string | null
  ownerId: string
  _count: {
    members: number
    tasks: number
    messages: number
  }
  members: Array<{
    id: string
    role: string
    status: string
  }>
}

interface PendingRequest {
  id: string
  status: string
  invite: {
    team: {
      id: string
      name: string
    }
  }
}

interface TeamDashboardProps {
  teams: Team[]
  activeTeam: Team | undefined
  currentUserId: string
  pendingRequests: PendingRequest[]
}

export function TeamDashboard({ teams, activeTeam, currentUserId, pendingRequests }: TeamDashboardProps) {
  const router = useRouter()
  const [selectedTeamId, setSelectedTeamId] = useState(activeTeam?.id || teams[0]?.id || '')
  const [activeTab, setActiveTab] = useState('overview')

  const selectedTeam = teams.find(t => t.id === selectedTeamId) || activeTeam
  const currentMember = selectedTeam?.members[0]
  const isAdmin = currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN'
  const isPending = currentMember?.status === 'PENDING'

  const teamPendingRequests = pendingRequests.filter(
    req => req.invite.team.id === selectedTeamId
  )

  async function switchTeam(teamId: string) {
    try {
      const response = await fetch('/api/teams/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to switch team')
      }

      toast.success(data.message)
      setSelectedTeamId(teamId)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to switch team')
    }
  }

  if (isPending) {
    return (
      <div className="container max-w-4xl mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Pending Approval</CardTitle>
            <CardDescription>
              Your request to join {selectedTeam?.name} is pending admin approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You&apos;ll receive a notification once your request has been reviewed.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="text-muted-foreground">
            Collaborate with your team members
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {currentMember && (
            <TeamNotificationsDropdown 
              teamId={selectedTeamId}
              currentMemberId={currentMember.id}
            />
          )}
          
          {teamPendingRequests.length > 0 && isAdmin && (
            <Button
              variant="outline"
              onClick={() => setActiveTab('requests')}
              className="relative"
            >
              <Bell className="w-4 h-4 mr-2" />
              Requests
              <Badge variant="destructive" className="ml-2">
                {teamPendingRequests.length}
              </Badge>
            </Button>
          )}
          
          <TeamSelector
            teams={teams}
            selectedTeamId={selectedTeamId || ''}
            onSelect={switchTeam}
          />
        </div>
      </div>

      {selectedTeam && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="inbox">
              <MessageSquare className="w-4 h-4 mr-2" />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <CheckSquare className="w-4 h-4 mr-2" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="w-4 h-4 mr-2" />
              Members
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="analytics">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{selectedTeam._count.members}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
                  <CheckSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{selectedTeam._count.tasks}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Messages</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{selectedTeam._count.messages}</div>
                </CardContent>
              </Card>
            </div>

            {currentMember && <TeamActivity teamId={selectedTeam.id} memberId={currentMember.id} />}
          </TabsContent>

          <TabsContent value="inbox">
            {currentMember && <EnhancedTeamInbox teamId={selectedTeam.id} currentMemberId={currentMember.id} isAdmin={isAdmin} />}
          </TabsContent>

          <TabsContent value="tasks">
            {currentMember && (
              <TeamTasks 
                teamId={selectedTeam.id} 
                currentMemberId={currentMember.id}
                isAdmin={isAdmin}
              />
            )}
          </TabsContent>

          <TabsContent value="members">
            <EnhancedTeamMembers 
              teamId={selectedTeam.id}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          </TabsContent>

          {isAdmin && (
            <>
              <TabsContent value="analytics">
                <TeamAnalytics teamId={selectedTeam.id} />
              </TabsContent>

              <TabsContent value="settings">
                <TeamSettings 
                  team={selectedTeam}
                  currentUserId={currentUserId}
                  onUpdate={() => router.refresh()}
                />
                {teamPendingRequests.length > 0 && (
                  <JoinRequestQueue 
                    teamId={selectedTeam.id}
                    requests={teamPendingRequests}
                    onUpdate={() => router.refresh()}
                  />
                )}
              </TabsContent>
            </>
          )}

          {activeTab === 'requests' && isAdmin && (
            <TabsContent value="requests">
              <JoinRequestQueue 
                teamId={selectedTeam.id}
                requests={teamPendingRequests}
                onUpdate={() => router.refresh()}
              />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  )
}

