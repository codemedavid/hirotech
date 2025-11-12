'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { BarChart3, TrendingUp, Users, MessageSquare, CheckSquare } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface TeamAnalyticsProps {
  teamId: string
}

export function TeamAnalytics({ teamId }: TeamAnalyticsProps) {
  const [members, setMembers] = useState<any[]>([])
  const [selectedMember, setSelectedMember] = useState<string>('')
  const [metrics, setMetrics] = useState<any>(null)
  const [heatmap, setHeatmap] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMembers()
    fetchHeatmap()
  }, [teamId])

  useEffect(() => {
    if (selectedMember) {
      fetchMemberMetrics(selectedMember)
    }
  }, [selectedMember])

  async function fetchMembers() {
    try {
      const response = await fetch(`/api/teams/${teamId}/members`)
      const data = await response.json()
      setMembers(data.members.filter((m: any) => m.status === 'ACTIVE'))
      if (data.members.length > 0) {
        setSelectedMember(data.members[0].id)
      }
    } catch (error) {
      console.error('Error fetching members:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchMemberMetrics(memberId: string) {
    try {
      const response = await fetch(
        `/api/teams/${teamId}/activities?view=metrics&memberId=${memberId}`
      )
      const data = await response.json()
      setMetrics(data.metrics)
    } catch (error) {
      console.error('Error fetching metrics:', error)
    }
  }

  async function fetchHeatmap() {
    try {
      const response = await fetch(
        `/api/teams/${teamId}/activities?view=heatmap&days=30`
      )
      const data = await response.json()
      setHeatmap(data.heatmap)
    } catch (error) {
      console.error('Error fetching heatmap:', error)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Team Analytics</h2>
        <p className="text-sm text-muted-foreground">
          View engagement metrics and activity patterns
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Member Activity</TabsTrigger>
          <TabsTrigger value="heatmap">Activity Heatmap</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{members.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Today</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {members.filter(m => {
                    if (!m.lastActiveAt) return false
                    const lastActive = new Date(m.lastActiveAt)
                    const today = new Date()
                    return lastActive.toDateString() === today.toDateString()
                  }).length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {members.reduce((sum, m) => sum + (m._count?.sentMessages || 0), 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {members.reduce((sum, m) => sum + (m._count?.assignedTasks || 0), 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Most Active Members</CardTitle>
              <CardDescription>Based on recent activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {members
                  .sort((a, b) => (b._count?.activities || 0) - (a._count?.activities || 0))
                  .slice(0, 5)
                  .map((member) => (
                    <div key={member.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={member.user.image} />
                          <AvatarFallback>{member.user.name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.user.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {member._count?.activities || 0} activities
                          </p>
                        </div>
                      </div>
                      <Badge>{member.role}</Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Member Engagement</CardTitle>
                  <CardDescription>Detailed activity metrics per member</CardDescription>
                </div>
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {metrics ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Total Activities</p>
                    <p className="text-2xl font-bold">{metrics.totalActivities}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Messages Sent</p>
                    <p className="text-2xl font-bold">{metrics.messagesSent}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Tasks Completed</p>
                    <p className="text-2xl font-bold">{metrics.tasksCompleted}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Pages Accessed</p>
                    <p className="text-2xl font-bold">{metrics.pagesAccessed}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Time Spent</p>
                    <p className="text-2xl font-bold">
                      {Math.round(metrics.totalTimeSpent / 3600)}h
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heatmap">
          <Card>
            <CardHeader>
              <CardTitle>Activity Heatmap</CardTitle>
              <CardDescription>
                Busiest times for team activity over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {heatmap ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Heatmap visualization coming soon...
                  </p>
                  <pre className="text-xs overflow-auto max-h-96 bg-muted p-4 rounded">
                    {JSON.stringify(heatmap, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

