# 🧪 Comprehensive Endpoint Testing Guide

## Quick Test Script

Save this as `test-endpoints.sh` and run it:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
TEAM_ID="your_team_id_here"
MEMBER_ID="your_member_id_here"

echo "🧪 Testing Team Task Endpoints..."
echo "=================================="

# Test 1: Get all tasks
echo -e "\n1️⃣ GET /api/teams/$TEAM_ID/tasks"
curl -s "$BASE_URL/api/teams/$TEAM_ID/tasks" | jq '.'

# Test 2: Create task
echo -e "\n2️⃣ POST /api/teams/$TEAM_ID/tasks"
TASK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/teams/$TEAM_ID/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test Task $(date +%s)\",
    \"description\": \"Automated test task\",
    \"priority\": \"MEDIUM\",
    \"assignedToId\": \"$MEMBER_ID\"
  }")

echo "$TASK_RESPONSE" | jq '.'
TASK_ID=$(echo "$TASK_RESPONSE" | jq -r '.task.id')

# Test 3: Update task
echo -e "\n3️⃣ PATCH /api/teams/$TEAM_ID/tasks/$TASK_ID"
curl -s -X PATCH "$BASE_URL/api/teams/$TEAM_ID/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_PROGRESS"}' | jq '.'

# Test 4: Mark complete
echo -e "\n4️⃣ PATCH /api/teams/$TEAM_ID/tasks/$TASK_ID (Complete)"
curl -s -X PATCH "$BASE_URL/api/teams/$TEAM_ID/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -d '{"status": "COMPLETED"}' | jq '.'

# Test 5: Delete task
echo -e "\n5️⃣ DELETE /api/teams/$TEAM_ID/tasks/$TASK_ID"
curl -s -X DELETE "$BASE_URL/api/teams/$TEAM_ID/tasks/$TASK_ID" | jq '.'

echo -e "\n✅ All tests completed!"
```

## Manual Browser Testing Checklist

### Prerequisites
```bash
# Start dev server
npm run dev

# Ensure database is running
# Ensure you're logged in
```

### Test Suite

#### ✅ Task Creation
- [ ] Navigate to `/team`
- [ ] Click "Tasks" tab
- [ ] Click "Create Task"
- [ ] Fill title: "Browser Test Task"
- [ ] Select assignee (not yourself)
- [ ] Set priority: HIGH
- [ ] Add due date: Tomorrow
- [ ] Click "Create Task"
- [ ] Verify: Task appears in list
- [ ] Verify: Success toast shows
- [ ] Verify: Assignee can see notification

#### ✅ Task Assignment
- [ ] Create task assigned to yourself
- [ ] Verify: NO notification (self-assignment)
- [ ] Create task assigned to another member
- [ ] Verify: Notification created
- [ ] Check assignee's notification icon
- [ ] Verify: Notification shows correct message

#### ✅ Task Update
- [ ] Find a TODO task
- [ ] Click "Mark Complete"
- [ ] Verify: Status changes to COMPLETED
- [ ] Verify: Toast shows success
- [ ] Verify: Creator receives notification (if different)

#### ✅ Task Filtering
- [ ] Create tasks with different statuses
- [ ] Test status filter
- [ ] Test priority filter
- [ ] Test assignee filter
- [ ] Verify: Filters work correctly

#### ✅ Permissions
- [ ] As regular member: Create task
- [ ] As admin: Create task
- [ ] Try to delete someone else's task (should fail if not admin)
- [ ] As admin: Delete any task (should work)

---

## Database Verification

```sql
-- Check tasks were created
SELECT * FROM "TeamTask" 
ORDER BY "createdAt" DESC 
LIMIT 10;

-- Check notifications were sent
SELECT * FROM "TeamNotification" 
WHERE type = 'TASK_ASSIGNED'
ORDER BY "createdAt" DESC 
LIMIT 10;

-- Check activity was logged
SELECT * FROM "TeamActivity" 
WHERE type IN ('CREATE_ENTITY', 'COMPLETE_TASK')
ORDER BY "createdAt" DESC 
LIMIT 10;

-- Verify notification counts
SELECT 
  tm."userId",
  COUNT(tn.id) as notification_count,
  COUNT(CASE WHEN tn."isRead" = false THEN 1 END) as unread_count
FROM "TeamMember" tm
LEFT JOIN "TeamNotification" tn ON tn."memberId" = tm.id
GROUP BY tm."userId";
```

---

## System Health Checks

### 1. Next.js Dev Server
```bash
# Check if running
curl http://localhost:3000/api/health
```

### 2. Database
```bash
# Check connection
npx prisma db execute --stdin <<< "SELECT 1;"
```

### 3. Redis (if used)
```bash
# Check Redis
redis-cli ping
```

### 4. Campaign Worker
```bash
# Check if campaign worker is processing
curl http://localhost:3000/api/campaigns

# Check worker status
ps aux | grep "node.*worker"
```

---

## Expected Responses

### ✅ Success Cases

**Create Task:**
```json
{
  "task": {
    "id": "task_xyz",
    "title": "Test Task",
    "status": "TODO",
    "assignedTo": { /* member details */ },
    "createdBy": { /* creator details */ }
  }
}
```

**Get Tasks:**
```json
{
  "tasks": [
    {
      "id": "task_123",
      "title": "Sample Task",
      "priority": "HIGH",
      "status": "TODO"
      // ...
    }
  ]
}
```

**Update Task:**
```json
{
  "task": {
    "id": "task_123",
    "status": "COMPLETED",
    "completedAt": "2025-11-12T10:00:00.000Z"
    // ...
  }
}
```

### ❌ Error Cases

**Unauthorized:**
```json
{
  "error": "Unauthorized"
}
```

**Missing Title:**
```json
{
  "error": "Task title is required"
}
```

**Not Found:**
```json
{
  "error": "Task not found"
}
```

**Forbidden:**
```json
{
  "error": "Forbidden"
}
```

---

## Performance Benchmarks

Run this to test endpoint performance:

```bash
# Test GET endpoint (should be < 100ms)
time curl -s http://localhost:3000/api/teams/TEAM_ID/tasks > /dev/null

# Test POST endpoint (should be < 200ms)
time curl -s -X POST http://localhost:3000/api/teams/TEAM_ID/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Perf Test","assignedToId":"MEMBER_ID"}' > /dev/null

# Load test (requires ab - Apache Bench)
ab -n 100 -c 10 http://localhost:3000/api/teams/TEAM_ID/tasks
```

---

## Automated Test Results

After running all tests, you should see:

```
✅ Build: PASSED
✅ Linting: PASSED (no errors in task endpoints)
✅ TypeScript: PASSED
✅ Task Creation: PASSED
✅ Task Update: PASSED
✅ Task Delete: PASSED
✅ Notifications: PASSED
✅ Activity Logging: PASSED
✅ Authorization: PASSED
✅ Performance: PASSED (< 200ms avg)
```

---

## Troubleshooting

### If tests fail:

1. **Check logs:**
   ```bash
   # Terminal running npm run dev
   # Look for error messages
   ```

2. **Check database:**
   ```bash
   npx prisma studio
   # Verify tables exist
   ```

3. **Check authentication:**
   ```bash
   # Make sure you're logged in
   curl http://localhost:3000/api/auth/check-session
   ```

4. **Check team membership:**
   ```sql
   SELECT * FROM "TeamMember" 
   WHERE "userId" = 'YOUR_USER_ID' 
   AND "status" = 'ACTIVE';
   ```

---

*All tests should pass before deploying to production*

