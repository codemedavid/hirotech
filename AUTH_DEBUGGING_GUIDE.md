# 🔍 Authentication Debugging Guide

## What Was Fixed

### 1. **Enhanced Error Handling in `src/auth.ts`**
- Added comprehensive logging at each step of the authorization process
- Added database connection testing before authentication
- Improved error messages with emojis for easy identification
- Added detailed user lookup logging

### 2. **Improved Middleware Logging in `src/middleware.ts`**
- Added logging for every request
- Shows authentication status for each request
- Logs cookie presence and names
- Tracks redirects

### 3. **Better Error Messages in Login/Register Pages**
- Specific error messages for different failure types
- Enhanced logging to track the entire auth flow
- More user-friendly error messages

### 4. **Enhanced Registration API Endpoint**
- Input validation (email format, password length)
- Database connection testing
- Step-by-step logging
- Better error responses

### 5. **New Database Test Endpoint**
- Created `/api/auth/test-db` to check database connectivity
- Shows user count, organization count, and sample data
- Verifies environment variables are set

---

## How to Debug Login Issues

### Step 1: Check Environment Variables

Make sure you have these in your `.env.local`:

```env
DATABASE_URL="your_postgresql_url"
DIRECT_URL="your_postgresql_direct_url"
NEXTAUTH_SECRET="your_secret_key"
NEXTAUTH_URL="http://localhost:3000"
```

### Step 2: Test Database Connection

Visit: `http://localhost:3000/api/auth/test-db`

This will show:
- ✅ If database is connected
- User count
- Organization count
- Sample user data (if exists)
- Environment variable status

**Expected Response:**
```json
{
  "success": true,
  "message": "Database connection successful",
  "data": {
    "userCount": 1,
    "organizationCount": 1,
    "sampleUser": {
      "id": "...",
      "email": "test@example.com",
      "name": "Test User",
      "role": "ADMIN",
      "hasOrganization": true
    },
    "databaseUrl": "✓ Set",
    "nextauthSecret": "✓ Set",
    "nextauthUrl": "http://localhost:3000"
  }
}
```

### Step 3: Check Console Logs

Open your browser console and terminal to see detailed logs:

#### **Expected Registration Flow:**
```
[Register] === Starting Registration Process ===
[Register] Organization: My Company
[Register] Name: John Doe
[Register] Email: john@example.com

[Register API] === Starting Registration ===
[Register API] ✅ Database connected
[Register API] 🔍 Checking for existing user...
[Register API] ✅ Email is available
[Register API] 🔐 Hashing password...
[Register API] ✅ Password hashed
[Register API] 📝 Creating organization and user...
[Register API] ✅ Organization created: clxxx
[Register API] ✅ User created: clxxx
[Register API] 🎉 Registration successful!

[Register] ✅ Registration successful! Auto-logging in...
[Register] ✅ Auto-login successful! Redirecting to dashboard...
```

#### **Expected Login Flow:**
```
[Login] === Starting Login Process ===
[Login] Email: john@example.com
[Login] Password provided: true

[Auth] === Starting Authorization ===
[Auth] Credentials received: { email: '✓', password: '✓' }
[Auth] 🔍 Looking up user: john@example.com
[Auth] ✅ Database connected
[Auth] ✅ User found: { id: '...', email: '...', hasPassword: true, role: 'ADMIN' }
[Auth] 🔐 Comparing passwords...
[Auth] ✅ Password verified successfully
[Auth] 🎉 Login successful for: john@example.com
[Auth] 📤 Returning user object: { id: '...', email: '...', role: 'ADMIN' }

[Login] ✅ Success! Redirecting to dashboard...
```

### Step 4: Common Issues and Solutions

#### ❌ Issue: "CredentialsSignin" Error

**Possible Causes:**
1. **User doesn't exist in database**
   - Check: Visit `/api/auth/test-db` to see if users exist
   - Solution: Register a new account first

