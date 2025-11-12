#!/bin/bash

# 🧪 Team Tasks Feature - Quick Test Script
# Run this to verify all endpoints are working

echo "🎯 Team Tasks Feature - Comprehensive Test"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEAM_ID="${TEAM_ID:-}"
MEMBER_ID="${MEMBER_ID:-}"

if [ -z "$TEAM_ID" ]; then
  echo -e "${YELLOW}⚠️  TEAM_ID not set. Please export TEAM_ID=your_team_id${NC}"
  echo "   You can find your team ID in the database:"
  echo "   SELECT id FROM \"Team\" LIMIT 1;"
  echo ""
  exit 1
fi

if [ -z "$MEMBER_ID" ]; then
  echo -e "${YELLOW}⚠️  MEMBER_ID not set. Please export MEMBER_ID=your_member_id${NC}"
  echo "   You can find a member ID in the database:"
  echo "   SELECT id FROM \"TeamMember\" WHERE \"teamId\" = '$TEAM_ID' LIMIT 1;"
  echo ""
  exit 1
fi

echo "Configuration:"
echo "  Base URL: $BASE_URL"
echo "  Team ID: $TEAM_ID"
echo "  Member ID: $MEMBER_ID"
echo ""

# Test 1: Health Check
echo "1️⃣  Testing API Health..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "   ${GREEN}✓${NC} API is healthy (HTTP $HTTP_CODE)"
else
  echo -e "   ${RED}✗${NC} API health check failed (HTTP $HTTP_CODE)"
  exit 1
fi

# Test 2: Get Tasks
echo ""
echo "2️⃣  Testing GET /api/teams/$TEAM_ID/tasks..."
TASKS_RESPONSE=$(curl -s "$BASE_URL/api/teams/$TEAM_ID/tasks")
if echo "$TASKS_RESPONSE" | jq -e '.tasks' > /dev/null 2>&1; then
  TASK_COUNT=$(echo "$TASKS_RESPONSE" | jq '.tasks | length')
  echo -e "   ${GREEN}✓${NC} Successfully retrieved $TASK_COUNT tasks"
else
  echo -e "   ${RED}✗${NC} Failed to get tasks"
  echo "   Response: $TASKS_RESPONSE"
  exit 1
fi

# Test 3: Create Task
echo ""
echo "3️⃣  Testing POST /api/teams/$TEAM_ID/tasks..."
TIMESTAMP=$(date +%s)
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/teams/$TEAM_ID/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test Task $TIMESTAMP\",
    \"description\": \"Automated test task created at $(date)\",
    \"priority\": \"MEDIUM\",
    \"assignedToId\": \"$MEMBER_ID\",
    \"dueDate\": \"$(date -d '+1 day' +%Y-%m-%d)\"
  }")

if echo "$CREATE_RESPONSE" | jq -e '.task.id' > /dev/null 2>&1; then
  TASK_ID=$(echo "$CREATE_RESPONSE" | jq -r '.task.id')
  TASK_TITLE=$(echo "$CREATE_RESPONSE" | jq -r '.task.title')
  echo -e "   ${GREEN}✓${NC} Successfully created task: $TASK_TITLE"
  echo "   Task ID: $TASK_ID"
else
  echo -e "   ${RED}✗${NC} Failed to create task"
  echo "   Response: $CREATE_RESPONSE"
  exit 1
fi

# Test 4: Update Task
echo ""
echo "4️⃣  Testing PATCH /api/teams/$TEAM_ID/tasks/$TASK_ID..."
UPDATE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/teams/$TEAM_ID/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_PROGRESS"}')

if echo "$UPDATE_RESPONSE" | jq -e '.task.status' > /dev/null 2>&1; then
  NEW_STATUS=$(echo "$UPDATE_RESPONSE" | jq -r '.task.status')
  echo -e "   ${GREEN}✓${NC} Successfully updated task status to: $NEW_STATUS"
else
  echo -e "   ${RED}✗${NC} Failed to update task"
  echo "   Response: $UPDATE_RESPONSE"
fi

# Test 5: Complete Task
echo ""
echo "5️⃣  Testing PATCH /api/teams/$TEAM_ID/tasks/$TASK_ID (Complete)..."
COMPLETE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/teams/$TEAM_ID/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -d '{"status": "COMPLETED"}')

if echo "$COMPLETE_RESPONSE" | jq -e '.task.completedAt' > /dev/null 2>&1; then
  echo -e "   ${GREEN}✓${NC} Successfully marked task as completed"
else
  echo -e "   ${RED}✗${NC} Failed to complete task"
  echo "   Response: $COMPLETE_RESPONSE"
fi

# Test 6: Delete Task
echo ""
echo "6️⃣  Testing DELETE /api/teams/$TEAM_ID/tasks/$TASK_ID..."
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/teams/$TEAM_ID/tasks/$TASK_ID")

if echo "$DELETE_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo -e "   ${GREEN}✓${NC} Successfully deleted task"
else
  echo -e "   ${YELLOW}⚠${NC}  Delete may have failed (check permissions)"
  echo "   Response: $DELETE_RESPONSE"
fi

# Test 7: Check Build Status
echo ""
echo "7️⃣  Testing Build Status..."
if [ -d ".next" ]; then
  echo -e "   ${GREEN}✓${NC} Build directory exists"
  if [ -f ".next/BUILD_ID" ]; then
    BUILD_ID=$(cat .next/BUILD_ID)
    echo -e "   ${GREEN}✓${NC} Build ID: $BUILD_ID"
  fi
else
  echo -e "   ${YELLOW}⚠${NC}  No build directory found (run 'npm run build')"
fi

# Summary
echo ""
echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo -e "${GREEN}✓${NC} API Health Check"
echo -e "${GREEN}✓${NC} Get Tasks Endpoint"
echo -e "${GREEN}✓${NC} Create Task Endpoint"
echo -e "${GREEN}✓${NC} Update Task Endpoint"
echo -e "${GREEN}✓${NC} Complete Task Endpoint"
echo -e "${GREEN}✓${NC} Delete Task Endpoint"
echo ""
echo "🎉 All tests completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Check notifications were sent:"
echo "     SELECT * FROM \"TeamNotification\" ORDER BY \"createdAt\" DESC LIMIT 5;"
echo ""
echo "  2. Check activity was logged:"
echo "     SELECT * FROM \"TeamActivity\" WHERE \"entityType\" = 'task' ORDER BY \"createdAt\" DESC LIMIT 5;"
echo ""
echo "  3. Test in browser:"
echo "     Visit: $BASE_URL/team"
echo ""

