'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function JoinTeamForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/teams/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          joinCode: joinCode.toUpperCase().trim(),
          message: message.trim()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join team')
      }

      if (data.status === 'PENDING') {
        toast.success(data.message || 'Join request sent successfully')
      } else {
        toast.success('Successfully joined team!')
      }

      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to join team')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join a Team</CardTitle>
        <CardDescription>
          Enter the team join code to request access
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="joinCode">Join Code</Label>
            <Input
              id="joinCode"
              placeholder="ABC123"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              required
              className="text-center text-lg font-mono tracking-wider"
            />
            <p className="text-xs text-muted-foreground">
              Enter the 6-character code provided by your team admin
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Introduce yourself to the team..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || joinCode.length !== 6}>
            {loading ? 'Sending Request...' : 'Join Team'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

