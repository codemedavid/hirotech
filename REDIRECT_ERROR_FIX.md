# Redirect Error Fix - Quick Note

## Error Encountered
```
(0 , isRedirectError) is not a function
at authenticate (src\app\(auth)\login\actions.ts:19:24)
```

## Root Cause
The original code tried to import `isRedirectError` from an internal Next.js path:
```typescript
import { isRedirectError } from 'next/dist/client/components/redirect'; // ❌ Not available
```

This internal module is not exposed as a public API in Next.js 16.

## Solution Applied

Created a custom `isRedirectError` helper function that checks for Next.js redirect errors by examining the error's digest property:

```typescript
// Helper to check if error is a redirect (Next.js throws NEXT_REDIRECT on successful redirects)
function isRedirectError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const err = error as { digest?: string };
    return err.digest?.includes('NEXT_REDIRECT') ?? false;
  }
  return false;
}
```

## How It Works

1. Next.js App Router uses a special error mechanism for redirects
2. Redirect "errors" have a `digest` property that contains `'NEXT_REDIRECT'`
3. Our helper function checks for this pattern
4. When detected, we re-throw the error to let Next.js handle the redirect

## Why This Approach?

- ✅ **Works with Next.js 16:** Uses the internal redirect mechanism
- ✅ **Type-safe:** Properly handles unknown error types
- ✅ **Future-proof:** Works with the Next.js redirect pattern
- ✅ **No external dependencies:** Self-contained solution

## Complete Fixed Code

```typescript
'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

// Helper to check if error is a redirect
function isRedirectError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const err = error as { digest?: string };
    return err.digest?.includes('NEXT_REDIRECT') ?? false;
  }
  return false;
}

export async function authenticate(email: string, password: string) {
  try {
    const result = await signIn('credentials', {
      email,
      password,
      redirectTo: '/dashboard',
    });
    
    return { success: true, data: result };
  } catch (error) {
    // NextAuth v5 throws a redirect error on successful sign in
    // We need to let it propagate to trigger the redirect
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { success: false, error: 'Invalid credentials.' };
        case 'CallbackRouteError':
          return { success: false, error: 'Invalid credentials.' };
        default:
          return { success: false, error: 'Something went wrong.' };
      }
    }
    
    console.error('[Auth] Unexpected error:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
```

## Testing

After this fix, the authentication flow should work correctly:

1. **Successful login:** Redirects to `/dashboard` (no error thrown to client)
2. **Failed login:** Returns error message without crashing
3. **No console errors:** `isRedirectError` works properly

## Status
✅ **FIXED** - The error is resolved and authentication should work correctly now.

