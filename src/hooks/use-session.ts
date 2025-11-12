'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role?: string;
  organizationId?: string;
  activeTeamId?: string | null;
  teamContext?: {
    teamId: string;
    teamName: string;
    memberId: string;
    memberRole: string;
    memberStatus: string;
  } | null;
}

export interface SessionData {
  user: SessionUser | null;
}

export interface UseSessionReturn {
  data: SessionData | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
}

/**
 * Hook compatible with next-auth's useSession
 * Uses Supabase for auth and fetches user profile from database
 */
export function useSession(): UseSessionReturn {
  const [session, setSession] = useState<SessionData | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    const supabase = createClient();
    
    // Fetch user profile from database
    async function fetchUserProfile(userId: string) {
      try {
        const response = await fetch('/api/auth/check-session');
        if (response.ok) {
          const data = await response.json();
          return data.user;
        }
        return null;
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
        return null;
      }
    }

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session: supabaseSession } }) => {
      if (supabaseSession?.user) {
        // Fetch full user profile with organization and team data
        const userProfile = await fetchUserProfile(supabaseSession.user.id);
        
        setSession({
          user: userProfile || {
            id: supabaseSession.user.id,
            email: supabaseSession.user.email!,
            name: supabaseSession.user.user_metadata.name || null,
            image: supabaseSession.user.user_metadata.image || null,
          },
        });
        setStatus('authenticated');
      } else {
        setSession(null);
        setStatus('unauthenticated');
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, supabaseSession) => {
      if (supabaseSession?.user) {
        const userProfile = await fetchUserProfile(supabaseSession.user.id);
        
        setSession({
          user: userProfile || {
            id: supabaseSession.user.id,
            email: supabaseSession.user.email!,
            name: supabaseSession.user.user_metadata.name || null,
            image: supabaseSession.user.user_metadata.image || null,
          },
        });
        setStatus('authenticated');
      } else {
        setSession(null);
        setStatus('unauthenticated');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { data: session, status };
}

