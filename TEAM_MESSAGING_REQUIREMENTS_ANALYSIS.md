# Team Page & Messaging System - Requirements Analysis

## 🎯 Executive Summary
This document outlines the comprehensive requirements for extending the Team page and messaging system. The implementation follows a systematic approach: Requirements → Domain Model → Logic Flows → Runtime Checks → Endpoints → Validation → Instrumentation → QA.

---

## 1. Requirements Analysis

### 1.1 Task Notifications System

#### Functional Requirements
- **FR-TN-01**: Notify assignee when a new task is created and assigned to them
- **FR-TN-02**: Notify assignee when task details are updated (priority, due date, description)
- **FR-TN-03**: Notify task creator when status changes (TODO → IN_PROGRESS → COMPLETED)
- **FR-TN-04**: Notify team admins when high-priority/urgent tasks are created
- **FR-TN-05**: Support real-time notification delivery (if user online) and persistent storage
- **FR-TN-06**: Notifications should link directly to the task or team tasks page

#### Non-Functional Requirements
- **NFR-TN-01**: Notifications must be delivered within 2 seconds
- **NFR-TN-02**: Support batching for bulk task updates
- **NFR-TN-03**: Prevent notification spam (coalesce similar notifications within 5 min window)

#### Acceptance Criteria
- [ ] New task assignment triggers notification to assignee
- [ ] Task updates trigger notification with change summary
- [ ] Task completion triggers notification to creator
- [ ] Notification bell shows unread count
- [ ] Clicking notification navigates to task context

---

### 1.2 Advanced Activity Heatmap

#### Functional Requirements
- **FR-AH-01**: Filter heatmap by specific team member
- **FR-AH-02**: Filter heatmap by date range (7/14/30/90 days, custom)
- **FR-AH-03**: Filter heatmap by page/section accessed
- **FR-AH-04**: Display activity type breakdown (logins, messages, tasks, page views)
- **FR-AH-05**: Export heatmap data as CSV/JSON
- **FR-AH-06**: Show comparative metrics (vs previous period)

#### Non-Functional Requirements
- **NFR-AH-01**: Heatmap must render for up to 90 days of data in < 3 seconds
- **NFR-AH-02**: Support up to 100 team members
- **NFR-AH-03**: Real-time updates for current day activity

#### Acceptance Criteria
- [ ] User dropdown filter shows all active members
- [ ] Date range picker supports presets and custom ranges
- [ ] Page filter shows all tracked pages/sections
- [ ] Activity type toggles show/hide specific activity types
- [ ] Export button downloads formatted CSV
- [ ] Comparison shows % change vs previous period

---

### 1.3 Member Activity List with Filters

#### Functional Requirements
- **FR-MA-01**: Display paginated list of all member activities
- **FR-MA-02**: Filter by member (multi-select)
- **FR-MA-03**: Filter by activity type (login, logout, view, create, edit, delete, message)
- **FR-MA-04**: Filter by date range (start date - end date)
- **FR-MA-05**: Filter by entity type (task, message, member, settings)
- **FR-MA-06**: Sort by date, member, activity type
- **FR-MA-07**: Display activity details (who, what, when, where)
- **FR-MA-08**: Infinite scroll or pagination (50 items per page)

#### Non-Functional Requirements
- **NFR-MA-01**: Initial page load < 1.5 seconds
- **NFR-MA-02**: Filter application < 500ms
- **NFR-MA-03**: Support querying up to 100,000 activities efficiently

#### Acceptance Criteria
- [ ] Activity list shows member avatar, name, action, timestamp
- [ ] Multi-select member filter works with checkboxes
- [ ] Activity type filter shows icon and count per type
- [ ] Date range picker validates start < end
- [ ] Sort options persist across page reloads
- [ ] Clicking activity item shows detail modal

---

### 1.4 Members Section Enhancements

