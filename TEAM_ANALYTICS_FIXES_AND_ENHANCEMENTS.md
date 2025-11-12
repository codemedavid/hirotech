# Team Analytics - Fixes & Enhancements Implementation Guide

**Date:** November 12, 2025  
**Priority:** High - Ready for Implementation

---

## Quick Fixes (Implement These First)

### 1. Add Missing Database Index (5 minutes)

**Issue:** Queries filtering by type are slower than optimal

**File:** `prisma/schema.prisma`

**Change:**
```prisma
model TeamActivity {
  id         String           @id @default(cuid())
  teamId     String
  memberId   String?
  type       TeamActivityType
  action     String
  entityType String?
  entityId   String?
  entityName String?
  metadata   Json?
  ipAddress  String?
  userAgent  String?
  duration   Int?
  createdAt  DateTime         @default(now())
  member     TeamMember?      @relation(fields: [memberId], references: [id])
  team       Team             @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@index([teamId, createdAt])
  @@index([memberId, createdAt])
  @@index([type, createdAt])
  @@index([entityType, entityId])
  @@index([teamId, type, createdAt])  // ← ADD THIS LINE
}
```

**Apply:**
```bash
npx prisma db push
```

**Impact:** 3-5x faster filtered queries

---

### 2. Add Page Filtering to Heatmap (2 hours)

**Issue:** Can't filter activities by FacebookPage

#### Step 1: Update API Endpoint

**File:** `src/app/api/teams/[id]/activities/route.ts`

**Add after line 33:**
```typescript
const pageId = searchParams.get('pageId')
```

**Add to where clause (around line 82):**
```typescript
if (view === 'heatmap') {
  // ... existing code
  const days = parseInt(searchParams.get('days') || '30')
  const pageId = searchParams.get('pageId')  // ADD THIS
  const heatmap = await getActivityHeatmap(id, days, pageId)  // ADD pageId parameter
  return NextResponse.json({ heatmap })
}
```

#### Step 2: Update Activity Service

**File:** `src/lib/teams/activity.ts`

**Update function signature (line 262):**
```typescript
export async function getActivityHeatmap(
  teamId: string,
  days: number = 30,
  pageId?: string  // ADD THIS
) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  // Build where clause
  const where: any = {
    teamId,
    createdAt: { gte: startDate }
  }
  
  // ADD THIS: Filter by page
  if (pageId) {
    where.OR = [
      { entityType: 'FacebookPage', entityId: pageId },
      { entityType: 'Campaign', metadata: { path: ['facebookPageId'], equals: pageId } }
    ]
  }
  
  // Fetch all activities within the date range
  const activities = await prisma.teamActivity.findMany({
    where,
    select: {
      createdAt: true
    }
  })
  
  // ... rest of function
}
```

#### Step 3: Add Page Filter to UI

**File:** `src/components/teams/enhanced-activity-heatmap.tsx`

**Add state (after line 37):**
```typescript
const [selectedPage, setSelectedPage] = useState<string>('all')
const [pages, setPages] = useState<FacebookPage[]>([])
```

**Add interface:**
```typescript
interface FacebookPage {
  id: string
  pageName: string
}
```

**Add fetch pages effect (after line 52):**
```typescript
// Fetch Facebook pages
useEffect(() => {
  if (isAdmin) {
    fetchPages()
  }
}, [teamId, isAdmin])

async function fetchPages() {
  try {
    const response = await fetch('/api/facebook/pages/connected')
    if (response.ok) {
      const data = await response.json()
      setPages(data.pages)
    }
  } catch (error) {
    console.error('Error fetching pages:', error)
  }
}
```

**Update fetchHeatmapData (around line 78):**
```typescript
async function fetchHeatmapData() {
  setLoading(true)
  try {
    let url = `/api/teams/${teamId}/activities?view=heatmap&days=${days}`
    
    if (selectedMember && selectedMember !== 'all') {
      url += `&memberId=${selectedMember}`
    }
    
    // ADD THIS
    if (selectedPage && selectedPage !== 'all') {
      url += `&pageId=${selectedPage}`
    }
    
    if (dateRange.from) {
      url += `&startDate=${dateRange.from.toISOString()}`
    }
    
    if (dateRange.to) {
      url += `&endDate=${dateRange.to.toISOString()}`
    }

    const response = await fetch(url)
    // ... rest
  }
}
```

