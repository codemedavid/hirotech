'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSupabaseSession } from '@/hooks/use-supabase-session'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  joinTeam: (teamId: string) => void
  leaveTeam: (teamId: string) => void
  joinThread: (threadId: string) => void
  leaveThread: (threadId: string) => void
  emitTyping: (teamId: string, threadId: string, userName: string) => void
  stopTyping: (teamId: string, threadId: string) => void
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  joinTeam: () => {},
  leaveTeam: () => {},
  joinThread: () => {},
  leaveThread: () => {},
  emitTyping: () => {},
  stopTyping: () => {}
})

export function useSocket() {
  return useContext(SocketContext)
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { user, isLoading } = useSupabaseSession()
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // Clean up any existing connection first
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    if (!user?.id) {
      // No session, cleanup will handle state reset
      return () => {
        socketRef.current = null
        setSocket(null)
        setIsConnected(false)
      }
    }

    // Initialize Socket.IO client
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin
    const socketInstance = io(socketUrl, {
      path: '/api/socket',
      auth: {
        userId: user.id
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    socketInstance.on('connect', () => {
      console.log('[Socket.IO] Connected:', socketInstance.id)
      setIsConnected(true)
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected:', reason)
      setIsConnected(false)
    })

    socketInstance.on('connect_error', (error) => {
      console.error('[Socket.IO] Connection error:', error)
      setIsConnected(false)
    })

    socketInstance.on('error', (error) => {
      console.error('[Socket.IO] Error:', error)
    })

    socketRef.current = socketInstance
    // Setting socket state here is intentional and safe for Socket.IO initialization
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(socketInstance)

    return () => {
      console.log('[Socket.IO] Cleaning up socket connection')
      if (socketInstance) {
        socketInstance.disconnect()
      }
      socketRef.current = null
      setSocket(null)
      setIsConnected(false)
    }
  }, [user?.id])

  const joinTeam = (teamId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      console.log('[Socket.IO] Joining team:', teamId)
      socketRef.current.emit('join:team', teamId)
    }
  }

  const leaveTeam = (teamId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      console.log('[Socket.IO] Leaving team:', teamId)
      socketRef.current.emit('leave:team', teamId)
    }
  }

  const joinThread = (threadId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      console.log('[Socket.IO] Joining thread:', threadId)
      socketRef.current.emit('join:thread', threadId)
    }
  }

  const leaveThread = (threadId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      console.log('[Socket.IO] Leaving thread:', threadId)
      socketRef.current.emit('leave:thread', threadId)
    }
  }

  const emitTyping = (teamId: string, threadId: string, userName: string) => {
    if (socketRef.current && socketRef.current.connected && user?.id) {
      socketRef.current.emit('typing:start', {
        teamId,
        threadId,
        userId: user.id,
        userName
      })
    }
  }

  const stopTyping = (teamId: string, threadId: string) => {
    if (socketRef.current && socketRef.current.connected && user?.id) {
      socketRef.current.emit('typing:stop', {
        teamId,
        threadId,
        userId: user.id
      })
    }
  }

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinTeam,
        leaveTeam,
        joinThread,
        leaveThread,
        emitTyping,
        stopTyping
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

