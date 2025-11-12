import {
  MessageSquare,
  Tag,
  GitBranch,
  User,
  FileText,
} from 'lucide-react';

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string | Date;
  user?: {
    name: string | null;
  } | null;
}

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  MESSAGE_SENT: MessageSquare,
  MESSAGE_RECEIVED: MessageSquare,
  TAG_ADDED: Tag,
  TAG_REMOVED: Tag,
  STAGE_CHANGED: GitBranch,
  NOTE_ADDED: FileText,
  STATUS_CHANGED: User,
};

// Server-side relative time formatter using native Intl API
function getRelativeTimeString(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  
  if (diffInSeconds < 60) {
    return rtf.format(-diffInSeconds, 'second');
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return rtf.format(-diffInMinutes, 'minute');
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return rtf.format(-diffInHours, 'hour');
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return rtf.format(-diffInDays, 'day');
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return rtf.format(-diffInMonths, 'month');
  }
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return rtf.format(-diffInYears, 'year');
}

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (!activities || activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No activity yet</p>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => {
        const Icon = activityIcons[activity.type] || FileText;
        const activityDate = new Date(activity.createdAt);
        const relativeTime = getRelativeTimeString(activityDate);
        
        return (
          <div key={activity.id} className="flex gap-4">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-background">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              {index < activities.length - 1 && (
                <div className="absolute left-5 top-10 h-full w-px bg-border" />
              )}
            </div>

            <div className="flex-1 space-y-1 pb-8">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{activity.title}</p>
                <time 
                  className="text-xs text-muted-foreground"
                  dateTime={activityDate.toISOString()}
                  title={activityDate.toLocaleString()}
                >
                  {relativeTime}
                </time>
              </div>
              {activity.description && (
                <p className="text-sm text-muted-foreground">
                  {activity.description}
                </p>
              )}
              {activity.user?.name && (
                <p className="text-xs text-muted-foreground">
                  by {activity.user.name}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