**Add page filter dropdown (after line 203):**
```typescript
{/* Page Filter */}
{isAdmin && pages.length > 0 && (
  <div className="space-y-2">
    <Label htmlFor="page-filter">Filter by Page</Label>
    <Select value={selectedPage} onValueChange={setSelectedPage}>
      <SelectTrigger id="page-filter">
        <SelectValue placeholder="All pages" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Pages</SelectItem>
        {pages.map((page) => (
          <SelectItem key={page.id} value={page.id}>
            {page.pageName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}
```

**Update reset filters (line 144):**
```typescript
function resetFilters() {
  setSelectedMember('all')
  setSelectedPage('all')  // ADD THIS
  setDays('30')
  setDateRange({ from: undefined, to: undefined })
}
```

**Update filter info display (line 304):**
```typescript
<div className="flex items-center gap-2 text-xs text-muted-foreground">
  <span>Showing:</span>
  {selectedMember !== 'all' && (
    <span className="px-2 py-1 bg-muted rounded">
      {members.find(m => m.id === selectedMember)?.user.name || 'Selected member'}
    </span>
  )}
  {selectedPage !== 'all' && (
    <span className="px-2 py-1 bg-muted rounded">
      {pages.find(p => p.id === selectedPage)?.pageName || 'Selected page'}
    </span>
  )}
  <span className="px-2 py-1 bg-muted rounded">
    {dateRange.from && dateRange.to
      ? `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd, yyyy')}`
      : `Last ${days} days`}
  </span>
</div>
```

---

### 3. Create Missing Worker Script (1 hour)

**Issue:** Worker script is documented but doesn't exist

**Create File:** `scripts/start-worker.ts`

```typescript
#!/usr/bin/env tsx

import { Worker, Queue } from 'bullmq'
import { prisma } from '../src/lib/db'
import axios from 'axios'

// Get Redis URL from environment
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

console.log('🚀 Starting Campaign Worker...')
console.log(`📡 Redis URL: ${redisUrl}`)

// Create worker to process messages
const worker = new Worker(
  'messages',
  async (job) => {
    const { campaignId, contactId, platform, content, messageTag, pageAccessToken, recipientId } = job.data

    try {
      // Send message via Facebook API
      const apiUrl =
        platform === 'messenger'
          ? `https://graph.facebook.com/v18.0/me/messages`
          : `https://graph.facebook.com/v18.0/me/messages`

      const payload: any = {
        recipient: { id: recipientId },
        message: { text: content },
      }

      if (messageTag) {
        payload.messaging_type = 'MESSAGE_TAG'
        payload.tag = messageTag
      }

      const response = await axios.post(apiUrl, payload, {
        params: { access_token: pageAccessToken },
      })

      // Update campaign stats
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          sentCount: { increment: 1 },
        },
      })

      console.log(`✅ Message sent to ${recipientId}`)
      return { success: true, messageId: response.data.message_id }
    } catch (error: any) {
      console.error(`❌ Failed to send message to ${recipientId}:`, error.message)

      // Update failed count
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          failedCount: { increment: 1 },
        },
      })

      throw error
    }
  },
  {
    connection: redisUrl as any,
    concurrency: 5, // Process 5 messages concurrently
    limiter: {
      max: 10, // Max 10 jobs per duration
      duration: 1000, // Per 1 second
    },
  }
)

// Event handlers
worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message)
})

worker.on('error', (err) => {
  console.error('Worker error:', err)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⏸️  Shutting down worker...')
  await worker.close()
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('⏸️  Shutting down worker...')
  await worker.close()
  await prisma.$disconnect()
  process.exit(0)
})

console.log('✅ Worker started and listening for jobs')
```

**Update:** `package.json`

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "worker": "tsx scripts/start-worker.ts",
    "dev:all": "concurrently \"npm run dev\" \"npm run worker\"",
    // ... other scripts
  }
}
```

**Install Missing Dependencies (if not already):**
```bash
npm install bullmq ioredis concurrently
npm install -D tsx
```

---

## Medium Priority Enhancements

### 4. Add API Rate Limiting (2 hours)

**Issue:** No rate limiting on API endpoints

**Install Package:**
```bash
npm install express-rate-limit
```

