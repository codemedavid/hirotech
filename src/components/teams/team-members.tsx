'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Shield, User, Crown, Ban, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface TeamMembersProps {
  teamId: string
  currentUserId: string
  isAdmin: boolean
}

export function TeamMembers({ teamId, currentUserId, isAdmin }: TeamMembersProps) {
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMembers()
  }, [teamId])

  async function fetchMembers() {
    try {
      const response = await fetch(`/api/teams/${teamId}/members`)
      const data = await response.json()
      setMembers(data.members)
    } catch (error) {
      console.error('Error fetching members:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateMemberRole(memberId: string, role: string) {
    try {
      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      })

      if (!response.ok) throw new Error('Failed to update member')

      const data = await response.json()
      setMembers(members.map(m => m.id === memberId ? data.member : m))
      toast.success('Member role updated')
    } catch (error) {
      toast.error('Failed to update member role')
    }
  }

  async function suspendMember(memberId: string) {
    try {
      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SUSPENDED' })
      })

      if (!response.ok) throw new Error('Failed to suspend member')

      const data = await response.json()
      setMembers(members.map(m => m.id === memberId ? data.member : m))
      toast.success('Member suspended')
    } catch (error) {
      toast.error('Failed to suspend member')
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm('Are you sure you want to remove this member?')) return

    try {
      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to remove member')

      setMembers(members.filter(m => m.id !== memberId))
      toast.success('Member removed')
    } catch (error) {
      toast.error('Failed to remove member')
    }
  }

  const roleIcons: Record<string, any> = {
    OWNER: Crown,
    ADMIN: Shield,
    MANAGER: User,
    MEMBER: User
  }

  const roleColors: Record<string, string> = {
    OWNER: 'bg-yellow-500',
    ADMIN: 'bg-red-500',
    MANAGER: 'bg-blue-500',
    MEMBER: 'bg-gray-500'
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Manage team members and their permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => {
              const RoleIcon = roleIcons[member.role] || User
              const isCurrentUser = member.user.id === currentUserId

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={member.user.image} />
                      <AvatarFallback>
                        {member.user.name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.user.name}</span>
                        {isCurrentUser && (
                          <Badge variant="secondary">You</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {member.user.email}
                      </p>
                      {member.lastActiveAt && (
                        <p className="text-xs text-muted-foreground">
                          Last active {formatDistanceToNow(new Date(member.lastActiveAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className={roleColors[member.role]}>
                      <RoleIcon className="w-3 h-3 mr-1" />
                      {member.role}
                    </Badge>

                    {member.status === 'SUSPENDED' && (
                      <Badge variant="destructive">Suspended</Badge>
                    )}

                    {isAdmin && !isCurrentUser && member.role !== 'OWNER' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          
                          {member.status === 'ACTIVE' && (
                            <>
                              {member.role !== 'ADMIN' && (
                                <DropdownMenuItem onClick={() => updateMemberRole(member.id, 'ADMIN')}>
                                  <Shield className="w-4 h-4 mr-2" />
                                  Make Admin
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => suspendMember(member.id)}>
                                <Ban className="w-4 h-4 mr-2" />
                                Suspend Member
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          <DropdownMenuItem
                            onClick={() => removeMember(member.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove Member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

