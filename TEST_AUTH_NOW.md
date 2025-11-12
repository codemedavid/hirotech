# 🧪 Test Your Authentication NOW

**What Was Fixed**: Session cookie reduced from 533KB → ~1KB  
**Error Fixed**: "Failed to fetch" after login  
**Status**: ✅ Ready to test

---

## 🚀 Quick Test (5 minutes)

### Step 1: Start Fresh
```bash
# Kill any running servers
# Ctrl+C in terminal where dev server runs

# Start dev server
npm run dev
```

### Step 2: Clear Browser Cookies

**Chrome/Edge:**
1. F12 (DevTools)
2. Application tab
3. Storage → Cookies → http://localhost:3000
4. Right-click → Clear
5. Or click "Clear site data"

**Firefox:**
1. F12 (DevTools)
2. Storage tab
3. Cookies → http://localhost:3000
4. Right-click → Delete All

### Step 3: Test Login
```
1. Go to: http://localhost:3000/login
2. Email: princecjqlara@gmail.com
3. Password: (your password)
4. Click "Sign in"
```

### Step 4: Verify Success

**What you should see:**
- ✅ Login succeeds
- ✅ Redirects to /dashboard
- ✅ NO "Failed to fetch" error
- ✅ You stay logged in

**What you should NOT see:**
- ❌ "Failed to fetch" error
- ❌ Stuck on login page
- ❌ Redirect loop

---

## 🔍 Check Cookie Size

### In DevTools
```
1. F12 → Application → Cookies
2. Find: next-auth.session-token
3. Look at "Size" column
```

**Expected:**
- ✅ ONE cookie (not 100+)
- ✅ Size: ~1-2 KB
- ✅ Value: JWT token string

**Bad (OLD behavior):**
- ❌ 100+ cookies (next-auth.session-token.0, .1, .2, ...)
- ❌ Size: >10KB total
- ❌ "CHUNKING_SESSION_COOKIE" in console

---

## 🎯 Test Registration Too

### Step 1: Register New User
```
1. Go to: http://localhost:3000/register
2. Fill in:
   - Organization: "Test Org"
   - Name: "Test User"
   - Email: test@example.com
   - Password: TestPassword123!
3. Click "Register"
```

### Step 2: Verify
- ✅ Registration succeeds
- ✅ Automatically logged in
- ✅ Redirects to dashboard
- ✅ Cookie is small (<2KB)

---

## 📊 What to Look For

### Console Logs (Should NOT see):
```
❌ [auth][debug]: CHUNKING_SESSION_COOKIE
❌ Session cookie exceeds allowed 4096 bytes
❌ Failed to fetch
```

### Console Logs (Should see):
```
✅ [Auth] Attempting login for: princecjqlara@gmail.com
✅ [Auth] Comparing passwords...
✅ [Auth] Login successful for: princecjqlara@gmail.com
✅ POST /login 303 in <1s
```

---

## 🐛 If It Doesn't Work

### Issue: Still see "Failed to fetch"

**Fix:**
1. Make sure you cleared ALL cookies
2. Make sure dev server restarted
3. Check src/auth.ts has `debug: false`
4. Check for errors in terminal

### Issue: Still see CHUNKING_SESSION_COOKIE

**Fix:**
1. Verify changes were saved in src/auth.ts
2. Restart dev server (Ctrl+C, then `npm run dev`)
3. Clear browser cache and cookies
4. Try in incognito/private window

### Issue: Login succeeds but redirects to login again

**Fix:**
1. Check middleware.ts
2. Verify NEXTAUTH_SECRET in .env.local
3. Check cookie settings (httpOnly, sameSite, secure)

---

## 🧪 Automated Test (Optional)

If you want to run automated tests:

```bash
# Make sure dev server is running first
npm run dev

# In another terminal:
npx tsx scripts/test-auth.ts
```

**Note:** This will:
- Test registration with new user
- Test login
- Check cookie sizes
- Verify authentication flow

---

## ✅ Success Checklist

After testing, you should have:
- [ ] Login works without errors
- [ ] Session cookie is <2KB
- [ ] Dashboard loads after login
- [ ] No "Failed to fetch" errors
- [ ] Console is clean (no CHUNKING errors)
- [ ] Only ONE session cookie (not 100+)

---

## 📞 If You Need Help

### Check These First:
1. Did you restart dev server?
2. Did you clear cookies?
3. Is `debug: false` in src/auth.ts?
4. Are you using correct password?

### What to Share:
1. Screenshot of cookie in DevTools
2. Console errors (if any)
3. Terminal output from dev server
4. Which step failed

---

## 🎉 Expected Result

**Before (BROKEN):**
```
Login → "Failed to fetch" → Stuck on login page
Cookie: 533KB (130 chunks)
```

**After (FIXED):**
```
Login → Success → Dashboard
Cookie: ~1KB (1 chunk)
```

---

## 🚀 Ready to Deploy?

Once login works locally, you're ready to deploy to Vercel:

```bash
# Build check
npm run build

# Deploy
vercel

# Or
npm run deploy
```

Make sure to set environment variables in Vercel dashboard:
- DATABASE_URL
- DIRECT_URL
- NEXTAUTH_SECRET
- NEXTAUTH_URL (production URL)
- FACEBOOK_APP_ID
- FACEBOOK_APP_SECRET
- etc.

---

**Last Updated**: November 12, 2025  
**Issue Fixed**: Session Cookie 533KB → 1KB  
**Status**: ✅ Ready to test  
**Next Step**: Test login now! 🚀

