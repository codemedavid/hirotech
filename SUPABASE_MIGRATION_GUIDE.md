# 🔄 Migration from NextAuth to Supabase Auth - Complete Guide

## 📋 Overview

The authentication system has been completely migrated from NextAuth to Supabase Auth SSR. This provides a more robust, scalable authentication solution with built-in features like email verification, password reset, and OAuth providers.

---

## ✅ What Was Changed

### 1. **Authentication Provider**
- **Before:** NextAuth with custom credentials provider
- **After:** Supabase Auth with email/password

### 2. **Session Management**
- **Before:** JWT tokens managed by NextAuth
- **After:** Supabase Auth sessions with automatic token refresh

### 3. **User Storage**
- **Before:** Users stored only in PostgreSQL via Prisma
- **After:** 
  - Auth credentials managed by Supabase Auth
  - User profiles and org data stored in PostgreSQL via Prisma
  - User ID synchronized between both systems

---

## 📁 Files Created

### Core Supabase Utilities
1. **`src/lib/supabase/client.ts`** - Browser client for client components
2. **`src/lib/supabase/server.ts`** - Server client for server components/API routes
3. **`src/lib/supabase/auth-helpers.ts`** - Helper functions for auth operations

### React Hooks
4. **`src/hooks/use-supabase-session.ts`** - Client-side session hook (replaces `useSession`)

### API Routes
5. **`src/app/api/auth/register-profile/route.ts`** - Creates user profile after Supabase registration

### Documentation
6. **`.env.example`** - Environment variables template
7. **`SUPABASE_MIGRATION_GUIDE.md`** - This file

---

## 📝 Files Modified

### Auth Pages
- ✅ **`src/app/(auth)/login/page.tsx`** - Now uses Supabase `signInWithPassword`
- ✅ **`src/app/(auth)/register/page.tsx`** - Now uses Supabase `signUp`

### Middleware
- ✅ **`src/middleware.ts`** - Uses Supabase Auth SSR pattern

### Components
- ✅ **`src/components/layout/header.tsx`** - Uses `useSupabaseSession` hook
- ✅ **`src/lib/get-session.ts`** - Uses Supabase auth helpers
- ✅ **`src/lib/teams/check-permission.ts`** - Uses `getAuthUser()`

---

## 🗑️ Files Deleted

1. **`src/auth.ts`** - NextAuth configuration
2. **`src/app/api/auth/[...nextauth]/route.ts`** - NextAuth API handler
3. **`src/app/api/auth/register/route.ts`** - Old registration endpoint
4. **`src/app/api/auth/test-db/route.ts`** - NextAuth debug endpoint

---

## 🔧 Required Environment Variables

Add these to your `.env.local` file:

```env
# Database (existing)
DATABASE_URL="postgresql://user:password@host:port/database"
DIRECT_URL="postgresql://user:password@host:port/database"

# Supabase (NEW - REQUIRED)
NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# Remove these (no longer needed):
# NEXTAUTH_URL
# NEXTAUTH_SECRET
```

### How to Get Supabase Credentials

1. **Create a Supabase project:**
   - Go to https://supabase.com
   - Click "New Project"
   - Choose your organization
   - Set project name, database password, region

2. **Get your credentials:**
   - Go to Project Settings → API
   - Copy "Project URL" → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy "anon public" key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 🏗️ Supabase Project Setup

### 1. Create Authentication Settings

In your Supabase Dashboard → Authentication → Settings:

- **Email Auth:** Enabled
- **Email Confirmations:** Optional (set based on your needs)
  - Enabled = users must verify email before logging in
  - Disabled = users can login immediately after registration

- **Site URL:** `http://localhost:3000` (development) or your production URL
- **Redirect URLs:** Add your callback URLs if needed

### 2. Database Setup (Optional)

Supabase provides its own auth tables automatically. Your existing Prisma database will continue to store:
- User profiles
- Organizations
- Business data