#### Functional Requirements
- **FR-MS-01**: Search members by name, email, or role
- **FR-MS-02**: Bulk select members (select all, select none, select filtered)
- **FR-MS-03**: Bulk remove multiple members with confirmation
- **FR-MS-04**: Bulk change role for multiple members
- **FR-MS-05**: Filter members by role, status, last active
- **FR-MS-06**: Sort members by name, join date, last active, activity count
- **FR-MS-07**: Show member statistics (tasks, messages, activity)
- **FR-MS-08**: Export member list as CSV

#### Non-Functional Requirements
- **NFR-MS-01**: Search results appear in < 300ms
- **NFR-MS-02**: Bulk operations handle up to 50 members
- **NFR-MS-03**: Role changes propagate to permissions immediately

#### Acceptance Criteria
- [ ] Search bar with debounced input (300ms)
- [ ] Select all checkbox in table header
- [ ] Bulk action buttons appear when members selected
- [ ] Bulk remove shows confirmation with member count
- [ ] Bulk role change shows dropdown with role options
- [ ] Filters update member list dynamically
- [ ] Sort indicator shows current sort column/direction

---

### 1.5 Team Notifications Icon & Unread Counter

#### Functional Requirements
- **FR-TI-01**: Display bell icon in team dashboard header
- **FR-TI-02**: Show unread notification count badge
- **FR-TI-03**: Badge updates in real-time (polling or SSE)
- **FR-TI-04**: Clicking icon opens notifications dropdown
- **FR-TI-05**: Dropdown shows last 10 notifications
- **FR-TI-06**: Mark individual notification as read
- **FR-TI-07**: Mark all notifications as read
- **FR-TI-08**: Navigate to notification context on click
- **FR-TI-09**: Categorize notifications (tasks, messages, members, system)
- **FR-TI-10**: Support notification preferences per member

#### Non-Functional Requirements
- **NFR-TI-01**: Badge updates within 5 seconds of new notification
- **NFR-TI-02**: Dropdown opens in < 200ms
- **NFR-TI-03**: Notification list scrollable for > 10 items

#### Acceptance Criteria
- [ ] Bell icon visible in team header
- [ ] Badge shows number (99+ for >= 100)
- [ ] Badge animates when new notification arrives
- [ ] Dropdown shows notification preview
- [ ] Read notifications have different styling
- [ ] "Mark all read" button clears badge
- [ ] Notification click navigates correctly

---

### 1.6 Inbox: Auto DMs for New Members

#### Functional Requirements
- **FR-ID-01**: Automatically create DM thread when member joins team
- **FR-ID-02**: Send welcome message from team owner/admin
- **FR-ID-03**: Welcome message includes team info, guidelines, key contacts
- **FR-ID-04**: Customizable welcome message template per team
- **FR-ID-05**: Track if welcome message was read
- **FR-ID-06**: Option to disable auto-DM in team settings

#### Non-Functional Requirements
- **NFR-ID-01**: DM created within 3 seconds of member joining
- **NFR-ID-02**: Template supports markdown and variables
- **NFR-ID-03**: Read receipts tracked accurately

#### Acceptance Criteria
- [ ] New member receives DM immediately after joining
- [ ] Welcome message shows team name and owner info
- [ ] Template editor in team settings
- [ ] Variables ({{memberName}}, {{teamName}}, {{ownerName}}) work
- [ ] Toggle for enabling/disabling auto-DM
- [ ] Read status visible to sender

---

### 1.7 Inbox: Admin-Only Group Creation

#### Functional Requirements
- **FR-IG-01**: Only OWNER and ADMIN roles can create group conversations
- **FR-IG-02**: Group creation UI shows role-based visibility
- **FR-IG-03**: Group creators can select multiple members
- **FR-IG-04**: Group creators can set group name, description, avatar
- **FR-IG-05**: Group members receive notification of addition
- **FR-IG-06**: Group admins (creator + team admins) can add/remove members
- **FR-IG-07**: Group admins can change group settings
- **FR-IG-08**: Members can leave group (except last admin)

#### Non-Functional Requirements
- **NFR-IG-01**: Group creation form validates permissions server-side
- **NFR-IG-02**: Member selection supports up to 50 members
- **NFR-IG-03**: Group created in < 2 seconds

