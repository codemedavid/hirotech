import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { prisma } from '@/lib/db'

let io: SocketIOServer | null = null

export function initializeSocket(httpServer: HTTPServer) {
  if (io) {
    console.log('[Socket.IO] Server already initialized')
    return io
  }

  io = new SocketIOServer(httpServer, {
    path: '/api/socket',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    addTrailingSlash: false,
    transports: ['websocket', 'polling']
  })

  io.on('connection', (socket) => {
    console.log('[Socket.IO] Client connected:', socket.id)

    // Join team room
    socket.on('join:team', async (teamId: string) => {
      try {
        // Verify user has access to team
        const userId = socket.handshake.auth.userId
        if (!userId) {
          socket.emit('error', { message: 'Unauthorized' })
          return
        }

        const member = await prisma.teamMember.findUnique({
          where: {
            userId_teamId: { userId, teamId }
          }
        })

        if (!member || member.status !== 'ACTIVE') {
          socket.emit('error', { message: 'Forbidden' })
          return
        }

        socket.join(`team:${teamId}`)
        console.log(`[Socket.IO] User ${userId} joined team room: ${teamId}`)
        socket.emit('joined:team', { teamId })
      } catch (error) {
        console.error('[Socket.IO] Error joining team:', error)
        socket.emit('error', { message: 'Failed to join team' })
      }
    })

    // Leave team room
    socket.on('leave:team', (teamId: string) => {
      socket.leave(`team:${teamId}`)
      console.log(`[Socket.IO] Client left team room: ${teamId}`)
    })

    // Join thread room
    socket.on('join:thread', (threadId: string) => {
      socket.join(`thread:${threadId}`)
      console.log(`[Socket.IO] Client joined thread room: ${threadId}`)
      socket.emit('joined:thread', { threadId })
    })

    // Leave thread room
    socket.on('leave:thread', (threadId: string) => {
      socket.leave(`thread:${threadId}`)
      console.log(`[Socket.IO] Client left thread room: ${threadId}`)
    })

    // Typing indicators
    socket.on('typing:start', ({ teamId, threadId, userId, userName }) => {
      socket.to(`thread:${threadId}`).emit('user:typing', {
        threadId,
        userId,
        userName
      })
    })

    socket.on('typing:stop', ({ teamId, threadId, userId }) => {
      socket.to(`thread:${threadId}`).emit('user:stopped-typing', {
        threadId,
        userId
      })
    })

    // Presence updates
    socket.on('presence:update', ({ teamId, status }) => {
      socket.to(`team:${teamId}`).emit('presence:changed', {
        userId: socket.handshake.auth.userId,
        status
      })
    })

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Client disconnected:', socket.id)
    })
  })

  console.log('[Socket.IO] Server initialized successfully')
  return io
}

export function getIO() {
  if (!io) {
    throw new Error('[Socket.IO] Socket.IO not initialized')
  }
  return io
}

// Emit new message to team room
export function emitNewMessage(teamId: string, threadId: string, message: any) {
  try {
    const socketIO = getIO()
    socketIO.to(`team:${teamId}`).emit('message:new', {
      threadId,
      message
    })
    console.log(`[Socket.IO] Emitted new message to team ${teamId}, thread ${threadId}`)
  } catch (error) {
    console.error('[Socket.IO] Error emitting new message:', error)
  }
}

// Emit message update
export function emitMessageUpdate(teamId: string, threadId: string, message: any) {
  try {
    const socketIO = getIO()
    socketIO.to(`team:${teamId}`).emit('message:updated', {
      threadId,
      message
    })
    console.log(`[Socket.IO] Emitted message update to team ${teamId}, thread ${threadId}`)
  } catch (error) {
    console.error('[Socket.IO] Error emitting message update:', error)
  }
}

// Emit message deletion
export function emitMessageDelete(teamId: string, threadId: string, messageId: string) {
  try {
    const socketIO = getIO()
    socketIO.to(`team:${teamId}`).emit('message:deleted', {
      threadId,
      messageId
    })
    console.log(`[Socket.IO] Emitted message deletion to team ${teamId}, thread ${threadId}`)
  } catch (error) {
    console.error('[Socket.IO] Error emitting message deletion:', error)
  }
}

// Emit new thread
export function emitNewThread(teamId: string, thread: any) {
  try {
    const socketIO = getIO()
    socketIO.to(`team:${teamId}`).emit('thread:new', {
      thread
    })
    console.log(`[Socket.IO] Emitted new thread to team ${teamId}`)
  } catch (error) {
    console.error('[Socket.IO] Error emitting new thread:', error)
  }
}

