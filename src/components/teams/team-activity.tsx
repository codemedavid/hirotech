'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface Activity {
  id: string
  type: string
  action: string
  entityType?: string
  entityName?: string
  createdAt: string
}

interface TeamActivityProps {
  teamId: string
  memberId: string
}

const activityIcons: Record<string, string> = {
  LOGIN: '🔐',
  LOGOUT: '👋',
  VIEW_PAGE: '👁️',
  CREATE_ENTITY: '➕',
  EDIT_ENTITY: '✏️',
  DELETE_ENTITY: '🗑️',
  SEND_MESSAGE: '💬',
  COMPLETE_TASK: '✅',
  JOIN_TEAM: '🎉',
  LEAVE_TEAM: '👋',
  PERMISSION_CHANGED: '🔧',
}

export function TeamActivity({ teamId, memberId }: TeamActivityProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchActivities() {
      try {
        const response = await fetch(
          `/api/teams/${teamId}/activities?memberId=${memberId}&limit=10`
        )
        const data = await response.json()
        setActivities(data.activities || [])
      } catch (error) {
        console.error('Error fetching activities:', error)
        setActivities([])
      } finally {
        setLoading(false)
      }
    }

    fetchActivities()
  }, [teamId, memberId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your recent actions in this team</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : !activities || activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No recent activity
          </p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="text-2xl">{activityIcons[activity.type] || '📍'}</div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{activity.action}</p>
                  {activity.entityName && (
                    <p className="text-xs text-muted-foreground">
                      {activity.entityType}: {activity.entityName}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <Badge variant="outline">{activity.type.replace(/_/g, ' ')}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