#### Acceptance Criteria
- [ ] "Create Group" button only visible to admins
- [ ] Group creation modal shows member multi-select
- [ ] Group name required, description optional
- [ ] Avatar upload supports image files
- [ ] All selected members added to group thread
- [ ] Notification sent to each added member
- [ ] Non-admins see permission denied error

---

### 1.8 Conversation: Send Photos

#### Functional Requirements
- **FR-CP-01**: Upload button in message input for images
- **FR-CP-02**: Support JPEG, PNG, GIF, WebP formats
- **FR-CP-03**: Support multiple images in one message (up to 5)
- **FR-CP-04**: Show image previews before sending
- **FR-CP-05**: Compress images client-side to optimize size
- **FR-CP-06**: Store images in cloud storage (S3/Cloudinary)
- **FR-CP-07**: Display images in message thread with lightbox
- **FR-CP-08**: Support captions for images
- **FR-CP-09**: Show upload progress indicator
- **FR-CP-10**: Handle upload failures gracefully

#### Non-Functional Requirements
- **NFR-CP-01**: Max individual image size: 10MB
- **NFR-CP-02**: Total message size with images: 25MB
- **NFR-CP-03**: Upload completes in < 10 seconds for normal connection
- **NFR-CP-04**: Compressed images maintain acceptable quality

#### Acceptance Criteria
- [ ] Image upload button visible in message input
- [ ] File picker filters to image types
- [ ] Preview shows all selected images
- [ ] Remove individual image before sending
- [ ] Progress bar shows upload status
- [ ] Images display correctly in message thread
- [ ] Clicking image opens full-size lightbox
- [ ] Caption text renders below images

---

### 1.9 Conversation: Mention Users

#### Functional Requirements
- **FR-CM-01**: Type @ to trigger member mention autocomplete
- **FR-CM-02**: Autocomplete filters members as user types
- **FR-CM-03**: Select member from dropdown to insert mention
- **FR-CM-04**: Mentioned users receive notification
- **FR-CM-05**: Mentions highlighted in message (different color/style)
- **FR-CM-06**: Clicking mention shows member profile
- **FR-CM-07**: Support @everyone to mention all members
- **FR-CM-08**: Support @here to mention only online members
- **FR-CM-09**: Limit mentions per message (prevent spam)
- **FR-CM-10**: Track mention read status

#### Non-Functional Requirements
- **NFR-CM-01**: Autocomplete appears in < 200ms
- **NFR-CM-02**: Autocomplete shows up to 10 matches
- **NFR-CM-03**: Mention notifications delivered immediately
- **NFR-CM-04**: Max 20 mentions per message

#### Acceptance Criteria
- [ ] @ trigger opens member dropdown
- [ ] Dropdown filters on name/email input
- [ ] Selected member inserted as @username
- [ ] Mention highlighted in sent message
- [ ] Mentioned user receives notification
- [ ] @everyone works for team-wide announcements
- [ ] @here excludes offline members
- [ ] Validation prevents excessive mentions

---

## 2. Domain Model Extensions

### 2.1 Existing Models (Current State)

```prisma
model TeamNotification {
  id         String @id
  memberId   String
  type       NotificationType
  title      String
  message    String
  entityType String?
  entityId   String?
  entityUrl  String?
  isRead     Boolean @default(false)
  readAt     DateTime?
  createdAt  DateTime @default(now())
}

model TeamMessage {
  id          String @id
  teamId      String
  threadId    String?
  senderId    String
  content     String
  mentions    String[]
  reactions   Json?
  attachments Json?
  replyToId   String?
  readBy      String[]
  createdAt   DateTime
}

model TeamThread {
  id             String @id
  teamId         String
  title          String?
  type           ThreadType
  participantIds String[]
  lastMessageAt  DateTime?
}

model TeamActivity {
  id         String @id
  teamId     String
  memberId   String?
  type       TeamActivityType
  action     String
  entityType String?
  entityId   String?
  metadata   Json?
  createdAt  DateTime
}
```

