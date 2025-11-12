# 🚨 "Failed to Fetch" Error - Complete Debug Guide

**Issue**: Still seeing "Failed to fetch" after cookie fix  
**Date**: November 12, 2025  
**Status**: 🔍 **INVESTIGATING**

---

## 🔍 What "Failed to Fetch" Means

This is a **browser error** that occurs when:
1. Server returns a non-200 status code
2. Network request is interrupted
3. Server action throws an error
4. CORS policy blocks the request
5. Server crashes during request
6. Cookie is still too large (even after fix)

---

## ✅ Critical Checklist (Do These FIRST)

### Step 1: Verify Server is Running
```bash
# Kill all node processes
taskkill /F /IM node.exe

# Start fresh
npm run dev
```

**Wait for:** `✓ Ready in 2-3s`

---

### Step 2: Clear ALL Cookies
**Chrome/Edge:**
1. F12 (DevTools)
2. Application → Storage
3. Click "Clear site data" button
4. Check "Cookies and other site data"
5. Click "Clear data"

**Firefox:**
1. F12
2. Storage → Cookies
3. Right-click → Delete All

---

### Step 3: Check Auth Config
```bash
# Verify debug is disabled
grep "debug:" src/auth.ts
```

**Should show:**
```typescript
debug: false,  // ✅ GOOD
```

**If it shows `debug: true`:** The fix wasn't applied!

---

## 🔧 Advanced Debugging

### Check 1: Browser Console (Before Login)
Open DevTools (F12) → Console tab → Try logging in

**Look for these messages:**

**GOOD Signs** ✅:
```
[Login] Attempting sign in...
[Auth] Attempting login for: princecjqlara@gmail.com
[Auth] Comparing passwords...
[Auth] Login successful for: princecjqlara@gmail.com
```

**BAD Signs** ❌:
```
Failed to fetch
[auth][debug]: CHUNKING_SESSION_COOKIE
Session cookie exceeds allowed 4096 bytes
TypeError: Failed to fetch
CORS error
```

---

### Check 2: Network Tab
F12 → Network tab → Try logging in

**Look for:**
1. **POST /api/auth/callback/credentials**
   - Status: Should be 302 (redirect) or 200
   - If 500: Server error
   - If 400: Bad credentials
   - If 0: Network error

2. **Headers → Response Headers**
   - Look for: `set-cookie`
   - Count how many cookies
   - Check size of each cookie

**Expected:**
- 1-2 cookies
- Each < 4KB

**Bad:**
- 100+ cookies
- Any > 4KB

---

### Check 3: Server Terminal
**Look at your terminal where `npm run dev` is running**

**GOOD Signs** ✅:
```
[Auth] Attempting login for: princecjqlara@gmail.com
[Auth] Login successful
POST /login 303 in <1s
```

**BAD Signs** ❌:
```
Error: Session cookie exceeds allowed 4096 bytes
PrismaClientKnownRequestError
Can't reach database server
NOAUTH Authentication required (Redis)
```

---

## 🐛 Common Issues & Fixes

### Issue #1: Server Not Restarted
**Symptom:** Changes not taking effect

**Fix:**
```bash
# Kill all node processes
Ctrl+C in terminal (twice)

# If that doesn't work:
taskkill /F /IM node.exe

# Start fresh
npm run dev
```

---

### Issue #2: Cookies Not Cleared
**Symptom:** Still see 100+ cookies in DevTools

**Fix:**
1. Close ALL browser tabs for localhost:3000
2. F12 → Application → Clear site data
3. Close DevTools
4. Close browser completely
5. Reopen browser
6. Try logging in

---

### Issue #3: Changes Not Saved
**Symptom:** `grep "debug:" src/auth.ts` shows `debug: true`

**Fix:**
```bash
# Check if file was saved
cat src/auth.ts | grep "debug:"

# Should show: debug: false,
# If it shows: debug: true,

# Then edit src/auth.ts manually:
# Line 8: Change debug: true to debug: false
```

---

### Issue #4: Database Error
**Symptom:** Server logs show Prisma error

**Check terminal for:**
```
PrismaClientKnownRequestError
Can't reach database server
```

**Fix:**
```bash
# Check database connection
npx prisma studio

# If it fails, check your DATABASE_URL in .env.local
# Make sure Supabase project isn't paused
```

---

### Issue #5: Port Already in Use
**Symptom:** Server says port 3000 is in use

**Fix:**
```bash
# Kill process using port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Then restart
npm run dev
```

---

## 🧪 Manual Test Steps

### Test 1: Verify Server Changes

1. **Check auth config:**
```bash
grep -A5 "export const { handlers" src/auth.ts
```

Should show:
```typescript
export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: false,  // ✅ This must be false
  trustHost: true,
```

2. **Check for organization fetch:**
```bash
grep -A20 "const user = await prisma.user.findUnique" src/auth.ts | grep organization
```

Should show:
```
// ✅ REMOVED: organization object
```

---

