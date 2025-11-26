import { NextResponse } from 'next/server';

interface ValidatedSession {
  user: {
    id: string;
    organizationId: string;
    email?: string;
    name?: string;
    role?: string;
    [key: string]: any;
  };
}

/**
 * Validates session and returns error response if invalid
 * Use this in API routes to ensure session has required fields
 * Returns null if valid, or an error response if invalid
 */
export function validateSession(session: any): { error: NextResponse } | { session: ValidatedSession } {
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (!session.user.organizationId) {
    return {
      error: NextResponse.json(
        { error: 'User organization not found. Please complete your profile.' },
        { status: 403 }
      ),
    };
  }

  if (!session.user.id) {
    return {
      error: NextResponse.json(
        { error: 'User ID not found. Please try logging in again.' },
        { status: 403 }
      ),
    };
  }

  return { session: session as ValidatedSession };
}