**Create Middleware:** `src/middleware/rate-limit.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(options: {
  windowMs: number
  max: number
  message?: string
}) {
  return async (req: NextRequest) => {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const now = Date.now()
    const key = `${ip}:${req.nextUrl.pathname}`

    // Get or create rate limit entry
    let rateLimit = rateLimitMap.get(key)
    
    if (!rateLimit || now > rateLimit.resetTime) {
      rateLimit = {
        count: 0,
        resetTime: now + options.windowMs
      }
      rateLimitMap.set(key, rateLimit)
    }

    // Increment counter
    rateLimit.count++

    // Check if exceeded
    if (rateLimit.count > options.max) {
      return NextResponse.json(
        { error: options.message || 'Too many requests' },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimit.resetTime - now) / 1000).toString()
          }
        }
      )
    }

    return null // Allow request
  }
}

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}, 60000)
```

**Apply to Activities Endpoint:**

**File:** `src/app/api/teams/[id]/activities/route.ts`

```typescript
import { rateLimit } from '@/middleware/rate-limit'

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many analytics requests. Please try again later.'
})

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  // Check rate limit
  const rateLimitResponse = await analyticsLimiter(request)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // ... existing code
  }
}
```

---

### 5. Optimize Database Queries (3 hours)

**Issue:** Multiple separate queries for metrics

**File:** `src/lib/teams/activity.ts`

**Replace getMemberEngagementMetrics function (starting line 205):**

```typescript
export async function getMemberEngagementMetrics(
  teamId: string,
  memberId: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: any = { teamId, memberId }
  
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = startDate
    if (endDate) where.createdAt.lte = endDate
  }
  
  // Use single query with aggregation
  const result = await prisma.$queryRaw<Array<{
    total: bigint
    messages: bigint
    tasks: bigint
    pages: bigint
    time_spent: bigint | null
  }>>`
    SELECT 
      COUNT(*)::bigint as total,
      COUNT(*) FILTER (WHERE type = 'SEND_MESSAGE')::bigint as messages,
      COUNT(*) FILTER (WHERE type = 'COMPLETE_TASK')::bigint as tasks,
      COUNT(*) FILTER (WHERE type = 'VIEW_PAGE')::bigint as pages,
      SUM(duration)::bigint as time_spent
    FROM "TeamActivity"
    WHERE "teamId" = ${teamId}
      AND "memberId" = ${memberId}
      ${startDate ? Prisma.sql`AND "createdAt" >= ${startDate}` : Prisma.empty}
      ${endDate ? Prisma.sql`AND "createdAt" <= ${endDate}` : Prisma.empty}
  `
  
  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { totalTimeSpent: true }
  })
  
  const row = result[0] || {
    total: 0n,
    messages: 0n,
    tasks: 0n,
    pages: 0n,
    time_spent: 0n
  }
  
  return {
    totalActivities: Number(row.total),
    messagesSent: Number(row.messages),
    tasksCompleted: Number(row.tasks),
    pagesAccessed: Number(row.pages),
    totalTimeSpent: member?.totalTimeSpent || 0,
    averageSessionDuration: Number(row.time_spent) || 0
  }
}
```

**Note:** Import Prisma at top:
```typescript
import { Prisma } from '@prisma/client'
```

**Impact:** Reduces 5 queries to 2 queries (2.5x faster)

---

### 6. Add Redis Caching (4 hours)

**Install Package:**
```bash
npm install ioredis
```

**Create Redis Client:** `src/lib/redis.ts`

```typescript
import Redis from 'ioredis'

let redis: Redis | null = null

export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    console.warn('⚠️  REDIS_URL not configured. Caching disabled.')
    return null
  }

  if (!redis) {
    try {
      redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) return null
          return Math.min(times * 200, 1000)
        }
      })

      redis.on('error', (error) => {
        console.error('Redis error:', error)
      })

      redis.on('connect', () => {
        console.log('✅ Redis connected')
      })
    } catch (error) {
      console.error('Failed to create Redis client:', error)
      return null
    }
  }

  return redis
}

// Helper function to cache with TTL
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient()
  if (!redis) return null

  try {
    const cached = await redis.get(key)
    return cached ? JSON.parse(cached) : null
  } catch (error) {
    console.error('Cache get error:', error)
    return null
  }
}

export async function cacheSet(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch (error) {
    console.error('Cache set error:', error)
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return

  try {
    await redis.del(key)
  } catch (error) {
    console.error('Cache delete error:', error)
  }
}
```

**Apply Caching to Heatmap:**

**File:** `src/lib/teams/activity.ts`

