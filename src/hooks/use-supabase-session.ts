'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface SessionData {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  } | null;
  isLoading: boolean;
}

/**
 * Hook to get the current Supabase session in client components
 * Compatible with the old useSession hook from NextAuth
 */
export function useSupabaseSession() {
  const [session, setSession] = useState<SessionData>({
    user: null,
    isLoading: true,
  });

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession({
        user: session?.user
          ? {
              id: session.user.id,
              email: session.user.email!,
              name: session.user.user_metadata.name || null,
              image: session.user.user_metadata.image || null,
            }
          : null,
        isLoading: false,
      });
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession({
        user: session?.user
          ? {
              id: session.user.id,
              email: session.user.email!,
              name: session.user.user_metadata.name || null,
              image: session.user.user_metadata.image || null,
            }
          : null,
        isLoading: false,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  return session;
}

/**
 * Get Supabase signOut function
 */
export function useSignOut() {
  return async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };
}

