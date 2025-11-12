# 🧪 Testing Instructions - Authentication System

## Quick Start Testing Guide

### Prerequisites
1. Make sure your PostgreSQL database is running
2. Ensure `.env.local` has all required variables
3. Run `npx prisma generate` to ensure Prisma client is up to date
4. Run `npx prisma db push` to sync the database schema

---

## Test Sequence

### 🔍 Test 1: Database Connectivity (30 seconds)

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open in browser:**
   ```
   http://localhost:3000/api/auth/test-db
   ```

3. **Expected Result:**
   ```json
   {
     "success": true,
     "message": "Database connection successful",
     "data": {
       "userCount": 0,
       "organizationCount": 0,
       "databaseUrl": "✓ Set",
       "nextauthSecret": "✓ Set",
       "nextauthUrl": "http://localhost:3000"
     }
   }
   ```

4. **If you see errors:**
   - Check DATABASE_URL in `.env.local`
   - Run `npx prisma db push`
   - Restart dev server

---

### 📝 Test 2: User Registration (1 minute)

1. **Open browser console (F12)**

2. **Navigate to:**
   ```
   http://localhost:3000/register
   ```

3. **Fill in the form:**
   - Organization Name: "Test Company"
   - Your Name: "Test User"
   - Email: "test@example.com"
   - Password: "password123"

4. **Click "Create account"**

5. **Watch the console - you should see:**
   ```
   [Register] === Starting Registration Process ===
   [Register] Organization: Test Company
   [Register] Name: Test User
   [Register] Email: test@example.com
   ```

6. **In the terminal/server logs, you should see:**
   ```
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
   ```

7. **Expected Result:**
   - Should redirect to `/dashboard`
   - You should be logged in automatically

---

### 🔓 Test 3: Logout (30 seconds)

1. **Clear browser cookies:**
   - Chrome/Edge: F12 → Application → Cookies → Delete `next-auth.session-token`
   - Firefox: F12 → Storage → Cookies → Delete `next-auth.session-token`
   - Or use browser's "Clear site data" feature

2. **Try to access dashboard:**
   ```
   http://localhost:3000/dashboard
   ```

3. **Expected Result:**
   - Should redirect to `/login`
   - Console should show: `[Middleware] ↪️ Redirecting logged-out user to login`

---

### 🔐 Test 4: User Login (1 minute)

1. **Make sure you're on the login page:**
   ```
   http://localhost:3000/login
   ```

2. **Open browser console (F12)**

3. **Enter credentials:**
   - Email: "test@example.com"
   - Password: "password123"

4. **Click "Sign in"**

5. **Watch the console - you should see:**
   ```
   [Login] === Starting Login Process ===
   [Login] Email: test@example.com
   [Login] Password provided: true
   ```

6. **In the terminal/server logs, you should see:**
   ```
   [Auth] === Starting Authorization ===
   [Auth] Credentials received: { email: '✓', password: '✓' }
   [Auth] 🔍 Looking up user: test@example.com
   [Auth] ✅ Database connected
   [Auth] ✅ User found: { id: '...', email: '...', hasPassword: true, role: 'ADMIN', organizationId: '...' }
   [Auth] 🔐 Comparing passwords...
   [Auth] ✅ Password verified successfully
   [Auth] 🎉 Login successful for: test@example.com
   [Auth] 📤 Returning user object: { id: '...', email: '...', role: 'ADMIN' }
   ```

7. **In browser console:**
   ```
   [Login] ✅ Success! Redirecting to dashboard...
   ```

8. **Expected Result:**
   - Should redirect to `/dashboard`
   - You should be logged in

---

### 🔒 Test 5: Protected Routes (30 seconds)

1. **While logged in, try to access:**
   ```
   http://localhost:3000/login
   ```

2. **Expected Result:**
   - Should redirect to `/dashboard`
   - Console: `[Middleware] ↪️ Redirecting logged-in user away from auth page`

3. **Clear cookies again (logout)**

4. **Try to access:**
   ```
   http://localhost:3000/dashboard
   ```

5. **Expected Result:**
   - Should redirect to `/login`
   - Console: `[Middleware] ↪️ Redirecting logged-out user to login`

---

### 🚫 Test 6: Wrong Password (30 seconds)

1. **Go to login page:**
   ```
   http://localhost:3000/login
   ```

2. **Enter wrong credentials:**
   - Email: "test@example.com"
   - Password: "wrongpassword"

3. **Click "Sign in"**