2. **Wrong password**
   - Check: Make sure you're entering the correct password
   - Solution: Try registering a new account

3. **Database connection failed**
   - Check: Look for "❌ Database connection failed" in console
   - Solution: Verify `DATABASE_URL` in `.env.local`

4. **Missing environment variables**
   - Check: Visit `/api/auth/test-db` to verify env vars
   - Solution: Add missing variables to `.env.local`

5. **User has no password field**
   - Check: Look for "❌ User has no password set" in logs
   - Solution: This shouldn't happen with the registration flow, but you might need to reset the database

#### ❌ Issue: Database Connection Failed

**Solutions:**
1. Check if PostgreSQL is running
2. Verify `DATABASE_URL` format: `postgresql://user:password@host:port/database`
3. Run `npx prisma db push` to ensure schema is synced
4. Run `npx prisma generate` to regenerate Prisma client

#### ❌ Issue: Registration Succeeds but Login Fails

**Solutions:**
1. Check if bcrypt is comparing passwords correctly
2. Verify password is being hashed during registration (look for "✅ Password hashed")
3. Check if user was created with password (look for "✅ User created")

#### ❌ Issue: Middleware Redirecting Incorrectly

**Solutions:**
1. Check middleware logs in console
2. Clear browser cookies
3. Try incognito/private mode

---

## Testing Checklist

### ✅ Test Registration
1. Go to `http://localhost:3000/register`
2. Fill in:
   - Organization: "Test Company"
   - Name: "Test User"
   - Email: "test@example.com"
   - Password: "password123" (min 8 chars)
3. Click "Create account"
4. Check console for logs
5. Should redirect to dashboard

### ✅ Test Login
1. Go to `http://localhost:3000/login`
2. Enter the credentials you registered with
3. Click "Sign in"
4. Check console for detailed logs
5. Should redirect to dashboard

### ✅ Test Protected Routes
1. Log out (or clear cookies)
2. Try accessing `http://localhost:3000/dashboard`
3. Should redirect to `/login`

### ✅ Test Auth Page Redirects
1. Log in successfully
2. Try accessing `http://localhost:3000/login`
3. Should redirect to `/dashboard`

---

## Quick Diagnostic Commands

```bash
# Check if database is accessible
npx prisma db pull

# View database in browser
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Regenerate Prisma client
npx prisma generate

# Check for users in database
npx prisma db seed  # if you have a seed script
```

---

## Need More Help?

1. **Check the console logs** - They now include detailed step-by-step information
2. **Visit `/api/auth/test-db`** - This will tell you if your setup is correct
3. **Look for emoji indicators**:
   - ✅ = Success
   - ❌ = Error
   - 🔍 = Searching/Looking up
   - 🔐 = Password operation
   - 📝 = Creating/Writing
   - 🎉 = Complete success
   - 💥 = Exception/Critical error

---

## What Changed in the Code?

### Files Modified:
1. ✅ `src/auth.ts` - Enhanced error handling and logging
2. ✅ `src/middleware.ts` - Added comprehensive logging
3. ✅ `src/app/(auth)/login/page.tsx` - Better error messages
4. ✅ `src/app/(auth)/register/page.tsx` - Enhanced logging and error handling
5. ✅ `src/app/api/auth/register/route.ts` - Input validation and detailed logging

### Files Created:
1. ✅ `src/app/api/auth/test-db/route.ts` - Database diagnostic endpoint
2. ✅ `AUTH_DEBUGGING_GUIDE.md` - This file!

---

## Next Steps

1. **Start your dev server**: `npm run dev`
2. **Visit the test endpoint**: `http://localhost:3000/api/auth/test-db`
3. **Try registering**: `http://localhost:3000/register`
4. **Try logging in**: `http://localhost:3000/login`
5. **Watch the console** for detailed logs at every step

The authentication system now has extensive logging that will help you identify exactly where any issues occur!