### 2.2 Required Extensions

```prisma
// Add to TeamNotification enum
enum NotificationType {
  TASK_ASSIGNED
  TASK_UPDATED
  TASK_COMPLETED
  TASK_DUE_SOON
  MESSAGE_MENTION
  MESSAGE_REPLY
  MEMBER_JOINED
  MEMBER_LEFT
  ROLE_CHANGED
  TEAM_ANNOUNCEMENT
}

// Add to TeamThread model
model TeamThread {
  // ... existing fields
  createdBy     String
  isGroupChat   Boolean @default(false)
  groupName     String?
  groupAvatar   String?
  isAdminOnly   Boolean @default(false)
}

// Add to Team model
model Team {
  // ... existing fields
  welcomeMessageEnabled Boolean @default(true)
  welcomeMessageTemplate String?
}

// Update TeamMessage attachments structure
// attachments Json? should follow:
{
  "images": [
    {
      "url": "string",
      "thumbnail": "string",
      "width": number,
      "height": number,
      "size": number,
      "caption": "string"
    }
  ]
}
```

---

## 3. Logic Flows

### 3.1 Task Notification Flow

```
Task Created/Updated
  ↓
Determine Notification Recipients
  ↓
Create TeamNotification Records
  ↓
Send Real-time Updates (if online)
  ↓
Update Notification Badge Count
  ↓
Log Activity
```

### 3.2 Image Upload Flow

```
User Selects Images
  ↓
Client-side Validation & Compression
  ↓
Upload to Cloud Storage (presigned URL)
  ↓
Store URLs in Message Attachments
  ↓
Create TeamMessage with Attachments
  ↓
Send Notifications to Thread Participants
```

### 3.3 Mention Flow

```
User Types @
  ↓
Fetch Active Team Members
  ↓
Display Autocomplete Dropdown
  ↓
User Selects Member
  ↓
Insert Mention Token
  ↓
On Send: Parse Mentions
  ↓
Create Notifications for Mentioned Users
  ↓
Store Mention IDs in Message
```

---

## 4. Framework & Runtime Checks

### 4.1 Required Services
- ✅ Next.js Dev Server (port 3000)
- ✅ PostgreSQL Database (Supabase/local)
- ✅ Redis (for real-time features, caching)
- ✅ Campaign Worker (background jobs)
- ✅ Ngrok Tunnel (for webhooks, if needed)

### 4.2 Health Check Endpoints
- `GET /api/health/database` - Check DB connection
- `GET /api/health/redis` - Check Redis connection
- `GET /api/health/storage` - Check cloud storage
- `GET /api/health/worker` - Check background worker

---

## 5. API Endpoints

### 5.1 Notifications
- `GET /api/teams/[id]/notifications` - List notifications
- `GET /api/teams/[id]/notifications/unread-count` - Get unread count
- `PATCH /api/teams/[id]/notifications/[notificationId]/read` - Mark as read
- `POST /api/teams/[id]/notifications/mark-all-read` - Mark all as read

### 5.2 Activity Filters
- `GET /api/teams/[id]/activities?memberId=&type=&startDate=&endDate=&page=` - List with filters
- `GET /api/teams/[id]/activities/heatmap?memberId=&startDate=&endDate=` - Heatmap data
- `GET /api/teams/[id]/activities/export?format=csv|json` - Export activities

### 5.3 Members
- `GET /api/teams/[id]/members?search=&role=&status=&sort=` - List with filters
- `POST /api/teams/[id]/members/bulk-update` - Bulk role change
- `DELETE /api/teams/[id]/members/bulk-delete` - Bulk remove
- `GET /api/teams/[id]/members/export` - Export member list

### 5.4 Messages & Threads
- `POST /api/teams/[id]/threads` - Create thread (admin check)
- `POST /api/teams/[id]/messages/upload-image` - Upload image
- `GET /api/teams/[id]/members/autocomplete?q=` - Mention autocomplete

---

