import { getSession as getSupabaseSession } from './supabase/auth-helpers';

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  organizationId: string;
  activeTeamId?: string;
}

export interface Session {
  user: SessionUser;
}

/**
 * Get the current session using Supabase Auth
 * Use this in Server Components and API routes
 */
export async function getSession(): Promise<Session | null> {
  return await getSupabaseSession();
}

