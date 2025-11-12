# 🚨 URGENT: Database Connection Issues - Fix Now

**Date:** November 12, 2025  
**Critical Issues:** Wrong port + Connection pool exhausted

---

## 🔴 Critical Errors Detected

### Error 1: Wrong Database Port
```
Can't reach database server at aws-1-ap-southeast-2.pooler.supabase.com:6543
```

**Problem:** Your DATABASE_URL is using port **6543** (wrong!)  
**Should be:** Port **5432** or **6543** with **?pgbouncer=true**

### Error 2: Connection Pool Exhausted
```
Timed out fetching a new connection from the connection pool
Current connection pool timeout: 10, connection limit: 21
```

**Problem:** Too many database connections, pool exhausted

---

## ✅ IMMEDIATE FIX (5 minutes)

### Step 1: Fix Your .env File

**Open your `.env` or `.env.local` file**

**Find these lines:**
```bash
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

**They should look like this:**

```bash
# Connection Pooler (for Serverless/API Routes)
DATABASE_URL="postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Direct Connection (for migrations/scripts)
DIRECT_URL="postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
```

**Key points:**
- DATABASE_URL uses port **6543** with **`?pgbouncer=true&connection_limit=1`**
- DIRECT_URL uses port **5432** (no pgbouncer)
- Add `connection_limit=1` to DATABASE_URL for serverless

**Get correct URLs from:**
- Supabase Dashboard → Settings → Database
- Look for "Connection Pooling" section

### Step 2: Update Prisma Client Configuration

**Edit:** `src/lib/db.ts`

**Replace entire file with:**

```typescript
import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

// Graceful connection cleanup
export async function disconnectPrisma() {
  await prisma.$disconnect();
}

// For serverless environments, disconnect after each request
if (process.env.NODE_ENV === 'production') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}
```

### Step 3: Restart Dev Server

```bash
# Stop current server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 4: Verify Connection

```bash
# Test database connection
npx prisma db pull
```

Should work without errors!

---

## 📋 Correct Environment Variables

**Your .env should have:**

```bash
# Supabase Database (Connection Pooler)
DATABASE_URL="postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=10"

# Supabase Database (Direct Connection)
DIRECT_URL="postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"

# Supabase Project
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Google AI Keys (for analysis)
GOOGLE_AI_API_KEY=your_key_1
GOOGLE_AI_API_KEY_2=your_key_2
# ... up to GOOGLE_AI_API_KEY_12

# Facebook App
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_verify_token

# NextAuth
NEXTAUTH_SECRET=your_secret_here
NEXTAUTH_URL=http://localhost:3000
```

---

## 🔍 Why Port Matters

### Port 5432 (Direct Connection)
- Standard PostgreSQL port
- Direct connection to database
- Use for: Migrations, scripts, Prisma Studio
- **Not recommended for API routes** (limited connections)

### Port 6543 (Connection Pooler)
- Supabase's PgBouncer pooler
- Handles connection pooling
- Use for: API routes, serverless functions
- **Must include:** `?pgbouncer=true&connection_limit=1`

**Your error showed port 6543 WITHOUT pgbouncer=true** - that's the problem!

---

## 🔧 Connection Pool Best Practices

### For Serverless (Vercel, etc.)

```bash
# Always use connection pooler with limit=1
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
```

### For Traditional Server

```bash
# Can use higher connection limits
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10"
```

### For Development

```bash
# Use pooler with low limit
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20"
```

---

## 🚨 After Fixing .env

### Step 1: Clean Up

```bash
# Stop dev server
# Delete .next folder
rm -rf .next

# Regenerate Prisma Client
npx prisma generate
```

### Step 2: Test Connection

```bash
# Should connect successfully
npx prisma db pull
```

### Step 3: Apply Schema Changes

**First, fix orphaned SyncJobs in Supabase SQL Editor:**
```sql
DELETE FROM "SyncJob"
WHERE "facebookPageId" NOT IN (SELECT id FROM "FacebookPage");
```

**Then run:**
```bash
npx prisma db push
```

### Step 4: Restart Dev Server

```bash
npm run dev
```

---

## ✅ Verification Checklist

After fixes:

- [ ] No port 6543 errors (should connect)
- [ ] No connection pool timeout errors
- [ ] `npx prisma db push` succeeds
- [ ] leadScoreMin/Max columns exist in PipelineStage
- [ ] Dev server starts without errors
- [ ] Pipeline page loads
- [ ] "Score Ranges" button appears
- [ ] Can configure and save ranges
- [ ] Re-assign works without timeouts

---

## 💡 Quick Reference

**Problem:** Can't reach database at port 6543  
**Fix:** Add `?pgbouncer=true&connection_limit=1` to DATABASE_URL

**Problem:** Connection pool timeout  
**Fix:** Use connection pooler with `connection_limit=1`

**Problem:** Schema won't push  
**Fix:** Clean up orphaned SyncJob records first

---

## 🎯 Complete Fix Commands

```bash
# 1. Fix .env file (manually edit)
#    Add ?pgbouncer=true&connection_limit=1 to DATABASE_URL

# 2. Clean up
rm -rf .next
npx prisma generate

# 3. Fix orphaned data (in Supabase SQL Editor)
#    DELETE FROM "SyncJob" WHERE "facebookPageId" NOT IN (SELECT id FROM "FacebookPage");

# 4. Apply schema
npx prisma db push

# 5. Restart
npm run dev
```

---

**Status:** 🔴 CRITICAL - Fix these database issues first!

Once fixed, all your new auto-pipeline features will work perfectly! 🚀

