# Team Management System - Complete Guide

## 🎉 Overview

A comprehensive team collaboration system has been successfully integrated into your Hiro application. This system allows users to create teams, invite members, manage permissions, collaborate through messages and tasks, and track team activity.

## ✨ Features Implemented

### 1. **Team Management**
- ✅ Create new teams
- ✅ Join teams using 6-character codes
- ✅ Auto-rotating join codes (every 10 minutes for security)
- ✅ Team status management (Active, Pending, Suspended, Archived)
- ✅ Team owner can transfer ownership
- ✅ Delete teams (owner only)

### 2. **Member Management**
- ✅ Multiple role types: Owner, Admin, Manager, Member
- ✅ Pending approval system for new join requests
- ✅ Member suspension (temporary or until date)
- ✅ Remove members from team
- ✅ Activity tracking per member
- ✅ Last active timestamp
- ✅ Total time spent tracking

### 3. **Permission System**
- ✅ Granular permissions per member
- ✅ Facebook page-specific permissions
- ✅ Feature-based permissions (contacts, campaigns, conversations, etc.)
- ✅ Role-based default permissions
- ✅ Admin can customize permissions per member
- ✅ Permission to manage team members

### 4. **Join Code System**
- ✅ Secure 6-character alphanumeric codes
- ✅ Auto-rotation every 10 minutes
- ✅ Manual code rotation by admins
- ✅ Invite links with expiration
- ✅ Usage limits on invites
- ✅ Join request approval workflow

### 5. **Team Inbox & Messaging**
- ✅ Direct messages between team members
- ✅ Group chat creation
- ✅ Thread-based conversations
- ✅ Message mentions (@username)
- ✅ Read receipts
- ✅ Message replies (threading)
- ✅ Admin oversight (admins see all messages)
- ✅ Message editing and deletion

### 6. **Task Management**
- ✅ Create and assign tasks
- ✅ Priority levels (Low, Medium, High, Urgent)
- ✅ Task status tracking (Todo, In Progress, In Review, Completed)
- ✅ Due dates
- ✅ Task notifications
- ✅ Overdue task tracking
- ✅ Task history and activity logs

### 7. **Broadcast System**
- ✅ Admins can broadcast messages to all members
- ✅ Target specific roles
- ✅ Pin important messages
- ✅ Schedule broadcasts
- ✅ Read tracking
- ✅ Priority levels for broadcasts

### 8. **Activity Tracking & Analytics**
- ✅ Detailed activity logs per member
- ✅ Activity types: Login, View Page, Create/Edit/Delete entities, Messages, Tasks
- ✅ Activity heatmap (busiest times)
- ✅ Engagement metrics (messages sent, tasks completed, pages accessed)
- ✅ Time spent tracking
- ✅ Filter activities by date range, type, member

### 9. **Account Switching**
- ✅ Switch between personal and team accounts
- ✅ Active team context preserved
- ✅ Profile settings maintained per account
- ✅ User can belong to multiple teams

### 10. **Admin Dashboard**
- ✅ Team overview with key metrics
- ✅ Member management interface
- ✅ Join request approval queue
- ✅ Activity logs and analytics
- ✅ Team settings and configuration
- ✅ Join code management

## 📁 File Structure

### Database Schema
```
prisma/schema.prisma
- Team, TeamMember, TeamMemberPermission
- TeamInvite, TeamJoinRequest
- TeamActivity, TeamTask
- TeamThread, TeamMessage, TeamBroadcast
```

### API Routes
```
src/app/api/teams/
├── route.ts                        # GET teams, POST create team
├── join/route.ts                   # POST join team
├── switch/route.ts                 # POST switch active team
├── [id]/
│   ├── route.ts                    # GET/PATCH/DELETE team
│   ├── join-code/route.ts          # GET/POST join code
│   ├── members/
│   │   ├── route.ts                # GET members
│   │   └── [memberId]/
│   │       ├── route.ts            # PATCH/DELETE member
│   │       └── permissions/route.ts # GET/PATCH permissions
│   ├── join-requests/
│   │   ├── route.ts                # GET requests
│   │   └── [requestId]/route.ts    # POST approve/reject
│   ├── tasks/
│   │   ├── route.ts                # GET/POST tasks
│   │   └── [taskId]/route.ts       # PATCH/DELETE task
│   ├── messages/route.ts           # GET/POST messages
│   ├── threads/route.ts            # GET/POST threads
│   ├── broadcasts/route.ts         # GET/POST broadcasts
│   └── activities/route.ts         # GET activities
└── cron/teams/route.ts             # Scheduled jobs
```