4. **In terminal/server logs:**
   ```
   [Auth] === Starting Authorization ===
   [Auth] ✅ Database connected
   [Auth] ✅ User found: ...
   [Auth] 🔐 Comparing passwords...
   [Auth] ❌ Password mismatch for: test@example.com
   [Auth] 💥 Exception during authorization: Error: Invalid email or password
   ```

5. **In browser:**
   - Should show error message: "Invalid email or password. Please check your credentials and try again."

6. **Expected Result:**
   - Stays on login page
   - Shows error message
   - Does NOT redirect

---

### 📧 Test 7: Non-Existent User (30 seconds)

1. **Go to login page**

2. **Enter credentials for non-existent user:**
   - Email: "nonexistent@example.com"
   - Password: "anypassword"

3. **Click "Sign in"**

4. **In terminal/server logs:**
   ```
   [Auth] === Starting Authorization ===
   [Auth] ✅ Database connected
   [Auth] 🔍 Looking up user: nonexistent@example.com
   [Auth] ❌ User not found: nonexistent@example.com
   [Auth] 💥 Exception during authorization: Error: Invalid email or password
   ```

5. **Expected Result:**
   - Shows same error as wrong password (security best practice)
   - Stays on login page

---

### ✅ Test 8: Duplicate Registration (30 seconds)

1. **Go to register page:**
   ```
   http://localhost:3000/register
   ```

2. **Try to register with existing email:**
   - Organization: "Another Company"
   - Name: "Another User"
   - Email: "test@example.com" (already exists)
   - Password: "password123"

3. **Click "Create account"**

4. **In terminal/server logs:**
   ```
   [Register API] === Starting Registration ===
   [Register API] ✅ Database connected
   [Register API] 🔍 Checking for existing user...
   [Register API] ❌ User already exists: test@example.com
   ```

5. **Expected Result:**
   - Shows error: "User with this email already exists"
   - Stays on register page

---

### 🛡️ Test 9: Input Validation (1 minute)

#### Test 9a: Invalid Email
1. Go to register page
2. Enter email: "notanemail"
3. Try to submit
4. Should show: "Invalid email format"

#### Test 9b: Short Password
1. Go to register page
2. Enter password: "short"
3. Try to submit
4. Should show: "Password must be at least 8 characters long"

#### Test 9c: Missing Fields
1. Go to register page
2. Leave organization name empty
3. Try to submit
4. Browser should prevent submission (required field)

---

## 📊 Complete Test Results Checklist

Mark each test as you complete it:

- [ ] Test 1: Database connectivity works
- [ ] Test 2: New user registration succeeds
- [ ] Test 3: Logout redirects to login
- [ ] Test 4: Login with correct credentials succeeds
- [ ] Test 5: Protected routes redirect correctly
- [ ] Test 6: Wrong password shows error
- [ ] Test 7: Non-existent user shows error
- [ ] Test 8: Duplicate email shows error
- [ ] Test 9: Input validation works

---

## 🐛 If Any Test Fails

1. **Check the console logs** - Look for ❌ emoji
2. **Check the error message** - It should tell you what failed
3. **Visit `/api/auth/test-db`** - Verify database connection
4. **Check environment variables** - Make sure all are set in `.env.local`
5. **Check Prisma schema** - Run `npx prisma db push`
6. **Restart dev server** - Sometimes needed after schema changes

---

## 📝 What Each Log Prefix Means

| Prefix | Where It Appears | What It's Tracking |
|--------|-----------------|-------------------|
| `[Auth]` | Terminal/Server | NextAuth authorization process |
| `[Login]` | Browser Console | Login page actions |
| `[Register]` | Browser Console | Registration page actions |
| `[Register API]` | Terminal/Server | Registration API endpoint |
| `[Middleware]` | Terminal/Server | Route protection |

---

## 🎉 Success Criteria

**All tests should pass with:**
- ✅ All emoji indicators showing success at each step
- ✅ Proper redirects working
- ✅ Error messages displaying correctly
- ✅ Database operations completing
- ✅ Session persistence working

---

## 🚀 After All Tests Pass

Your authentication system is working correctly! You can now:

1. Build the application: `npm run build`
2. Deploy to production
3. Remember to:
   - Remove or protect `/api/auth/test-db` endpoint
   - Reduce console.log verbosity for production
   - Set secure environment variables in hosting platform

---

## 💡 Debugging Tips

1. **Always check BOTH browser console AND terminal logs**
2. **Look for the last ✅ before an error** - that's where it succeeded
3. **The first ❌ tells you where it failed**
4. **Use the emoji indicators to quickly scan logs**
5. **Check `/api/auth/test-db` first** if nothing works

---

Good luck with testing! 🎯