```typescript
import { cacheGet, cacheSet } from '@/lib/redis'

export async function getActivityHeatmap(
  teamId: string,
  days: number = 30,
  pageId?: string
) {
  // Check cache first
  const cacheKey = `heatmap:${teamId}:${days}:${pageId || 'all'}`
  const cached = await cacheGet<Record<string, Record<number, number>>>(cacheKey)
  
  if (cached) {
    console.log('✅ Heatmap cache hit')
    return cached
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  // ... existing query logic ...
  
  // Cache for 5 minutes
  await cacheSet(cacheKey, heatmap, 300)
  
  return heatmap
}
```

**Invalidate Cache on New Activity:**

**File:** `src/lib/teams/activity.ts`

```typescript
import { cacheDelete } from '@/lib/redis'

export async function logActivity(options: ActivityLogOptions) {
  const activity = await prisma.teamActivity.create({
    data: {
      ...options,
      metadata: options.metadata ? (options.metadata as Prisma.InputJsonValue) : undefined
    }
  })

  // Invalidate heatmap cache for this team
  const redis = getRedisClient()
  if (redis) {
    const keys = await redis.keys(`heatmap:${options.teamId}:*`)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  }

  return activity
}
```

---

## Low Priority Enhancements

### 7. Add Real-time Updates with WebSocket (8 hours)

**Not Critical** - Would require Socket.IO setup

**Files to modify:**
- `src/app/api/socket/route.ts` (already exists)
- `src/components/teams/team-analytics.tsx`
- `src/lib/teams/activity.ts`

**Implementation:**
1. Emit `team-activity` event when activity logged
2. Subscribe to events in analytics component
3. Update state without full refresh

---

### 8. Add Export Pagination (4 hours)

**Current Limit:** 10,000 records

**Solution:** Implement streaming export for large datasets

**File:** `src/app/api/teams/[id]/activities/export/route.ts`

```typescript
// Use streaming for large exports
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  // ... existing auth code ...

  if (format === 'csv') {
    const stream = new ReadableStream({
      async start(controller) {
        // Send header
        controller.enqueue(new TextEncoder().encode(csvHeader))

        // Stream data in batches
        const BATCH_SIZE = 1000
        let offset = 0
        
        while (true) {
          const batch = await prisma.teamActivity.findMany({
            where,
            take: BATCH_SIZE,
            skip: offset,
            // ... rest of query
          })

          if (batch.length === 0) break

          for (const activity of batch) {
            const row = formatCsvRow(activity)
            controller.enqueue(new TextEncoder().encode(row + '\n'))
          }

          offset += BATCH_SIZE
        }

        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="team-activities-${Date.now()}.csv"`
      }
    })
  }
}
```

---

## Testing Checklist

After implementing fixes, test the following:

### Build & Lint
- [ ] `npm run build` - succeeds
- [ ] `npm run lint` - no errors
- [ ] TypeScript compilation - no errors

### Database
- [ ] Migrate schema changes
- [ ] Verify new index created
- [ ] Check query performance improvement

### API Endpoints
- [ ] GET `/api/teams/[id]/activities?view=heatmap&pageId=xxx` - returns filtered data
- [ ] GET `/api/teams/[id]/activities?view=metrics&memberId=xxx` - returns metrics
- [ ] Rate limiting - 429 after 100 requests/minute
- [ ] Export endpoint - downloads CSV/JSON

### UI Components
- [ ] Page filter dropdown appears
- [ ] Selecting page filters heatmap
- [ ] Export button works
- [ ] Reset filters button clears all filters
- [ ] Loading states display correctly

### Performance
- [ ] Heatmap loads faster with caching
- [ ] Member metrics query is faster
- [ ] No console errors

### Edge Cases
- [ ] No activities - shows "No data" message
- [ ] Unauthorized user - returns 403
- [ ] Invalid date range - handles gracefully
- [ ] Redis down - falls back to database

---

## Deployment Checklist

### Environment Variables
```bash
# Add to production .env
REDIS_URL=redis://your-redis-url:6379
```

### Database Migration
```bash
# Production
npx prisma db push
# or
npx prisma migrate deploy
```

### Start Worker
```bash
# Production (using PM2)
pm2 start npm --name "campaign-worker" -- run worker
```

### Verify
- [ ] Build succeeds
- [ ] All tests pass
- [ ] Environment variables set
- [ ] Database migrated
- [ ] Redis connected
- [ ] Worker running

---

**End of Implementation Guide**

