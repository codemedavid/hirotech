# 🔧 Database Migration Fix - Foreign Key Constraint

**Date:** November 12, 2025  
**Error:** `SyncJob_facebookPageId_fkey` violation  
**Status:** Fixable in 5 minutes

---

## 🐛 The Problem

**Error Message:**
```
Error: insert or update on table "SyncJob" violates foreign key 
constraint "SyncJob_facebookPageId_fkey"
```

**What this means:**
- You have SyncJob records in your database
- These records reference FacebookPages that were deleted
- Prisma can't apply schema changes until data is consistent

**Common causes:**
- Deleted a Facebook page connection
- Database was reset but SyncJob table wasn't cleared
- Manual database modifications

---

## ✅ Solution (Choose One)

### Option 1: SQL Fix (Recommended - 2 minutes)

1. **Go to Supabase Dashboard**
   - Open your project
   - Navigate to: **SQL Editor**

2. **Run this SQL:**
   ```sql
   -- Delete orphaned SyncJob records
   DELETE FROM "SyncJob"
   WHERE "facebookPageId" NOT IN (
     SELECT id FROM "FacebookPage"
   );
   ```

3. **Verify cleanup:**
   ```sql
   -- Should return 0
   SELECT COUNT(*) as orphaned_count
   FROM "SyncJob" sj
   LEFT JOIN "FacebookPage" fp ON fp.id = sj."facebookPageId"
   WHERE fp.id IS NULL;
   ```

4. **Now run Prisma:**
   ```bash
   npx prisma db push
   ```

### Option 2: Quick SQL File (Easier)

I've created `fix-syncjob-constraint.sql` for you:

1. Open Supabase SQL Editor
2. Copy contents from `fix-syncjob-constraint.sql`
3. Run the SQL
4. Then run: `npx prisma db push`

### Option 3: Nuclear Option (If Above Fails)

```sql
-- WARNING: Deletes ALL sync job history
TRUNCATE TABLE "SyncJob" CASCADE;
```

Then run: `npx prisma db push`

---

## 📋 Step-by-Step Guide

### Step 1: Fix the Data

**Run in Supabase SQL Editor:**
```sql
DELETE FROM "SyncJob"
WHERE "facebookPageId" NOT IN (
  SELECT id FROM "FacebookPage"
);
```

**Expected output:**
```
DELETE X
-- Where X is the number of orphaned records
```

### Step 2: Apply Schema Changes

**Run in terminal:**
```bash
npx prisma db push
```

**Expected output:**
```
✔ Generated Prisma Client
✔ The database is now in sync with your Prisma schema
```

### Step 3: Verify Changes Applied

**Check in SQL Editor:**
```sql
-- Should show leadScoreMin and leadScoreMax columns
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns
WHERE table_name = 'PipelineStage'
  AND column_name IN ('leadScoreMin', 'leadScoreMax');
```

**Expected result:**
```
leadScoreMin | integer | 0
leadScoreMax | integer | 100
```

---

## 🎯 What Happens After Fix

Once schema is applied, you'll have:

1. ✅ `PipelineStage.leadScoreMin` field
2. ✅ `PipelineStage.leadScoreMax` field
3. ✅ `Contact_stageId_leadScore_idx` index
4. ✅ All new features working!

Then you can:
- Configure score ranges via UI
- Re-assign all contacts
- See proper stage distribution

---

## 🚨 If Still Failing

### Check for Other Constraints

```sql
-- Find all foreign key constraints on SyncJob
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'SyncJob'
  AND tc.constraint_type = 'FOREIGN KEY';
```

### Verify FacebookPage Data

```sql
-- Check if you have FacebookPages
SELECT id, "pageName", "organizationId"
FROM "FacebookPage"
LIMIT 5;
```

### Check SyncJob Data

```sql
-- See what SyncJob records exist
SELECT id, "facebookPageId", status, "createdAt"
FROM "SyncJob"
ORDER BY "createdAt" DESC
LIMIT 10;
```

---

## 💡 Prevention

To prevent this in future:

**Option 1: Cascade Delete (Recommended)**

Your schema already has this (good!):
```prisma
model SyncJob {
  facebookPage   FacebookPage @relation(fields: [facebookPageId], references: [id], onDelete: Cascade)
}
```

This means when FacebookPage is deleted, SyncJobs auto-delete.

**Option 2: Clean Up Periodically**

```sql
-- Monthly cleanup of old completed sync jobs
DELETE FROM "SyncJob"
WHERE status IN ('COMPLETED', 'FAILED')
  AND "createdAt" < NOW() - INTERVAL '30 days';
```

---

## ✅ Summary

**Error:** Foreign key constraint violation  
**Cause:** Orphaned SyncJob records  
**Fix:** Delete orphaned records via SQL  
**Time:** 2-5 minutes  
**Then:** Run `npx prisma db push` successfully  

---

## 🎯 Quick Commands

```bash
# 1. Run SQL cleanup (in Supabase Dashboard)
DELETE FROM "SyncJob" WHERE "facebookPageId" NOT IN (SELECT id FROM "FacebookPage");

# 2. Apply schema (in terminal)
npx prisma db push

# 3. Verify (in Supabase)
SELECT * FROM "PipelineStage" LIMIT 1;
-- Should show leadScoreMin and leadScoreMax columns
```

---

**Next Step:** Run the SQL cleanup, then `npx prisma db push` will work! 🎉

