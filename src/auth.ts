import { getSession } from '@/lib/supabase/auth-helpers';

/**
 * Get the current authenticated session
 * This is a wrapper around getSession for compatibility
 * Use this in Server Components
 */
export async function auth() {
  return await getSession();
}

