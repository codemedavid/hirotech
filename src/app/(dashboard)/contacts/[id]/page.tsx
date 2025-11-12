import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { ContactTagEditorOptimized } from '@/components/contacts/contact-tag-editor-optimized';
import { ActivityTimeline } from '@/components/contacts/activity-timeline';
import Link from 'next/link';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface ContactDetailPageProps {
  params: Promise<{ id: string }>;
}

// Separate data fetching functions with caching
async function getContact(id: string, organizationId: string) {
  const contact = await prisma.contact.findFirst({
    where: {
      id,
      organizationId,
    },
    include: {
      stage: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
      pipeline: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!contact) {
    notFound();
  }

  return contact;
}

async function getContactActivities(contactId: string, organizationId: string) {
  return prisma.contactActivity.findMany({
    where: {
      contactId,
      contact: {
        organizationId,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
  });
}

async function getTags(organizationId: string) {
  return prisma.tag.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      color: true,
    },
    orderBy: { name: 'asc' },
  });
}

// Loading components for Suspense boundaries
function ProfileSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-6 w-32 mt-4" />
        </div>
        <Separator />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivitySkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Server component for profile section
async function ContactProfile({ contactId, organizationId }: { contactId: string; organizationId: string }) {
  const [contact, availableTags] = await Promise.all([
    getContact(contactId, organizationId),
    getTags(organizationId),
  ]);

  return (
    <div className="md:col-span-1 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center">
            <Avatar className="h-24 w-24">
              <AvatarImage src={contact.profilePicUrl || undefined} />
              <AvatarFallback className="text-2xl">
                {contact.firstName[0]}
                {contact.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 text-xl font-bold">
              {contact.firstName} {contact.lastName}
            </h2>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Lead Score</span>
              <Badge variant="default">{contact.leadScore}</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant="outline">{contact.leadStatus}</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Platforms</span>
              <div className="flex gap-1">
                {contact.hasMessenger && (
                  <Badge variant="secondary" className="text-xs">
                    Messenger
                  </Badge>
                )}
                {contact.hasInstagram && (
                  <Badge variant="secondary" className="text-xs">
                    Instagram
                  </Badge>
                )}
              </div>
            </div>

            {contact.pipeline && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pipeline</span>
                <span className="text-sm font-medium">{contact.pipeline.name}</span>
              </div>
            )}

            {contact.stage && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Stage</span>
                <Badge
                  variant="outline"
                  style={{
                    backgroundColor: `${contact.stage.color}20`,
                    color: contact.stage.color,
                  }}
                >
                  {contact.stage.name}
                </Badge>
              </div>
            )}
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-2">Tags</h4>
            <ContactTagEditorOptimized
              contactId={contact.id}
              currentTags={contact.tags}
              availableTags={availableTags}
            />
          </div>

          <Separator />

          <Button className="w-full">
            <MessageSquare className="h-4 w-4 mr-2" />
            Send Message
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Server component for activity section
async function ContactActivity({ contactId, organizationId }: { contactId: string; organizationId: string }) {
  const [contact, activities] = await Promise.all([
    getContact(contactId, organizationId),
    getContactActivities(contactId, organizationId),
  ]);

  return (
    <div className="md:col-span-2 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {contact.notes ? (
            <p className="text-sm">{contact.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No notes yet</p>
          )}
        </CardContent>
      </Card>

      {contact.aiContext && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>AI Context</CardTitle>
              {contact.aiContextUpdatedAt && (
                <span className="text-xs text-muted-foreground">
                  Updated {new Date(contact.aiContextUpdatedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {contact.aiContext}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityTimeline activities={activities} />
        </CardContent>
      </Card>
    </div>
  );
}

// Main page component with streaming
export default async function ContactDetailPage({ params }: ContactDetailPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="mb-4">
        <Link href="/contacts">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Contacts
        </Link>
      </Button>

      <div className="grid gap-6 md:grid-cols-3">
        <Suspense fallback={<ProfileSkeleton />}>
          <ContactProfile contactId={id} organizationId={session.user.organizationId} />
        </Suspense>

        <Suspense fallback={<ActivitySkeleton />}>
          <ContactActivity contactId={id} organizationId={session.user.organizationId} />
        </Suspense>
      </div>
    </div>
  );
}

// Enable static params caching for production
export const dynamic = 'force-dynamic';
export const revalidate = 0;
