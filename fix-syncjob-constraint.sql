-- Fix SyncJob Foreign Key Constraint Issue
-- Run this SQL in your Supabase SQL Editor before running prisma db push

-- Step 1: Check for orphaned SyncJob records
SELECT 
  sj.id,
  sj."facebookPageId",
  sj.status,
  sj."createdAt"
FROM "SyncJob" sj
LEFT JOIN "FacebookPage" fp ON fp.id = sj."facebookPageId"
WHERE fp.id IS NULL;

-- Step 2: Delete orphaned SyncJob records (those without matching FacebookPage)
DELETE FROM "SyncJob"
WHERE "facebookPageId" NOT IN (
  SELECT id FROM "FacebookPage"
);

-- Step 3: Verify cleanup
SELECT COUNT(*) as orphaned_count
FROM "SyncJob" sj
LEFT JOIN "FacebookPage" fp ON fp.id = sj."facebookPageId"
WHERE fp.id IS NULL;
-- Should return: orphaned_count = 0

-- Step 4: Now you can safely run: npx prisma db push

