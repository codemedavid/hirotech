# 🚨 CRITICAL: NGROK Tunnel Causing ClientFetchError

## Root Cause Identified

**Problem**: The `ClientFetchError: Failed to fetch` error when calling `update()` is caused by ngrok tunnel interference.

### Evidence

```bash
$ curl -v http://localhost:3000/api/auth/session
< set-cookie: __Secure-authjs.callback-url=https%3A%2F%2Foverinhibited-delphia-superpatiently.ngrok-free.dev
```

**What's happening**:
1. Ngrok tunnel is running (2 processes detected)
2. NextAuth detects the ngrok URL in headers
3. `trustHost: true` makes NextAuth accept the ngrok domain
4. Session update callbacks try to reach the ngrok URL
5. Client-side fetch fails because ngrok URL is inaccessible or restricted

### Ngrok Processes Running

```bash
$ ps aux | grep ngrok
10646   ngrok  # Process 1
18705   ngrok  # Process 2
```

## 🔧 IMMEDIATE FIX

### Option 1: Stop Ngrok (Recommended for local development)

```bash
# Kill all ngrok processes
pkill ngrok

# Or manually:
ps aux | grep ngrok
kill -9 <PID>
```

### Option 2: Set Explicit NEXTAUTH_URL

Add to `.env.local`:

```env
NEXTAUTH_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
```

This forces NextAuth to use localhost instead of ngrok URL.

## 🎯 Why This Fixes the Error

**Before (with ngrok)**:
```
Client calls update() 
→ Tries to fetch https://overinhibited-delphia-superpatiently.ngrok-free.dev/api/auth/session
→ Ngrok URL unreachable/restricted
→ ClientFetchError: Failed to fetch
```

**After (without ngrok or with explicit URL)**:
```
Client calls update()
→ Fetches http://localhost:3000/api/auth/session
→ Success!
→ Session updated
```

## 📋 Step-by-Step Resolution

### 1. Check if ngrok is the issue

```bash
# Stop ngrok
pkill ngrok

# Restart Next.js dev server
npm run dev
```

### 2. Test session update

```javascript
// In browser console on /settings/profile
const { data: session, update } = useSession();
await update({ name: "Test" });
// Should work now!
```

### 3. If you NEED ngrok running

Add to `.env.local`:

```env
# Force localhost for auth
NEXTAUTH_URL=http://localhost:3000
AUTH_URL=http://localhost:3000

# Keep your ngrok URL for other purposes
NEXT_PUBLIC_NGROK_URL=https://overinhibited-delphia-superpatiently.ngrok-free.dev
```

## 🔍 Technical Details

### Why `trustHost: true` causes this

From NextAuth docs:
> `trustHost: true` makes NextAuth accept the Host header from the request. 
> This is useful when behind a proxy (like ngrok), but can cause issues 
> if the proxy URL is not accessible.

### How ngrok interferes

1. **Request comes through ngrok**: `Host: overinhibited-delphia-superpatiently.ngrok-free.dev`
2. **NextAuth sees Host header**: Sets callback URL to ngrok domain
3. **Client-side fetch**: Tries to reach ngrok URL from browser
4. **Ngrok restrictions**: Free tier has rate limits, requires headers, etc.
5. **Result**: Fetch fails

## ✅ Verification

After applying the fix:

```bash
# 1. Check session endpoint
curl http://localhost:3000/api/auth/session
# Should return 200 OK

# 2. Check callback URL
curl -v http://localhost:3000/api/auth/session 2>&1 | grep callback-url
# Should show localhost, not ngrok

# 3. Test in browser
# Go to /settings/profile
# Upload photo
# Click Save
# Should see success toast!
```

## 🚀 Production Note

In production, you SHOULD set `NEXTAUTH_URL` to your actual domain:

```env
NEXTAUTH_URL=https://yourdomain.com
```

This ensures consistent behavior regardless of proxy/CDN configuration.

## 📚 References

- [NextAuth v5 Configuration](https://authjs.dev/reference/core#authconfig)
- [NextAuth trustHost option](https://authjs.dev/reference/core#trusthost)
- [Ngrok with Next.js](https://ngrok.com/docs/integrations/nextjs/)

