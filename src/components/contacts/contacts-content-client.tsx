'use client';

import { useContacts } from '@/hooks/use-contacts';
import { ContactsTable } from '@/components/contacts/contacts-table';
import { ContactsPagination } from '@/components/contacts/contacts-pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { Users } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useSearchParams } from 'next/navigation';

interface Contact {
  id: string;
  firstName: string;
  lastName: string | null;
  profilePicUrl: string | null;
  hasMessenger: boolean;
  hasInstagram: boolean;
  leadScore: number;
  tags: string[];
  lastInteraction: Date | null;
  stage: {
    id: string;
    name: string;
    color: string;
  } | null;
  facebookPage: {
    id: string;
    pageName: string;
    instagramUsername: string | null;
  };
  createdAt: Date | string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Pipeline {
  id: string;
  name: string;
  stages: {
    id: string;
    name: string;
    color: string;
  }[];
}

interface ContactsContentClientProps {
  initialData: {
    contacts: Contact[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  };
  tags: Tag[];
  pipelines: Pipeline[];
  hasFilters: boolean;
}

export function ContactsContentClient({
  initialData,
  tags,
  pipelines,
  hasFilters,
}: ContactsContentClientProps) {
  const searchParams = useSearchParams();
  const currentPage = parseInt(searchParams.get('page') || '1');
  
  const { data, isLoading, isFetching, prefetchPage } = useContacts({
    initialData,
    enabled: true,
  });

  const contacts = data?.contacts || [];
  
  // Use current page from URL, not from data fallback, to avoid circular issues
  const pagination = data?.pagination || {
    ...initialData.pagination,
    page: currentPage, // Use current page from URL
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (contacts.length === 0 && !hasFilters) {
    return (
      <EmptyState
        icon={<Users className="h-12 w-12" />}
        title="No contacts yet"
        description="Connect your Facebook page and sync contacts to get started"
        action={{
          label: 'Go to Integrations',
          href: '/settings/integrations',
        }}
      />
    );
  }

  if (contacts.length === 0 && hasFilters) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No contacts found</h3>
        <p className="text-muted-foreground">
          Try adjusting your filters to see more results
        </p>
      </div>
    );
  }

  return (
    <>
      <ContactsTable 
        contacts={contacts} 
        tags={tags} 
        pipelines={pipelines}
        isLoading={isFetching && !isLoading}
      />

      {pagination.pages > 1 && (
        <ContactsPagination
          currentPage={pagination.page}
          totalPages={pagination.pages}
          totalContacts={pagination.total}
          limit={pagination.limit}
          onPrefetchPage={prefetchPage}
        />
      )}
    </>
  );
}

