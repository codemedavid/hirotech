# 🔧 Environment Variables Fix - Quick Guide

## ✅ Your Environment is Configured Correctly!

I've verified your `.env.local` file has the correct database URLs:

```bash
DATABASE_URL="postgresql://...@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true" ✅
DIRECT_URL="postgresql://...@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres" ✅
```

**The issue**: Your dev server needs to be restarted to pick up these variables.

---

## 🚀 Quick Fix (Choose One Method)

### Method 1: Use Restart Script (Recommended)

**Mac/Linux**:
```bash
./restart-with-env.sh
```

**Windows**:
```bash
restart-with-env.bat
```

**What it does**:
1. Stops running dev servers
2. Clears Next.js cache
3. Clears Prisma cache
4. Verifies environment variables
5. Regenerates Prisma Client
6. Starts dev server

---

### Method 2: Manual Steps

```bash
# 1. Stop dev server (Ctrl+C in terminal)

# 2. Clear caches
rm -rf .next
rm -rf node_modules/.prisma

# 3. Regenerate Prisma
npx prisma generate

# 4. Start dev server
npm run dev
```

---

## 🧪 Verify It's Fixed

After restarting, test these:

### 1. Check Integrations Page
```
Visit: http://localhost:3000/settings/integrations
Expected: Should load without database errors
```

### 2. Check Console
```
Should NOT see: "URL must start with prisma://"
Should see: Normal startup logs
```

### 3. Test Database Connection
```bash
npx prisma db pull
# Should succeed without errors
```

---

## 🔍 Why This Happened

**Root Cause**: Environment variables aren't automatically reloaded when you change `.env.local`

**When you need to restart**:
- ✅ After changing `.env.local`
- ✅ After updating DATABASE_URL
- ✅ After updating any env variables
- ✅ After `git pull` if env vars changed

**When you DON'T need to restart**:
- ❌ After code changes (hot reload works)
- ❌ After adding new files
- ❌ After npm install (usually)

---

## 🆘 Still Not Working?

### Issue 1: "Cannot find module @prisma/client"
```bash
npm install
npx prisma generate
npm run dev
```

### Issue 2: "DATABASE_URL is empty"
Check your `.env.local` file:
```bash
cat .env.local | grep DATABASE_URL
# Should show the URL
```

If empty or missing:
1. Copy URLs from Supabase Dashboard
2. Paste into `.env.local`
3. Restart dev server

### Issue 3: Still getting database errors

**Check Supabase Connection**:
1. Go to Supabase Dashboard
2. Project Settings → Database
3. Test connection
4. Copy fresh URLs if needed

**Check Database Status**:
```bash
npx prisma db pull
# Should succeed
```

**Check Prisma Client**:
```bash
npx prisma validate
# Should say "Schema is valid"
```

---

## 📚 Related Documentation

- `FIX_DATABASE_NOW.md` - Database connection pool fix
- `DATABASE_CONNECTION_POOL_FIX.md` - Complete technical guide
- `STOP_SYNC_FEATURE.md` - New stop sync feature

---

## ✅ Current Status

**Environment Variables**: ✅ Configured correctly in `.env.local`
**Prisma Client**: ✅ Regenerated successfully
**Caches**: ✅ Cleared

**Next Step**: **Start your dev server using one of the methods above!**

---

## 🎯 Quick Command Reference

```bash
# Restart dev server (recommended)
./restart-with-env.sh

# Or manually:
rm -rf .next && npx prisma generate && npm run dev

# Check environment
cat .env.local | grep DATABASE

# Test database connection
npx prisma db pull

# Validate schema
npx prisma validate
```

---

**Issue**: Environment variables not loaded
**Solution**: Restart dev server
**Status**: ✅ **READY TO START**

**Just run `./restart-with-env.sh` and you're done!** 🚀
