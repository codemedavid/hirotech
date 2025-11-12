'use client'

import { useEffect, useState } from 'react'
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  entityUrl?: string | null
  isRead: boolean
  createdAt: string
}

interface TeamNotificationsDropdownProps {
  teamId: string
  currentMemberId: string
}

export function TeamNotificationsDropdown({ teamId, currentMemberId }: TeamNotificationsDropdownProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [markingAllRead, setMarkingAllRead] = useState(false)
  const [open, setOpen] = useState(false)

  // Fetch unread count
  useEffect(() => {
    fetchUnreadCount()
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (open && notifications.length === 0) {
      fetchNotifications()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function fetchUnreadCount() {
    try {
      const response = await fetch(`/api/teams/${teamId}/notifications/unread-count`)
      if (response.ok) {
        const data = await response.json()
        setUnreadCount(data.count)
      }
    } catch (error) {
      console.error('Error fetching unread count:', error)
    }
  }

  async function fetchNotifications() {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/notifications?limit=20`)
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(notificationId: string, entityUrl?: string | null) {
    try {
      await fetch(`/api/teams/${teamId}/notifications/${notificationId}/read`, {
        method: 'PATCH'
      })

      // Update local state
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, isRead: true } : n
      ))
      setUnreadCount(Math.max(0, unreadCount - 1))

      // Navigate if URL provided
      if (entityUrl) {
        setOpen(false)
        router.push(entityUrl)
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  async function markAllAsRead() {
    setMarkingAllRead(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/notifications/mark-all-read`, {
        method: 'POST'
      })

      if (response.ok) {
        setNotifications(notifications.map(n => ({ ...n, isRead: true })))
        setUnreadCount(0)
        toast.success('All notifications marked as read')
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
      toast.error('Failed to mark all as read')
    } finally {
      setMarkingAllRead(false)
    }
  }

  const notificationIcons: Record<string, string> = {
    TASK_ASSIGNED: '📋',
    TASK_UPDATED: '✏️',
    TASK_COMPLETED: '✅',
    TASK_DUE_SOON: '⏰',
    MESSAGE_MENTION: '💬',
    MESSAGE_REPLY: '↩️',
    BROADCAST_MESSAGE: '📢',
    TEAM_INVITE: '✉️',
    MEMBER_JOINED: '👋',
    MEMBER_LEFT: '👋',
    ROLE_CHANGED: '🔧',
    PERMISSION_CHANGED: '🔐',
    TEAM_ANNOUNCEMENT: '📣'
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-in fade-in zoom-in"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[400px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              disabled={markingAllRead}
              className="h-auto p-0 text-xs font-normal text-primary hover:text-primary/80"
            >
              {markingAllRead ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Marking...
                </>
              ) : (
                <>
                  <CheckCheck className="mr-1 h-3 w-3" />
                  Mark all read
                </>
              )}
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  'flex items-start gap-3 p-4 cursor-pointer',
                  !notification.isRead && 'bg-muted/50'
                )}
                onClick={() => markAsRead(notification.id, notification.entityUrl)}
              >
                <div className="text-2xl flex-shrink-0">
                  {notificationIcons[notification.type] || '📌'}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-none">
                      {notification.title}
                    </p>
                    {!notification.isRead && (
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}
        
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center text-center text-sm text-primary cursor-pointer"
              onClick={() => {
                setOpen(false)
                router.push(`/team?tab=notifications`)
              }}
            >
              View all notifications
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

