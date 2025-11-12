import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// This route is just for documentation purposes
// The actual Socket.IO server is initialized in server.ts
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Socket.IO server endpoint',
    status: 'WebSocket connections should use path: /api/socket',
    documentation: {
      connect: 'Use Socket.IO client to connect to /api/socket',
      events: {
        client: [
          'join:team',
          'leave:team',
          'join:thread',
          'leave:thread',
          'typing:start',
          'typing:stop',
          'presence:update'
        ],
        server: [
          'message:new',
          'message:updated',
          'message:deleted',
          'thread:new',
          'user:typing',
          'user:stopped-typing',
          'presence:changed'
        ]
      }
    }
  })
}

