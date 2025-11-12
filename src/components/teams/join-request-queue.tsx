'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Check, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

interface JoinRequest {
  id: string
  status: string
  message?: string
  createdAt?: Date | string
  user?: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
  invite?: {
    team: {
      id: string
      name: string
    }
  }
}

interface JoinRequestQueueProps {
  teamId: string
  requests: JoinRequest[]
  onUpdate: () => void
}

export function JoinRequestQueue({ teamId, requests, onUpdate }: JoinRequestQueueProps) {
  const [processing, setProcessing] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [selectedRequest, setSelectedRequest] = useState<JoinRequest | null>(null)

  async function processRequest(requestId: string, action: 'approve' | 'reject', notes?: string) {
    setProcessing(requestId)
    
    try {
      const response = await fetch(
        `/api/teams/${teamId}/join-requests/${requestId}/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes })
        }
      )

      if (!response.ok) throw new Error(`Failed to ${action} request`)

      toast.success(
        action === 'approve' 
          ? 'Join request approved' 
          : 'Join request rejected'
      )
      onUpdate()
    } catch (error) {
      toast.error(`Failed to ${action} request`)
    } finally {
      setProcessing(null)
      setReviewNotes('')
      setSelectedRequest(null)
    }
  }

  if (requests.length === 0) {
    return null
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Join Requests</CardTitle>
            <CardDescription>
              Review and approve new team member requests
            </CardDescription>
          </div>
          <Badge variant="destructive">{requests.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex items-start justify-between p-4 border rounded-lg"
            >
              <div className="flex items-start gap-4 flex-1">
                <Avatar>
                  <AvatarImage src={request.user?.image || undefined} />
                  <AvatarFallback>
                    {request.user?.name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-1">
                  <div>
                    <p className="font-medium">{request.user?.name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">
                      {request.user?.email || ''}
                    </p>
                  </div>
                  
                  {request.message && (
                    <div className="mt-2 p-2 bg-muted rounded text-sm">
                      <p className="text-muted-foreground text-xs mb-1">Message:</p>
                      <p>{request.message}</p>
                    </div>
                  )}

                  {request.createdAt && (
                    <p className="text-xs text-muted-foreground">
                      Requested {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Dialog
                  open={selectedRequest?.id === request.id}
                  onOpenChange={(open) => !open && setSelectedRequest(null)}
                >
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => setSelectedRequest(request)}
                      disabled={processing === request.id}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Approve Join Request</DialogTitle>
                      <DialogDescription>
                        Approve {request.user?.name || 'this user'} to join the team
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea
                          id="notes"
                          placeholder="Add any notes about this approval..."
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedRequest(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => processRequest(request.id, 'approve', reviewNotes)}
                      >
                        Approve
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => processRequest(request.id, 'reject')}
                  disabled={processing === request.id}
                >
                  <X className="w-4 h-4 mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

