'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Copy, RefreshCw, Trash2, AlertCircle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface Team {
  id: string
  name: string
  description: string | null
  ownerId: string
}

interface TeamSettingsProps {
  team: Team
  currentUserId: string
  onUpdate: () => void
}

export function TeamSettings({ team, currentUserId, onUpdate }: TeamSettingsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(team.name)
  const [description, setDescription] = useState(team.description || '')
  const [joinCode, setJoinCode] = useState<string>('')
  const [joinCodeExpiry, setJoinCodeExpiry] = useState<string>('')

  const isOwner = team.ownerId === currentUserId

  const fetchJoinCode = async () => {
    try {
      const response = await fetch(`/api/teams/${team.id}/join-code`)
      const data = await response.json()
      setJoinCode(data.joinCode)
      setJoinCodeExpiry(data.expiresAt)
    } catch {
      toast.error('Failed to fetch join code')
    }
  }

  async function rotateJoinCode() {
    try {
      const response = await fetch(`/api/teams/${team.id}/join-code`, {
        method: 'POST'
      })
      const data = await response.json()
      setJoinCode(data.joinCode)
      setJoinCodeExpiry(data.expiresAt)
      toast.success('Join code rotated successfully')
    } catch {
      toast.error('Failed to rotate join code')
    }
  }

  async function copyJoinCode() {
    if (!joinCode) await fetchJoinCode()
    
    if (joinCode) {
      await navigator.clipboard.writeText(joinCode)
      toast.success('Join code copied to clipboard')
    }
  }

  async function updateTeam(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      })

      if (!response.ok) throw new Error('Failed to update team')

      toast.success('Team updated successfully')
      onUpdate()
    } catch {
      toast.error('Failed to update team')
    } finally {
      setLoading(false)
    }
  }

  async function deleteTeam() {
    try {
      const response = await fetch(`/api/teams/${team.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete team')

      toast.success('Team deleted successfully')
      router.push('/team')
      router.refresh()
    } catch {
      toast.error('Failed to delete team')
    }
  }

  useEffect(() => {
    fetchJoinCode()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id])

  const expiryTime = joinCodeExpiry 
    ? Math.max(0, Math.floor((new Date(joinCodeExpiry).getTime() - Date.now()) / 1000))
    : 0
  const minutesLeft = Math.floor(expiryTime / 60)
  const secondsLeft = expiryTime % 60

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Team Settings</CardTitle>
          <CardDescription>
            Manage your team&apos;s information and preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={updateTeam} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Join Code</CardTitle>
          <CardDescription>
            Share this code with people you want to invite to the team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <code className="text-2xl font-mono bg-muted px-4 py-2 rounded">
                  {joinCode || 'Loading...'}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyJoinCode}
                  disabled={!joinCode}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              
              {joinCodeExpiry && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    Expires in {minutesLeft}:{secondsLeft.toString().padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              onClick={rotateJoinCode}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Rotate Code
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            The join code automatically rotates every 10 minutes for security.
            Users will need admin approval to join.
          </p>
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions that affect your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Team
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the
                    team and remove all associated data including members, tasks,
                    messages, and activity history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={deleteTeam}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Team
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

