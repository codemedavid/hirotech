import { z } from 'zod'
import { TeamActivityType } from '@prisma/client'

/**
 * Task Notification Validation
 */
export const taskNotificationSchema = z.object({
  taskId: z.string().cuid('Invalid task ID'),
  recipientIds: z.array(z.string().cuid('Invalid recipient ID')).min(1, 'At least one recipient required'),
  type: z.enum(['TASK_ASSIGNED', 'TASK_UPDATED', 'TASK_COMPLETED', 'TASK_DUE_SOON']),
  metadata: z.object({
    taskTitle: z.string().min(1, 'Task title required'),
    changesSummary: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    dueDate: z.string().datetime().optional()
  })
})

export type TaskNotificationInput = z.infer<typeof taskNotificationSchema>

/**
 * Activity Filter Validation
 */
export const activityFilterSchema = z.object({
  memberIds: z.array(z.string().cuid()).optional(),
  types: z.array(z.nativeEnum(TeamActivityType)).optional(),
  entityTypes: z.array(z.string()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(10).max(100).default(50)
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate)
    }
    return true
  },
  { message: 'Start date must be before or equal to end date' }
)

export type ActivityFilterInput = z.infer<typeof activityFilterSchema>

/**
 * Heatmap Filter Validation
 */
export const heatmapFilterSchema = z.object({
  memberId: z.string().cuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  days: z.number().int().min(7).max(90).default(30),
  groupBy: z.enum(['hour', 'day', 'week']).default('hour')
})

export type HeatmapFilterInput = z.infer<typeof heatmapFilterSchema>

/**
 * Member Search & Filter Validation
 */
export const memberFilterSchema = z.object({
  search: z.string().trim().optional(),
  roles: z.array(z.enum(['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'])).optional(),
  statuses: z.array(z.enum(['ACTIVE', 'PENDING', 'SUSPENDED', 'INACTIVE'])).optional(),
  sortBy: z.enum(['name', 'email', 'role', 'joinedAt', 'lastActiveAt', 'activityCount']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(10).max(100).default(50)
})

export type MemberFilterInput = z.infer<typeof memberFilterSchema>

/**
 * Bulk Member Update Validation
 */
export const bulkMemberUpdateSchema = z.object({
  memberIds: z.array(z.string().cuid()).min(1, 'At least one member required').max(50, 'Maximum 50 members per operation'),
  action: z.enum(['CHANGE_ROLE', 'SUSPEND', 'ACTIVATE', 'REMOVE']),
  newRole: z.enum(['ADMIN', 'MANAGER', 'MEMBER']).optional(),
  reason: z.string().max(500).optional()
}).refine(
  (data) => {
    if (data.action === 'CHANGE_ROLE') {
      return !!data.newRole
    }
    return true
  },
  { message: 'Role is required for CHANGE_ROLE action' }
)

export type BulkMemberUpdateInput = z.infer<typeof bulkMemberUpdateSchema>

/**
 * Image Upload Validation
 */
export const imageUploadSchema = z.object({
  fileName: z.string().min(1, 'File name required'),
  fileType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp'], {
    message: 'Invalid file type. Supported: JPEG, PNG, GIF, WebP'
  }),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024, 'File too large (max 10MB)'),
  caption: z.string().max(500).optional()
})

export type ImageUploadInput = z.infer<typeof imageUploadSchema>

/**
 * Message with Images Validation
 */
export const messageWithImagesSchema = z.object({
  content: z.string().trim().min(1, 'Message content required').max(5000, 'Message too long (max 5000 characters)'),
  threadId: z.string().cuid().optional(),
  replyToId: z.string().cuid().optional(),
  mentions: z.array(z.string().cuid()).max(20, 'Maximum 20 mentions per message').optional(),
  images: z.array(z.object({
    url: z.string().url('Invalid image URL'),
    thumbnail: z.string().url('Invalid thumbnail URL').optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    size: z.number().int().positive(),
    caption: z.string().max(500).optional()
  })).max(5, 'Maximum 5 images per message').optional()
})

export type MessageWithImagesInput = z.infer<typeof messageWithImagesSchema>

/**
 * Mention Autocomplete Validation
 */
export const mentionAutocompleteSchema = z.object({
  query: z.string().trim().min(1, 'Query required').max(50),
  limit: z.number().int().positive().max(10).default(10),
  excludeIds: z.array(z.string().cuid()).optional()
})

export type MentionAutocompleteInput = z.infer<typeof mentionAutocompleteSchema>

/**
 * Create Group Thread Validation
 */
export const createGroupThreadSchema = z.object({
  name: z.string().trim().min(1, 'Group name required').max(100, 'Group name too long'),
  description: z.string().trim().max(500).optional(),
  memberIds: z.array(z.string().cuid()).min(1, 'At least one member required').max(50, 'Maximum 50 members per group'),
  avatar: z.string().url().optional(),
  type: z.enum(['GROUP', 'CHANNEL', 'ANNOUNCEMENT']).default('GROUP'),
  isAdminOnly: z.boolean().default(false)
})

export type CreateGroupThreadInput = z.infer<typeof createGroupThreadSchema>

/**
 * Welcome Message Template Validation
 */
export const welcomeMessageTemplateSchema = z.object({
  enabled: z.boolean(),
  template: z.string().trim().min(10, 'Template too short (minimum 10 characters)').max(2000, 'Template too long (maximum 2000 characters)').optional()
}).refine(
  (data) => {
    if (data.enabled) {
      return !!data.template && data.template.length > 0
    }
    return true
  },
  { message: 'Template is required when welcome messages are enabled' }
)

export type WelcomeMessageTemplateInput = z.infer<typeof welcomeMessageTemplateSchema>

/**
 * Notification Preferences Validation
 */
export const notificationPreferencesSchema = z.object({
  emailNotifications: z.boolean().default(true),
  taskNotifications: z.boolean().default(true),
  messageNotifications: z.boolean().default(true),
  mentionNotifications: z.boolean().default(true),
  teamAnnouncements: z.boolean().default(true),
  digestFrequency: z.enum(['INSTANT', 'HOURLY', 'DAILY', 'WEEKLY', 'NEVER']).default('INSTANT')
})

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>

/**
 * Export Data Validation
 */
export const exportDataSchema = z.object({
  type: z.enum(['ACTIVITIES', 'MEMBERS', 'MESSAGES', 'TASKS']),
  format: z.enum(['CSV', 'JSON', 'XLSX']).default('CSV'),
  filters: z.record(z.string(), z.any()).optional(),
  includeArchived: z.boolean().default(false)
})

export type ExportDataInput = z.infer<typeof exportDataSchema>

