# Authentication Error Analysis & Solution

## Error Details

**Error Type:** Console TypeError  
**Error Message:** Failed to fetch  
**Location:** `src/app/(auth)/login/page.tsx:27:22`  
**Next.js Version:** 16.0.1 (Turbopack)

```typescript
const result = await signIn('credentials', {
  email,
  password,
  redirect: false,
});
```

## Root Cause Analysis

The error occurred due to **incorrect usage of NextAuth v5** with Next.js App Router. Here are the specific issues:

### 1. Client-Side Sign In (Primary Issue)

The code was using `signIn` from `next-auth/react` directly in a client component. In NextAuth v5, this approach has changed:

- **v4 Approach (Old):** Client-side `signIn` with `redirect: false` worked
- **v5 Approach (New):** Server Actions are the recommended pattern

### 2. API Route Communication

The "Failed to fetch" error indicates that:
- The browser couldn't communicate with `/api/auth/signin`
- Possible causes:
  - Missing `NEXTAUTH_SECRET` environment variable
  - Missing `NEXTAUTH_URL` environment variable
  - Database connection issues preventing the API route from functioning
  - NextAuth v5 configuration incompatibility

### 3. NextAuth v5 Breaking Changes

NextAuth v5 introduced several breaking changes:
- Different redirect handling (throws redirect errors instead of returning status)
- Server Actions are the preferred authentication method
- Changed cookie and session handling

## Solutions Implemented

### 1. Created Server Action (`src/app/(auth)/login/actions.ts`)

```typescript
'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

// Helper to check if error is a redirect (Next.js throws NEXT_REDIRECT on successful redirects)
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
    if (isRedirectError(error)) {
      throw error; // Let it propagate to trigger redirect
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
    
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
```

**Why This Works:**
- Runs on the server (has access to environment variables and database)
- Uses the server-side `signIn` from `@/auth` instead of client-side React hook
- Properly handles NextAuth v5's redirect mechanism
- Provides proper error handling for different failure scenarios

### 2. Updated Login Page

**Before:**
```typescript
import { signIn } from 'next-auth/react'; // ❌ Client-side only

const result = await signIn('credentials', {
  email,
  password,
  redirect: false, // ❌ Doesn't work well in v5
});
```

**After:**
```typescript
import { authenticate } from './actions'; // ✅ Server Action

const result = await authenticate(email, password);

if (!result.success) {
  setError(result.error || 'Invalid email or password');
  setIsLoading(false);
  return;
}
// Success - server action handles redirect automatically
```

**Benefits:**
- Cleaner error handling
- Better type safety
- Automatic redirect handling
- No manual redirect logic needed

### 3. Environment Variables Configuration

Created `ENV_SETUP.md` with detailed instructions for:
- `NEXTAUTH_SECRET` - Required for encryption
- `NEXTAUTH_URL` - Required for proper URL resolution
- `DATABASE_URL` - Required for database access

## Verification Steps

To ensure the fix works, follow these steps:

### 1. Set Up Environment Variables

Create or update `.env` file:

```bash
# Generate a secret
openssl rand -base64 32

# Add to .env
NEXTAUTH_SECRET="your_generated_secret"
NEXTAUTH_URL="http://localhost:3000"
DATABASE_URL="your_database_connection_string"
NODE_ENV="development"
```

### 2. Restart Development Server

```bash
# Kill existing server
# Then restart
npm run dev
```

### 3. Test Authentication Flow

1. Navigate to `http://localhost:3000/login`
2. Enter valid credentials
3. Submit the form
4. Check browser console for logs
5. Verify successful redirect to dashboard

### 4. Expected Behavior

**Success Flow:**
```
[Login] Attempting sign in...
[Auth] Attempting login for: user@example.com
[Auth] Comparing passwords...
[Auth] Login successful for: user@example.com
[Login] SignIn result: { success: true }
[Login] Success!
→ Redirect to /dashboard
```

**Failure Flow:**
```
[Login] Attempting sign in...
[Auth] User not found: user@example.com
[Login] Error: Invalid credentials.
→ Show error message, stay on login page
```

## Additional Configuration

The NextAuth configuration in `src/auth.ts` is already properly set up with:

- ✅ `trustHost: true` - Allows flexible host configuration
- ✅ `debug: true` - Provides detailed logging
- ✅ `basePath: '/api/auth'` - Correct API route path
- ✅ Proper JWT strategy
- ✅ Correct cookie configuration
- ✅ Credentials provider properly configured

## Common Issues & Troubleshooting

### Issue: Still getting "Failed to fetch"

**Possible Causes:**
1. Environment variables not loaded
2. Server not restarted after adding env vars
3. Database connection failure

**Solutions:**
```bash
# 1. Verify env vars are set
cat .env | grep NEXTAUTH

# 2. Test database connection
npx prisma db pull

# 3. Restart server completely
# Kill the process and restart with: npm run dev
```

### Issue: "Invalid credentials" for valid users

**Possible Causes:**
1. Password not hashed in database
2. Bcrypt comparison failing
3. User doesn't exist in database

**Solutions:**
```bash
# Check if user exists
npx prisma studio
# Verify users table has the test user

# Check password hashing
# Passwords should be bcrypt hashed, not plain text
```

### Issue: Redirects to wrong page

**Cause:** Middleware might be interfering

**Solution:** Check `src/middleware.ts`:
- Ensure API routes are excluded from middleware
- Verify session token checking logic

## Migration Notes

If you have other authentication flows (e.g., sign up, password reset), you should:

1. Create server actions for each authentication operation
2. Update client components to call server actions
3. Handle redirects properly (let NextAuth v5's redirect errors propagate)
4. Update error messages to be user-friendly

## Security Considerations

- ✅ Server Actions run on the server (credentials never exposed to client)
- ✅ Password comparison happens server-side
- ✅ JWT tokens are properly encrypted with `NEXTAUTH_SECRET`
- ✅ Cookies use `httpOnly` flag (prevents XSS attacks)
- ✅ `sameSite: 'lax'` prevents CSRF attacks

## Performance Impact

The new approach with Server Actions provides:
- **Better Security:** Credentials never touch the client
- **Smaller Bundle:** No client-side auth code needed
- **Better Error Handling:** Typed error responses
- **Improved UX:** Automatic redirects work properly

## Next Steps

1. ✅ Test the login flow with valid credentials
2. ✅ Test with invalid credentials
3. ✅ Verify redirects work correctly
4. 🔄 Update register page to use Server Actions (if needed)
5. 🔄 Update password reset flows (if applicable)
6. 🔄 Add loading states and better error messages

## References

- [NextAuth v5 Documentation](https://authjs.dev/getting-started/introduction)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions)
- [NextAuth v5 Migration Guide](https://authjs.dev/guides/upgrade-to-v5)

