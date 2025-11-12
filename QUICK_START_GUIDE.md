# 🚀 Quick Start Guide - Team Tasks & AI Automations

## ✅ System Status: READY TO USE

Everything is tested and working! Here's how to use the features:

---

## 🔧 Starting the Development Server

```bash
# Start Next.js dev server
npm run dev

# Server will start on http://localhost:3000
```

---

## 👥 Using Team Tasks

### Creating Tasks

1. **Navigate to Team Page**
   - Go to `/team` in your application
   - Click on "Tasks" tab

2. **Create a New Task**
   - Click "Create Task" button
   - Fill in the form:
     - **Title** (required): Task name
     - **Description** (optional): Task details
     - **Assign To** (required): Select team member
     - **Priority**: LOW, MEDIUM, HIGH, URGENT
     - **Due Date** (optional): Set deadline

3. **What Happens:**
   - ✅ Task is created in database
   - ✅ Assigned member gets notification
   - ✅ Activity is logged
   - ✅ Task appears in task list

### Task Notifications

**Automatic notifications are sent when:**
1. **Task is assigned** to a team member
   - Notification shows who assigned it
   - Link to view the task
   
2. **Task is completed** by someone other than creator
   - Notification sent to task creator
   - Shows who completed it

3. **Task is reassigned** to different member
   - New assignee gets notification

**Notification Settings:**
- Users can toggle task notifications in their profile
- Email notifications ready (needs SMTP setup)
- Notifications appear in notification center

---

## 🤖 Using AI Automations

### Creating Automation Rules

1. **Navigate to AI Automations Page**
   - Go to `/ai-automations`

2. **Click "Create Rule"**
   - Configure the rule:
     - **Name**: Rule identifier
     - **Time Interval**: When to send (hours, days)
     - **AI Prompt**: Instructions for message generation
     - **Language Style**: Taglish, English, etc.
     - **Tag Filters**: Include/exclude specific tags
     - **Active Hours**: When automation runs
     - **Daily Limit**: Max messages per day

3. **Test the Rule**
   - Use "Play" button for manual test
   - Check execution statistics

### How AI Automations Work

1. **Cron job runs every minute**
   - Checks all enabled rules
   - Finds eligible contacts (inactive for X time)
   - Applies tag filters

2. **For each eligible contact:**
   - Fetches conversation history
   - AI generates personalized message
   - Sends via Facebook Messenger
   - Logs execution

3. **Auto-stop when user replies:**
   - Webhook detects reply
   - Creates stop record
   - Removes trigger tag (if configured)

---

## 🧪 Testing Endpoints

### Manual API Testing

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test AI automations cron (no auth required)
curl http://localhost:3000/api/cron/ai-automations

# Other endpoints require authentication
# Use the UI or add authentication headers
```

### Running Test Scripts

```bash
# Test all endpoints
bash test-endpoints.sh

# Check system services
bash test-system-services.sh

# View results
cat endpoint-test-results.log
```

---

## 📊 Monitoring

### Check System Health

```bash
# Via API
curl http://localhost:3000/api/health

# Response shows:
# - Database: status
# - Prisma: status  
# - Environment variables: status
```

### View Execution Logs

**In Database:**
```sql
-- Check AI automation executions
SELECT * FROM "AIAutomationExecution" 
ORDER BY "executedAt" DESC LIMIT 10;

-- Check task notifications
SELECT * FROM "TeamNotification"
WHERE type = 'TASK_ASSIGNED'
ORDER BY "createdAt" DESC LIMIT 10;

-- Check team activities
SELECT * FROM "TeamActivity"
WHERE type = 'CREATE_ENTITY' AND "entityType" = 'task'
ORDER BY "createdAt" DESC LIMIT 10;
```

---

## 🔧 Troubleshooting

### Task Creation Issues

**"Failed to create task"**
1. Check if user is logged in
2. Verify user is team member
3. Ensure all required fields filled
4. Check browser console for errors

**Notifications not appearing**
1. Check user notification settings
2. Verify `notificationsEnabled` is true
3. Check `taskNotifications` is enabled
4. Look in database for notification record

### AI Automation Issues

**No messages being sent**
1. Check if rule is enabled
2. Verify you have Google AI API keys in `.env.local`
3. Check active hours configuration
4. Verify eligible contacts exist
5. Check daily limit not exceeded

**Cron not running**
1. Ensure `vercel.json` is configured
2. In production, check Vercel dashboard → Cron Jobs
3. Test manually: `curl http://localhost:3000/api/cron/ai-automations`

---

## 🎯 Common Tasks

### Adding Google AI API Keys

```bash
# Add to .env.local
GOOGLE_AI_API_KEY=AIzaSy...
GOOGLE_AI_API_KEY_2=AIzaSy...
# ... up to GOOGLE_AI_API_KEY_9

# Get keys from: https://aistudio.google.com/app/apikey
```

### Configuring Redis (Optional)

```bash
# For campaign queue optimization
# Add to .env.local
REDIS_URL=redis://localhost:6379
```

### Setting Cron Secret (Production)

```bash
# Generate secret
openssl rand -hex 32

# Add to .env.local (and Vercel)
CRON_SECRET=your_generated_secret_here
```

---

## 📚 Additional Resources

- **AI Automation Docs**: See `AI_AUTOMATION_IMPLEMENTATION_SUMMARY.md`
- **Test Report**: See `COMPREHENSIVE_SYSTEM_TEST_REPORT.md`
- **Test Scripts**: `test-endpoints.sh`, `test-system-services.sh`
- **API Documentation**: Check each route file in `src/app/api/`

---

## 🆘 Need Help?

**Check these first:**
1. ✅ Server running? (`npm run dev`)
2. ✅ Database connected? (check health endpoint)
3. ✅ Environment variables set? (check `.env.local`)
4. ✅ User authenticated? (check login status)
5. ✅ Team membership active? (check team member status)

**Common Solutions:**
- Restart dev server
- Clear browser cache
- Check browser console
- Review server logs
- Verify database connection

---

## ✅ Quick Checklist

Before using the system:
- [ ] Development server running
- [ ] Database connected
- [ ] Environment variables configured
- [ ] User logged in
- [ ] Team membership active

For AI Automations:
- [ ] Google AI API keys added
- [ ] At least one rule created
- [ ] Rule is enabled
- [ ] Eligible contacts exist

For Team Tasks:
- [ ] User is team member
- [ ] Team has active members
- [ ] Notification settings enabled

---

**You're all set!** 🎉

Everything is tested and working. Start creating tasks and automation rules!
