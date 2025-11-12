# 🚀 Supabase Realtime Setup Guide

**For:** Real-time Pipeline Updates  
**Compatible with:** Vercel, Prisma ORM  
**Cost:** Free (included with Supabase)

---

## Step 1: Enable Realtime in Supabase Dashboard

### Option A: Via Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Navigate to **Database** → **Replication**
3. Find the **Contact** table
4. Click on it to expand
5. Enable the following:
   - ✅ **INSERT** events
   - ✅ **UPDATE** events  
   - ✅ **DELETE** events
6. Click **Save** or **Apply**

**That's it for the Contact table!**

### Option B: Via SQL (If Dashboard Doesn't Work)

Run this SQL in Supabase SQL Editor:

```sql
-- Enable realtime for Contact table
ALTER PUBLICATION supabase_realtime ADD TABLE "Contact";

-- Verify it's enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
```

You should see `Contact` in the results.

---

## Step 2: Verify Environment Variables

Check you have these in your `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

If missing, get them from:
- Supabase Dashboard → Settings → API
- Copy the URL and `anon` public key

---

## Step 3: Test Realtime Connection

After enabling replication, test with this simple script:

```typescript
// Test in browser console on your app
const { createClient } = await import('./src/lib/supabase/client');
const supabase = createClient();

const channel = supabase
  .channel('test-channel')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'Contact' },
    (payload) => console.log('Change received!', payload)
  )
  .subscribe((status) => console.log('Status:', status));

// Should log: Status: SUBSCRIBED
// Then update a contact in another tab
// Should log: Change received! { ... }
```

---

## How It Works

### Database → Broadcast Flow

```
1. Your app calls Prisma:
   await prisma.contact.update({ ... })

2. PostgreSQL updates the Contact table

3. Supabase detects the change (via replication)

4. Supabase broadcasts to all subscribed clients

5. Your React hook receives the event

6. UI updates instantly! ✨
```

### No Code Changes to Mutations!

The beauty of Supabase Realtime:
- Works at **database level**
- Prisma doesn't need to know about it
- Any Contact update triggers broadcast
- Zero changes to existing APIs

---

## What Gets Broadcast

When you enable replication, Supabase sends:

```javascript
{
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  table: 'Contact',
  schema: 'public',
  new: { /* new row data */ },
  old: { /* old row data (for UPDATE/DELETE) */ },
  timestamp: '2025-11-12T...'
}
```

Our hook uses this to trigger refetch!

---

## Troubleshooting

### Issue: "Status: CHANNEL_ERROR"

**Cause:** Realtime not enabled for table

**Fix:**
1. Check Supabase Dashboard → Database → Replication
2. Ensure Contact table is enabled
3. Or run the SQL command above

### Issue: "Status: SUBSCRIBED" but no events

**Cause:** Filter might be too restrictive

**Fix:**
```typescript
// Try without filter first
.on('postgres_changes', 
  { event: '*', schema: 'public', table: 'Contact' }, // No filter
  (payload) => console.log(payload)
)
```

### Issue: Rate limits

**Cause:** Too many concurrent connections

**Fix:**
- Supabase free tier: 200 concurrent connections
- Should be plenty for your use case
- If hit limit, upgrade Supabase plan

---

## Security Note

The `anon` key is public (safe to expose in client).

Row Level Security (RLS) on Supabase ensures users only see their organization's data.

If you haven't set up RLS yet, add this SQL:

```sql
-- Enable RLS on Contact table
ALTER TABLE "Contact" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see contacts from their organization
CREATE POLICY "Users can view own org contacts"
ON "Contact"
FOR SELECT
USING (
  "organizationId" IN (
    SELECT "organizationId" 
    FROM "User" 
    WHERE id = auth.uid()
  )
);
```

---

## Performance

### Supabase Realtime Limits (Free Tier)

- **200k messages per day** - More than enough for pipeline updates
- **100 concurrent connections** - Plenty for your users
- **<100ms latency** - Near instant updates

### Estimated Usage

```
10 users × 8 hours × 10 updates/hour = 800 messages/day
800 / 200,000 = 0.4% of free tier used
```

You're well within limits! ✅

---

## Next Steps

1. ✅ Enable replication (5 minutes)
2. ✅ Code implementation (done by AI)
3. ✅ Test connection
4. ✅ Deploy to Vercel
5. ✅ Enjoy instant updates!

---

**Status:** Ready to implement after enabling replication  
**Complexity:** Low (Supabase handles everything)  
**Cost:** Free  
**Works on Vercel:** ✅ Yes