## 6. Validation (Zod Schemas)

### 6.1 Task Notification Schema
```typescript
const taskNotificationSchema = z.object({
  taskId: z.string().cuid(),
  recipientIds: z.array(z.string().cuid()),
  type: z.enum(['TASK_ASSIGNED', 'TASK_UPDATED', 'TASK_COMPLETED']),
  metadata: z.object({
    taskTitle: z.string(),
    changesSummary: z.string().optional()
  })
})
```

### 6.2 Activity Filter Schema
```typescript
const activityFilterSchema = z.object({
  memberIds: z.array(z.string().cuid()).optional(),
  types: z.array(z.nativeEnum(TeamActivityType)).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(10).max(100).default(50)
})
```

### 6.3 Image Upload Schema
```typescript
const imageUploadSchema = z.object({
  file: z.instanceof(File),
  caption: z.string().max(500).optional()
}).refine(
  (data) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    return validTypes.includes(data.file.type)
  },
  { message: 'Invalid file type' }
).refine(
  (data) => data.file.size <= 10 * 1024 * 1024,
  { message: 'File too large (max 10MB)' }
)
```

---

## 7. Instrumentation

### 7.1 Logging Points
- Task notification creation
- Image upload start/complete/failure
- Bulk member operations
- Admin action attempts (authorization)
- API endpoint latency
- Background job execution

### 7.2 Metrics
- Notification delivery time (p50, p95, p99)
- Image upload success rate
- Message send latency
- Active user count per team
- API endpoint error rates

---

## 8. QA Test Plan

### 8.1 Unit Tests
- Notification service creates correct notifications
- Image compression maintains quality
- Mention parsing extracts correct user IDs
- Bulk operations handle errors gracefully
- Validation schemas reject invalid input

### 8.2 Integration Tests
- Task creation triggers notifications
- Image upload stores in cloud and DB
- Mention sends notifications to users
- Admin-only endpoints reject non-admins
- Filters correctly query database

### 8.3 E2E Tests
- User creates task → assignee receives notification
- User uploads images → images display in thread
- User mentions member → member receives notification
- Admin creates group → members added
- User applies filters → results update

---

## 9. Implementation Checklist

### Phase 1: Foundation (Database & API)
- [ ] Update Prisma schema with extensions
- [ ] Run database migrations
- [ ] Create validation schemas
- [ ] Implement health check endpoints
- [ ] Set up instrumentation/logging

### Phase 2: Task Notifications
- [ ] Create notification service
- [ ] Update task endpoints to send notifications
- [ ] Create notification API endpoints
- [ ] Build notification dropdown component
- [ ] Add unread badge to team header

### Phase 3: Activity Enhancements
- [ ] Build advanced filter UI for heatmap
- [ ] Implement activity list filters
- [ ] Add export functionality
- [ ] Create comparison metrics

### Phase 4: Members Enhancements
- [ ] Add search functionality
- [ ] Implement bulk selection
- [ ] Create bulk action endpoints
- [ ] Build confirmation modals

### Phase 5: Inbox Features
- [ ] Create welcome message service
- [ ] Add welcome message template editor
- [ ] Implement auto-DM on member join
- [ ] Add admin-only group creation logic

### Phase 6: Conversation Features
- [ ] Implement image upload service
- [ ] Build image upload UI
- [ ] Create image lightbox component
- [ ] Implement mention autocomplete
- [ ] Build mention notification system

### Phase 7: Testing & Polish
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Perform E2E testing
- [ ] Fix lint errors
- [ ] Build production bundle
- [ ] Deploy and verify

---

## 10. Success Criteria

✅ All features implemented according to functional requirements  
✅ All API endpoints respond within performance targets  
✅ Zero linting errors  
✅ Successful production build  
✅ All E2E tests passing  
✅ Runtime services (DB, Redis, Worker) verified  
✅ Documentation complete and up-to-date

---

**Status**: Ready for Implementation  
**Last Updated**: 2025-11-12  
**Next Step**: Begin Phase 1 - Foundation (Database & API)