### Test 2: Check Cookie Size

1. Open http://localhost:3000/login
2. F12 → Application → Cookies
3. **BEFORE logging in:** Should see no cookies
4. **Enter credentials** and click Sign in
5. **IMMEDIATELY check cookies:**
   - Should see 1 cookie: `next-auth.session-token`
   - Size should be ~1-2KB
   - Value should be a JWT token string

**If you see:**
- 100+ cookies → Cookie still too large, fix not applied
- "Failed to fetch" → Check server logs
- No cookies at all → Auth not working

---

### Test 3: Check Server Logs

**During login, terminal should show:**
```
[Auth] Attempting login for: princecjqlara@gmail.com
[Auth] Comparing passwords...
[Auth] Login successful for: princecjqlara@gmail.com
POST /login 303 in 1.5s
```

**NOT:**
```
[auth][debug]: CHUNKING_SESSION_COOKIE
Session cookie exceeds allowed 4096 bytes
Error: ...
```

---

## 🎯 Diagnostic Script

Run this to check everything:

```bash
# Save this as check-auth.sh or check-auth.bat

echo "=== Checking Auth Configuration ==="
echo ""
echo "1. Debug mode:"
grep "debug:" src/auth.ts
echo ""
echo "2. Organization fetch:"
grep -c "organization:" src/auth.ts
echo ""
echo "3. Build status:"
npm run build 2>&1 | grep -E "(✓|error)" | tail -n 3
echo ""
echo "4. Server status:"
curl -s http://localhost:3000/api/health || echo "Server not running"
echo ""
echo "=== Check Complete ==="
```

---

## 🔬 Deep Dive: What Happens During Login

### Normal Flow (Should work):
```
1. User enters credentials → [Login Page]
2. handleSubmit() called → [Client]
3. authenticate() server action → [Server]
4. signIn('credentials', {...}) → [NextAuth]
5. authorize() callback → [Auth Config]
6. Compare password → [Bcrypt]
7. Create JWT token → [NextAuth]
8. Set cookie (should be ~1KB) → [Browser]
9. Redirect to /dashboard → [Success!]
```

### Where It Can Fail:

**At Step 4-5:** NextAuth v5 beta issue
- **Fix:** Make sure NextAuth v5 is installed correctly

**At Step 7:** Cookie too large
- **Fix:** Debug mode disabled, no extra data

**At Step 8:** Cookie rejected by browser
- **Fix:** Cookie must be <4KB per chunk

**At Step 9:** Redirect fails
- **Fix:** Check middleware, NEXTAUTH_URL

---

## 🚨 Last Resort: Fresh Start

If nothing works, try a complete reset:

```bash
# 1. Stop server
Ctrl+C

# 2. Kill all node processes
taskkill /F /IM node.exe

# 3. Clear all build artifacts
rm -rf .next
rm -rf node_modules/.cache

# 4. Verify changes in code
cat src/auth.ts | grep "debug:"
# Must show: debug: false

# 5. Rebuild
npm run build

# 6. Start fresh
npm run dev

# 7. Clear browser completely
# Close browser, reopen, clear all data

# 8. Try login in incognito/private window
```

---

## 📊 What to Share if Still Not Working

If you're still seeing "Failed to fetch", please share:

### 1. Browser Console Output
```
F12 → Console → Copy all red errors
```

### 2. Network Tab
```
F12 → Network → Find the failed request → Copy as cURL
```

### 3. Server Terminal Output
```
Copy everything from when you click "Sign in"
```

### 4. Cookie Info
```
F12 → Application → Cookies → Screenshot
```

### 5. Auth Config
```bash
grep -A10 "export const { handlers" src/auth.ts
```

---

## ✅ Success Indicators

You'll know it's fixed when:

1. **Browser console shows:**
   ```
   [Login] Attempting sign in...
   [Login] Success!
   ```

2. **Network tab shows:**
   ```
   POST /login → 303 (Redirect)
   ```

3. **Cookies show:**
   ```
   1 cookie, ~1-2KB
   ```

4. **Page redirects to:**
   ```
   http://localhost:3000/dashboard
   ```

5. **Server logs show:**
   ```
   [Auth] Login successful
   POST /login 303 in <1s
   ```

---

## 🎯 Next Steps

1. **Follow Critical Checklist** (restart server, clear cookies)
2. **Check server terminal** for errors
3. **Check browser console** for errors
4. **Verify changes applied** (debug: false)
5. **Share error details** if still failing

---

**Created**: November 12, 2025  
**Status**: Diagnostic Guide  
**Purpose**: Debug persistent "Failed to fetch" errors

---

# 🚨 Most Common Fix: Just Restart Everything

**9 out of 10 times, this fixes it:**

```bash
# 1. Kill server
Ctrl+C (twice)

# 2. Clear cookies
F12 → Application → Clear site data

# 3. Restart server
npm run dev

# 4. Try logging in fresh
```

If that doesn't work, follow the detailed steps above!