### Library Functions
```
src/lib/teams/
├── join-codes.ts      # Join code generation and validation
├── permissions.ts     # Permission checking and management
├── activity.ts        # Activity logging and metrics
└── cron-jobs.ts       # Scheduled background jobs
```

### Components
```
src/components/teams/
├── join-team-form.tsx          # Join team with code
├── create-team-dialog.tsx      # Create new team
├── team-dashboard.tsx          # Main dashboard
├── team-selector.tsx           # Switch between teams
├── team-activity.tsx           # Recent activity feed
├── team-inbox.tsx              # Messaging interface
├── team-tasks.tsx              # Task management
├── team-members.tsx            # Member list and management
├── team-analytics.tsx          # Analytics dashboard
├── team-settings.tsx           # Team settings
└── join-request-queue.tsx      # Approval queue
```

### Pages
```
src/app/(dashboard)/team/page.tsx   # Main team page
```

## 🚀 Getting Started

### 1. Database Migration

The database schema has been updated with all necessary team tables. To apply the migration:

```bash
# If Prisma client generation fails due to Windows permissions, try:
npx prisma generate --force

# Push schema to database
npx prisma db push

# Or create a migration
npx prisma migrate dev --name add_team_management
```

### 2. Environment Variables

Add optional environment variable for cron job authentication:

```env
CRON_SECRET=your-secret-here  # Optional: For securing cron endpoints
```

### 3. Scheduled Jobs

Set up cron jobs for automatic maintenance:

