# 🚀 Quick Start Guide - Team Inbox WebSocket Server

## Start Development Server

### Option 1: With WebSocket Support (Recommended)
```bash
npm run dev
```

This will start:
- ✅ Next.js development server
- ✅ Socket.IO WebSocket server
- ✅ Hot reload enabled
- ✅ Real-time messaging enabled

**Server will start at:** `http://localhost:3000`  
**WebSocket endpoint:** `http://localhost:3000/api/socket`

### Option 2: Without WebSocket (Fallback)
```bash
npm run dev:next
```

This will start:
- ✅ Next.js development server only
- ❌ No WebSocket support
- ❌ No real-time updates

---

## Environment Setup

### Required Environment Variables
Create `.env.local` file in project root:

```env
# Database
DATABASE_URL="your-postgresql-url"
DIRECT_URL="your-postgresql-direct-url"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Socket.io (REQUIRED for WebSocket)
NEXT_PUBLIC_SOCKET_URL="http://localhost:3000"
```

### Optional Environment Variables
```env
# For campaign worker (optional)
REDIS_URL="redis://localhost:6379"

# For Facebook integration (optional)
FACEBOOK_APP_ID="your-app-id"
FACEBOOK_APP_SECRET="your-app-secret"
```

---

## Quick Test

### 1. Start the Server
```bash
npm run dev
```

### 2. Check Console Output
You should see:
```
> Ready on http://localhost:3000
> Socket.IO ready on http://localhost:3000/api/socket
```

### 3. Open Browser
Navigate to: `http://localhost:3000/team`

### 4. Check Browser Console
You should see:
```
[Socket.IO] Connected: <socket-id>
[Socket.IO] Setting up team inbox listeners for team: <team-id>
```

---

## Testing Real-Time Features

### Test Message Delivery
1. Open two browser windows
2. Login as different users
3. Navigate to same team
4. Open same thread
5. Send a message from one window
6. ✅ Message should appear instantly in both windows

### Test Typing Indicators
1. In one window, start typing
2. ✅ Other window should show "<User> is typing..."
3. Stop typing
4. ✅ Indicator should disappear

### Test Message Edits
1. Edit a message in one window
2. ✅ Changes should appear instantly in other window

### Test Message Deletes
1. Delete a message in one window
2. ✅ Message should disappear in other window

---

## Troubleshooting

### WebSocket Not Connecting

**Problem:** Console shows connection errors

**Solution:**
1. Check if server is running: `npm run dev`
2. Verify `NEXT_PUBLIC_SOCKET_URL` in `.env.local`
3. Check port 3000 is not in use
4. Restart the server

### Messages Not Appearing in Real-Time

**Problem:** Messages don't update without refresh

**Solution:**
1. Check browser console for socket connection
2. Verify user is logged in
3. Check team membership
4. Verify socket connection status

### Build Lock Error

**Problem:** "Unable to acquire lock" error

**Solution:**
```bash
rm -rf .next/lock
npm run dev
```

---

## Production Deployment

### Build for Production
```bash
npm run build
```

### Start Production Server (with WebSocket)
```bash
npm run start
```

### Environment Variables for Production
Update `NEXT_PUBLIC_SOCKET_URL` to your production domain:
```env
NEXT_PUBLIC_SOCKET_URL="https://your-domain.com"
```

---

## Alternative: Standard Next.js Server (No WebSocket)

If you prefer to run without WebSocket:

### Development
```bash
npm run dev:next
```

### Production
```bash
npm run start:next
```

**Note:** Real-time features will not work, but the app will function normally with manual refresh.

---

## Monitoring

### Check Socket.IO Status
While server is running, visit:
```
http://localhost:3000/api/socket
```

You should see:
```json
{
  "message": "Socket.IO server endpoint",
  "status": "WebSocket connections should use path: /api/socket",
  "documentation": {
    "connect": "Use Socket.IO client to connect to /api/socket",
    "events": {
      "client": ["join:team", "leave:team", ...],
      "server": ["message:new", "message:updated", ...]
    }
  }
}
```

### Monitor Console Logs
Server logs show:
- `[Socket.IO] Client connected: <socket-id>`
- `[Socket.IO] User <user-id> joined team room: <team-id>`
- `[Socket.IO] Emitted new message to team <team-id>`

---

## Summary

✅ **Quick Start:** `npm run dev`  
✅ **Access:** `http://localhost:3000/team`  
✅ **WebSocket:** Automatically enabled  
✅ **Real-time:** Working out of the box  

**That's it! You're ready to use real-time team messaging.**

---

**Last Updated:** November 12, 2025  
**Status:** Ready to Use

