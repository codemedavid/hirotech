'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
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

interface ContactsResponse {
  contacts: Contact[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

interface UseContactsOptions {
  initialData?: ContactsResponse;
  enabled?: boolean;
}

function buildQueryKey(searchParams: URLSearchParams): unknown[] {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  // Sort keys for consistent query key generation
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, string>);
  return ['contacts', sortedParams];
}

async function fetchContacts(searchParams: URLSearchParams): Promise<ContactsResponse> {
  const params = new URLSearchParams(searchParams);
  params.set('limit', '20'); // Match server-side limit
  
  const response = await fetch(`/api/contacts?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch contacts');
  }
  return response.json();
}

export function useContacts(options: UseContactsOptions = {}) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  
  // Get page explicitly to ensure reactivity
  const page = searchParams.get('page') || '1';
  
  const queryKey = buildQueryKey(searchParams);
  
  // Add page as explicit dependency to ensure query updates when page changes
  // This helps with shallow routing where useSearchParams might not trigger immediately
  const queryKeyWithPage = [...queryKey, page];
  
  // Build the initial query key from initialData to compare
  // We need to reconstruct what the initial searchParams were
  const getInitialQueryKey = () => {
    if (!options.initialData) return null;
    // Reconstruct initial search params - we need to get all current params
    // and set page to the initial page
    const initialParams = new URLSearchParams(searchParams);
    initialParams.set('page', options.initialData.pagination.page.toString());
    const baseKey = buildQueryKey(initialParams);
    return [...baseKey, options.initialData.pagination.page.toString()];
  };
  
  const initialQueryKey = getInitialQueryKey();
  const isInitialQuery = initialQueryKey && 
    JSON.stringify(queryKeyWithPage) === JSON.stringify(initialQueryKey);
  
  const query = useQuery({
    queryKey: queryKeyWithPage,
    queryFn: () => fetchContacts(searchParams),
    // Only use initialData for the exact initial query
    initialData: isInitialQuery ? options.initialData : undefined,
    enabled: options.enabled !== false,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    // Only keep previous data if it's from the same query (same filters, different page)
    // This prevents showing wrong page data
    placeholderData: (previousData) => {
      // Only use previous data if we have it and it's valid
      // React Query will handle showing it during transitions
      return previousData;
    },
    // Ensure we refetch when query key changes
    refetchOnMount: 'always',
  });

  // Prefetch adjacent pages
  const prefetchPage = (pageNum: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', pageNum.toString());
    const prefetchKey = buildQueryKey(newParams);
    
    queryClient.prefetchQuery({
      queryKey: [...prefetchKey, pageNum.toString()],
      queryFn: () => fetchContacts(newParams),
      staleTime: 60 * 1000,
    });
  };

  return {
    ...query,
    prefetchPage,
  };
}