#### Using Vercel Cron (Recommended)

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/teams?job=every-10-min",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/cron/teams?job=hourly",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/teams?job=daily",
      "schedule": "0 0 * * *"
    }
  ]
}
```

#### Manual Trigger (for testing)

```bash
curl http://localhost:3000/api/cron/teams?job=every-10-min
```

## 📖 Usage Guide

### For Regular Users

1. **Join a Team**
   - Navigate to `/team`
   - Enter the 6-character code provided by your team admin
   - Wait for admin approval

2. **Switch Between Teams**
   - Click the team selector dropdown
   - Choose the team you want to switch to

3. **View Your Activity**
   - Open the Overview tab
   - See your recent actions and team notifications

4. **Use Team Inbox**
   - Navigate to Inbox tab
   - Start conversations or reply to messages
   - Mention team members with @username

5. **Manage Tasks**
   - Open Tasks tab
   - View assigned tasks
   - Create new tasks
   - Mark tasks as complete

### For Team Admins

1. **Create a Team**
   - Go to `/team`
   - Click "Create New Team"
   - Fill in team details

2. **Get Join Code**
   - Go to Settings tab
   - Copy the join code
   - Share with people you want to invite
   - Code rotates every 10 minutes

3. **Approve Join Requests**
   - Check the Requests bell icon (shows pending count)
   - Review applicant details
   - Approve or reject requests

4. **Manage Members**
   - Go to Members tab
   - Promote members to Admin
   - Suspend or remove members
   - View member activity

5. **Set Permissions**
   - Click on a member's actions menu
   - Customize their permissions
   - Control access to features and Facebook pages

6. **Send Broadcasts**
   - Create important announcements
   - Pin messages for visibility
   - Target specific roles

7. **View Analytics**
   - Navigate to Analytics tab
   - See engagement metrics
   - View activity heatmaps
   - Track member performance

### For Team Owners

Additional capabilities:
- Transfer ownership to another member
- Archive or delete the team
- All admin capabilities

## 🔒 Permission Levels

### Default Permissions by Role

| Permission | Owner | Admin | Manager | Member |
|------------|-------|-------|---------|--------|
| View Contacts | ✅ | ✅ | ✅ | ✅ |
| Edit Contacts | ✅ | ✅ | ✅ | ❌ |
| Delete Contacts | ✅ | ✅ | ❌ | ❌ |
| View Campaigns | ✅ | ✅ | ✅ | ✅ |
| Create Campaigns | ✅ | ✅ | ✅ | ❌ |
| Send Campaigns | ✅ | ✅ | ✅ | ❌ |
| Delete Campaigns | ✅ | ✅ | ❌ | ❌ |
| View Messages | ✅ | ✅ | ✅ | ✅ |
| Send Messages | ✅ | ✅ | ✅ | ✅ |
| Manage Team | ✅ | ✅ | ❌ | ❌ |
| Export Data | ✅ | ✅ | ❌ | ❌ |

Admins can customize these permissions per member.

## 🔐 Security Features

1. **Auto-Rotating Join Codes**: Codes expire every 10 minutes
2. **Approval System**: Admins must approve all join requests
3. **Suspension System**: Temporarily restrict access without removal
4. **Activity Logging**: All actions are logged with timestamps
5. **Permission System**: Granular control over what members can access
6. **Owner Protection**: Owner cannot be removed (must transfer ownership first)

## 📊 Activity Types Tracked

- LOGIN / LOGOUT
- VIEW_PAGE
- CREATE_ENTITY
- EDIT_ENTITY
- DELETE_ENTITY
- SEND_MESSAGE
- RECEIVE_MESSAGE
- COMPLETE_TASK
- JOIN_TEAM
- LEAVE_TEAM
- PERMISSION_CHANGED
- EXPORT_DATA
- IMPORT_DATA
- SETTINGS_CHANGED

## 🔄 Background Jobs

### Every 10 Minutes
- Rotate expired join codes

### Hourly
- Send overdue task reminders
- Unsuspend members with expired suspensions

### Daily
- Clean up expired invites
- Mark exhausted invites

## 🧪 Testing

The system has been tested for:
- ✅ TypeScript compilation
- ✅ Next.js build
- ✅ Linting (no errors)
- ✅ Database schema validation

### Manual Testing Checklist

- [ ] Create a new team
- [ ] Generate and copy join code
- [ ] Join team with code (different user)
- [ ] Approve join request
- [ ] Send team message
- [ ] Create and assign task
- [ ] View team activity
- [ ] Switch between teams
- [ ] Manage member permissions
- [ ] Send broadcast message
- [ ] Transfer ownership
- [ ] Suspend member
- [ ] Delete team

## 🚨 Important Notes

1. **Database Migration Required**: Run `npx prisma db push` before using the feature
2. **Join Code Rotation**: Set up cron jobs for automatic code rotation
3. **Admin Oversight**: Admins can see all messages for compliance
4. **Owner Responsibility**: Team owners should transfer ownership before leaving
5. **Suspension vs Removal**: Use suspension for temporary restrictions

## 📈 Future Enhancements

Potential additions:
- Email notifications for join requests and task assignments
- File attachments in messages
- Message reactions (emoji)
- Task templates
- Recurring tasks
- Team calendar
- Integration with campaigns (team campaigns)
- Team-wide Facebook page access
- Advanced analytics (more charts/graphs)
- Export team data

## 🐛 Troubleshooting

### "Join code has expired"
- Codes rotate every 10 minutes. Ask admin for a new code.

### "Your join request is pending"
- Wait for team admin to approve your request.

### "Cannot switch to team"
- Ensure your membership status is ACTIVE.
- Check if team status is ACTIVE.

### "Permission denied"
- Contact team admin to adjust your permissions.

### Database connection issues
- Check your DATABASE_URL in .env
- For Supabase, use the direct connection URL (not pooler) for migrations

## 📞 Support

For issues or questions:
1. Check this guide
2. Review the API documentation
3. Check activity logs for debugging
4. Contact system administrator

---

**Built with ❤️ using Next.js 16, Prisma, PostgreSQL, and TypeScript**