The `user.id` in your Prisma database will match the Supabase Auth `user.id`.

---

## 🚀 How the New Flow Works

### Registration Flow

```
User fills form
    ↓
Client: supabase.auth.signUp()
    ↓
Supabase creates auth user
    ↓
Client: POST /api/auth/register-profile
    ↓
Server: Create org & user profile in Prisma DB
    ↓
User logged in (if email confirmation disabled)
OR
Email sent for confirmation (if enabled)
```

### Login Flow

```
User enters credentials
    ↓
Client: supabase.auth.signInWithPassword()
    ↓
Supabase verifies credentials
    ↓
Session created & stored in cookies
    ↓
Middleware validates session on each request
    ↓
User accesses protected pages
```

### Protected Route Access

```
User requests /dashboard
    ↓
Middleware: supabase.auth.getUser()
    ↓
If logged in: Allow access
If logged out: Redirect to /login
```

---

## 📚 Code Migration Patterns

### Pattern 1: Server Components / API Routes

**Before (NextAuth):**
```typescript
import { auth } from '@/auth';

export default async function Page() {
  const session = await auth();
  const user = session?.user;
  
  if (!user) {
    redirect('/login');
  }
  
  return <div>Hello {user.name}</div>;
}
```

**After (Supabase):**
```typescript
import { getAuthUser } from '@/lib/supabase/auth-helpers';
// OR
import { getSession } from '@/lib/get-session';

export default async function Page() {
  const user = await getAuthUser();
  // OR
  const session = await getSession();
  const user = session?.user;
  
  if (!user) {
    redirect('/login');
  }
  
  return <div>Hello {user.name}</div>;
}
```

### Pattern 2: API Routes

**Before (NextAuth):**
```typescript
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Use session.user.id
  const data = await fetchUserData(session.user.id);
  return NextResponse.json(data);
}
```

**After (Supabase):**
```typescript
import { getAuthUser } from '@/lib/supabase/auth-helpers';

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Use user.id
  const data = await fetchUserData(user.id);
  return NextResponse.json(data);
}
```

### Pattern 3: Client Components

**Before (NextAuth):**
```typescript
'use client';

import { useSession, signOut } from 'next-auth/react';

export function Component() {
  const { data: session, status } = useSession();
  
  if (status === 'loading') return <div>Loading...</div>;
  
  return (
    <div>
      <p>{session?.user?.email}</p>
      <button onClick={() => signOut()}>Logout</button>
    </div>
  );
}
```

**After (Supabase):**
```typescript
'use client';

import { useSupabaseSession, useSignOut } from '@/hooks/use-supabase-session';

export function Component() {
  const { user, isLoading } = useSupabaseSession();
  const signOut = useSignOut();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <p>{user?.email}</p>
      <button onClick={signOut}>Logout</button>
    </div>
  );
}
```

---

## 🔍 Testing Your Migration

### 1. Environment Setup
```bash
# Make sure you have Supabase credentials in .env.local
cat .env.local | grep SUPABASE

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate
```

### 2. Test Registration
1. Start dev server: `npm run dev`
2. Go to `http://localhost:3000/register`
3. Fill in all fields
4. Submit form
5. Check console logs for:
   - ✅ Supabase user created
   - ✅ Profile created in database
6. Should redirect to dashboard (or show email confirmation message)

### 3. Test Login
1. Go to `http://localhost:3000/login`
2. Enter registered credentials
3. Check console logs for:
   - ✅ Supabase authentication successful
   - ✅ Session created
4. Should redirect to dashboard

### 4. Test Protected Routes
1. Logout (clear cookies or use logout button)
2. Try accessing `http://localhost:3000/dashboard`
3. Should redirect to `/login`
4. Login again
5. Should be able to access dashboard

### 5. Test Session Persistence
1. Login successfully
2. Refresh the page
3. Should remain logged in
4. Close browser and reopen
5. Should still be logged in (unless session expired)

