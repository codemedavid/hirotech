# ✅ Fix Prisma Migrations in Vercel - No SQL Needed!

## Goal

Use Prisma migrations automatically during Vercel builds - **no manual SQL needed!**

---

## The Problem

Prisma migrations are failing because `DIRECT_URL` environment variable isn't connecting properly to Supabase.

---

## Solution: Fix DIRECT_URL in Vercel

### Step 1: Get the Correct Connection String from Supabase

1. Go to: https://app.supabase.com/project/qudsmrrfbatasnyvuxch
2. Click **Settings** (gear icon) → **Database**
3. Scroll to **Connection string** section
4. Select **URI** tab
5. **Important:** Select **"Session" mode** (not Transaction mode)
6. Copy the connection string

It should look like:
```
postgresql://postgres.qudsmrrfbatasnyvuxch:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

**OR** if you see a different format, use:
```
postgresql://postgres:[YOUR-PASSWORD]@db.qudsmrrfbatasnyvuxch.supabase.co:5432/postgres
```

### Step 2: Update DIRECT_URL in Vercel

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Find `DIRECT_URL` (or create it if it doesn't exist)
3. Update the value with the connection string from Step 1
4. **Make sure:**
   - ✅ Port is **5432** (direct connection, not 6543)
   - ✅ NO `?pgbouncer=true` parameter
   - ✅ NO extra spaces or quotes
   - ✅ Password is correct
5. Enable for: **Production**, **Preview**, **Development**

### Step 3: Verify DATABASE_URL is Also Set

Make sure `DATABASE_URL` is set correctly (for app queries):

```
postgresql://postgres.qudsmrrfbatasnyvuxch:demet5732595@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Note:** This uses port **6543** with `?pgbouncer=true` (for connection pooling)

---

## Alternative: Use Transaction Mode for Both (If Direct Doesn't Work)

If the direct connection (port 5432) still doesn't work, you can try using the pooler for both:

**DATABASE_URL:**
```
postgresql://postgres.qudsmrrfbatasnyvuxch:demet5732595@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**DIRECT_URL (try with pooler):**
```
postgresql://postgres.qudsmrrfbatasnyvuxch:demet5732595@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**⚠️ Note:** This might not work for all migrations, but Prisma will try to use it.

---

## How Prisma Migrations Work

With the correct setup:

1. **During Vercel Build:**
   ```
   prisma generate        # Generates Prisma Client
   prisma migrate deploy  # Runs pending migrations automatically
   next build             # Builds your Next.js app
   ```

2. **Prisma automatically:**
   - ✅ Connects to database using `DIRECT_URL`
   - ✅ Checks which migrations have been applied
   - ✅ Runs only new migrations
   - ✅ Updates the `_prisma_migrations` table
   - ✅ No manual SQL needed!

3. **After deployment:**
   - ✅ Database schema is up to date
   - ✅ All migrations applied automatically
   - ✅ No manual intervention needed

---

## Verify It's Working

After setting the correct `DIRECT_URL` and redeploying:

1. **Check build logs** - should see:
   ```
   ✔ Generated Prisma Client
   ✔ Applied migration: [migration_name]
   ✔ Build completed
   ```

2. **No errors** about "Tenant or user not found"

3. **Database is updated** - check Supabase Dashboard → Table Editor

---

## Troubleshooting

### Still Getting "Tenant or user not found"?

**Check:**
1. Password is correct in Supabase Dashboard
2. Connection string format matches exactly (no extra spaces)
3. Port is 5432 for DIRECT_URL
4. Database is not paused in Supabase

### Migrations Run But App Still Has Errors?

**Check:**
1. `DATABASE_URL` is set correctly (port 6543 with pooling)
2. Both URLs use the same password
3. Prisma Client is regenerated after migrations

### Want to Skip Migrations Temporarily?

If you need to deploy now and fix migrations later:

**Update `vercel.json`:**
```json
{
  "buildCommand": "prisma generate && next build"
}
```

This skips migrations. You can run them manually later via:
```bash
npx prisma migrate deploy
```

---

## Summary

✅ **Prisma handles all migrations automatically**  
✅ **No manual SQL needed**  
✅ **Just need correct `DIRECT_URL` in Vercel**  
✅ **Migrations run during every deployment**

**Next Step:** Get the correct connection string from Supabase Dashboard and update `DIRECT_URL` in Vercel! 🚀