---

## 🐛 Troubleshooting

### Issue 1: "Invalid API key" error

**Solution:**
- Check `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set correctly
- Make sure it's the "anon public" key, not the "service role" key
- Restart dev server after changing .env.local

### Issue 2: "Auth session missing" error

**Solution:**
- Check `NEXT_PUBLIC_SUPABASE_URL` is correct
- Make sure middleware is properly configured
- Clear browser cookies and try again

### Issue 3: Registration succeeds but profile creation fails

**Solution:**
- Check database connection
- Make sure `DATABASE_URL` is correct
- Verify Prisma schema is up to date: `npx prisma db push`
- Check that the user.id field accepts the Supabase UUID format

### Issue 4: "Email not confirmed" error on login

**Solution:**
- In Supabase Dashboard → Authentication → Settings
- Disable "Enable email confirmations" for development
- OR check your email for confirmation link
- OR manually confirm user in Supabase Dashboard → Authentication → Users

### Issue 5: Existing API routes still use old `auth()` function

**Solution:**
- Find all instances: `grep -r "from '@/auth'" src/`
- Replace with:
  ```typescript
  import { getAuthUser } from '@/lib/supabase/auth-helpers';
  const user = await getAuthUser();
  ```

---

## 📊 Migration Checklist

Use this checklist to ensure complete migration:

- [ ] Supabase project created
- [ ] Environment variables set in `.env.local`
- [ ] Dev server starts without errors
- [ ] Can register new user
- [ ] Can login with registered user
- [ ] Protected routes redirect when logged out
- [ ] Protected routes accessible when logged in
- [ ] User profile shows correct data in header
- [ ] Logout functionality works
- [ ] All API routes updated (if applicable)
- [ ] All client components updated (if applicable)
- [ ] No references to NextAuth remain in code
- [ ] Build succeeds: `npm run build`
- [ ] No linting errors: `npm run lint`

---

## 🎯 Benefits of Supabase Auth

### vs NextAuth

| Feature | NextAuth | Supabase Auth |
|---------|----------|---------------|
| Email/Password | ✅ Custom | ✅ Built-in |
| OAuth Providers | ✅ Many | ✅ Many |
| Email Verification | ❌ Custom needed | ✅ Built-in |
| Password Reset | ❌ Custom needed | ✅ Built-in |
| Magic Links | ❌ Not available | ✅ Built-in |
| Phone Auth | ❌ Not available | ✅ Built-in (with Twilio) |
| 2FA | ❌ Custom needed | ✅ Built-in |
| Session Management | ✅ JWT | ✅ JWT + Refresh tokens |
| Admin Dashboard | ❌ No | ✅ Yes |
| User Management UI | ❌ No | ✅ Yes |

---

## 🚀 Next Steps

### 1. Optional: Enable Email Confirmation

In Supabase Dashboard → Authentication → Settings:
- Enable "Enable email confirmations"
- Set up email templates
- Test registration with email confirmation

### 2. Optional: Add OAuth Providers

```typescript
// In login page
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google', // or 'github', 'facebook', etc.
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

### 3. Optional: Add Password Reset

```typescript
// Request password reset
const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`,
});
```

### 4. Optional: Add Magic Links

```typescript
// Send magic link
const { data, error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: `${window.location.origin}/dashboard`,
  },
});
```

---

## 📞 Support

If you encounter issues:

1. **Check Supabase Status:** https://status.supabase.com
2. **Supabase Docs:** https://supabase.com/docs/guides/auth
3. **Supabase Auth SSR Docs:** https://supabase.com/docs/guides/auth/server-side/nextjs

---

## 🎉 Migration Complete!

Your app is now using Supabase Auth! Enjoy the built-in features like:
- ✅ Email verification
- ✅ Password reset
- ✅ OAuth providers
- ✅ Admin dashboard
- ✅ Automatic token refresh
- ✅ Better security

Happy coding! 🚀

