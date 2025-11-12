# Facebook Page Connection Diagnostic Guide

## 🎯 Overview

This guide helps you diagnose and fix issues with connecting Facebook pages to your application. We've added comprehensive diagnostic tools to help identify the root cause of connection failures.

## 🔧 New Diagnostic Tools

### 1. **Facebook Diagnostic Panel** (On Integrations Page)

A comprehensive diagnostic panel is now available on your integrations page that checks:

- ✅ Authentication status
- ✅ Environment variables configuration
- ✅ Database connectivity
- ✅ Connected pages status
- ✅ Proper callback URLs

**How to Use:**
1. Go to `/settings/integrations`
2. You'll see the diagnostic panel at the top
3. Click "Run Diagnostics" to get a full system health check
4. Click "Test Database Save" to verify database operations

### 2. **Debug API Endpoint**

Direct API access for detailed system information:

```bash
# Get diagnostic report
GET /api/facebook/debug
```

**Response includes:**
- Environment variable status
- Database connection status
- Recently connected pages
- Critical issues and warnings
- Recommendations

### 3. **Test Save Endpoint**

Test database operations without Facebook OAuth:

```bash
# Create test page
POST /api/facebook/test-save
Body: { "testMode": "create" }

# Check existing pages
POST /api/facebook/test-save
Body: { "testMode": "check" }

# Cleanup test data
POST /api/facebook/test-save
Body: { "testMode": "cleanup" }
```

### 4. **Enhanced Logging**

The Facebook pages save endpoint now has comprehensive logging that shows:
- Each step of the process
- Success/failure for each page
- Detailed error messages
- Database operation results

## 🐛 Common Issues & Solutions

### Issue 1: "Failed to connect Facebook page" - No specific error

**Symptoms:**
- You complete Facebook OAuth successfully
- You select pages
- Click "Connect"
- Get generic error message
- Database is not updated

**Diagnosis Steps:**

1. **Check Server Logs**
   ```bash
   # The enhanced logging will show exactly where it fails:
   # - Token exchange?
   # - Getting page access token?
   # - Instagram account check?
   # - Database save?
   ```

2. **Run Diagnostics**
   - Go to integrations page
   - Click "Run Diagnostics"
   - Check for critical issues

3. **Test Database Save**
   - Click "Test Database Save" button
   - If this fails, it's a database issue
   - If this succeeds, it's a Facebook API issue

**Common Causes:**

a) **Environment Variables Not Set**
```bash
# Required in .env or .env.local
NEXT_PUBLIC_APP_URL=https://yourdomain.com
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
DATABASE_URL=postgresql://...
```

b) **Database Connection Issues**
```bash
# Test database connection
npx prisma db execute --stdin <<< "SELECT 1;"

# Push schema if needed
npx prisma db push
```

c) **Facebook App Redirect URI Mismatch**
- Your Facebook App Settings must include BOTH callback URLs:
  - `https://yourdomain.com/api/facebook/callback`
  - `https://yourdomain.com/api/facebook/callback-popup`

d) **Invalid Access Token**
- Token expired during selection process
- Try connecting again immediately after OAuth

### Issue 2: Pages appear to connect but don't show up

**Symptoms:**
- Success message shown
- Pages don't appear in connected list
- Database query returns empty

**Diagnosis:**

1. Check database directly:
```sql
SELECT * FROM "FacebookPage" WHERE "organizationId" = 'your_org_id';
```

2. Use the test endpoint:
```bash
curl -X POST http://localhost:3000/api/facebook/test-save \
  -H "Content-Type: application/json" \
  -d '{"testMode":"check"}'
```

3. Check browser console for errors

**Common Causes:**

a) **Wrong Organization ID**
- Session has different org than expected
- Check diagnostic panel's authentication section

b) **Database Transaction Rollback**
- Error during save caused rollback
- Check server logs for database errors

c) **Frontend Not Refreshing**
- Try hard refresh (Ctrl+Shift+R)
- Check if `onPagesConnected` callback is firing

### Issue 3: "Unauthorized" error

**Symptoms:**
- Connection fails immediately
- 401 error in console
- Redirected to login

**Solutions:**

1. **Check Authentication**
   - Run diagnostics to verify session
   - Try logging out and back in
   - Clear browser cookies

2. **Check Session Middleware**
   - Verify middleware.ts is correctly configured
   - Check if auth routes are protected

### Issue 4: Facebook OAuth Popup Closes Without Result

**Symptoms:**
- Popup opens
- You authorize on Facebook
- Popup closes
- Nothing happens

**Diagnosis:**

1. **Check Browser Console (Parent Window)**
   - Look for `postMessage` errors
   - Check for CORS issues

2. **Check Popup Console (Before it Closes)**
   ```javascript
   // In popup window console:
   // Should see "Sending message to parent:"
   ```

3. **Check Callback URL**
   - Must match exactly what's in Facebook App Settings
   - Check diagnostic panel for correct URLs

**Common Causes:**

a) **Redirect URI Mismatch**
- Facebook rejects if redirect_uri doesn't match
- Add both callback URLs to Facebook App

b) **postMessage Origin Mismatch**
- Check if window.location.origin matches NEXT_PUBLIC_APP_URL
- Verify no http/https mismatch

c) **Popup Blocked**
- Browser blocked popup
- Check browser popup settings

### Issue 5: Database Save Fails

**Symptoms:**
- Server logs show "Database save failed"
- Error includes Prisma error messages

**Solutions:**

1. **Check Database Connection**
```bash
# Test connection
npx prisma db execute --stdin <<< "SELECT 1;"
```

2. **Verify Schema is Synced**
```bash
# Push current schema
npx prisma db push

# Or create migration
npx prisma migrate dev --name facebook_pages
```

3. **Check Required Fields**
- Verify all required fields in FacebookPage model
- Check if unique constraints are violated

4. **Check Permissions**
- Database user has INSERT/UPDATE permissions
- No row-level security blocking inserts

## 📊 Reading Diagnostic Results

### Healthy System Example

```json
{
  "overallStatus": {
    "healthy": true,
    "readyForFacebookOAuth": true,
    "criticalIssues": [],
    "warnings": [],
    "recommendations": []
  },
  "authentication": {
    "authenticated": true,
    "userId": "user_123",
    "organizationId": "org_456"
  },
  "environment": {
    "NEXT_PUBLIC_APP_URL": {
      "set": true,
      "value": "https://yourdomain.com",
      "valid": true,
      "isLocalhost": false
    },
    "FACEBOOK_APP_ID": {
      "set": true,
      "length": 15
    },
    "FACEBOOK_APP_SECRET": {
      "set": true,
      "length": 32
    },
    "DATABASE_URL": {
      "set": true,
      "valid": true
    }
  },
  "database": {
    "connected": true,
    "error": null,
    "facebookPagesCount": 2
  }
}
```

### Problem System Example

```json
{
  "overallStatus": {
    "healthy": false,
    "criticalIssues": [
      "FACEBOOK_APP_ID not set in environment variables",
      "Database connection failed: Can't reach database server"
    ],
    "warnings": [
      "Using localhost URL - Facebook OAuth requires a public URL for production"
    ]
  }
}
```

## 🔍 Step-by-Step Troubleshooting Workflow

### Step 1: Run Initial Diagnostics

1. Navigate to `/settings/integrations`
2. Click "Run Diagnostics"
3. Review results

### Step 2: Fix Critical Issues

If any critical issues are shown:

1. **Environment Variables**
   - Add missing variables to `.env` or `.env.local`
   - Restart your dev server

2. **Database Connection**
   - Verify DATABASE_URL is correct
   - Run `npx prisma db push`
   - Test with "Test Database Save"

### Step 3: Verify Facebook App Configuration

1. Go to [Facebook Developers](https://developers.facebook.com)
2. Open your app
3. Check OAuth redirect URIs in app settings
4. Add both callback URLs shown in diagnostic panel
5. Verify app is in "Live" mode (for production)

### Step 4: Test Connection Flow

1. Click "Connect with Facebook"
2. Watch browser console for errors
3. Check server logs for detailed step-by-step progress
4. If it fails, note exactly which step failed

### Step 5: Check Results

1. If success message shown:
   - Verify pages appear in connected list
   - Check database directly if needed
   - Use "Test Save" endpoint to verify DB operations

2. If error shown:
   - Check error message details
   - Review server logs for the specific error
   - Cross-reference with common issues above

## 📝 Server Log Patterns

### Successful Connection

```
=== FACEBOOK PAGES SAVE START ===
Timestamp: 2024-01-15T10:30:00.000Z
Session check: { authenticated: true, userId: 'user_123', organizationId: 'org_456' }
Request body: { pagesCount: 2, hasToken: true }
Processing 2 page(s)...

--- Processing page: My Page Name (123456789) ---
Step 1: Getting page access token...
✓ Got page access token
Step 2: Checking Instagram business account...
✓ Instagram check complete: Found: my_instagram
Step 3: Checking if page exists in database...
✓ Database check: New page
Step 4: Creating new page...
✅ Page created successfully: fb_page_xyz

=== FACEBOOK PAGES SAVE COMPLETE ===
Summary: { successful: 2, failed: 0, total: 2 }
```

### Failed Connection

```
=== FACEBOOK PAGES SAVE START ===
...
--- Processing page: My Page Name (123456789) ---
Step 1: Getting page access token...
❌ Error processing page 123456789: Facebook API Error (190): Invalid OAuth 2.0 Access Token
```

## 🛠️ Quick Fixes

### Reset Everything

```bash
# 1. Clean database
npx prisma db push --force-reset

# 2. Clear browser data
# - Clear cookies for your domain
# - Clear localStorage

# 3. Restart server
npm run dev

# 4. Try connection again
```

### For Local Development

If testing locally:

1. Use ngrok or similar:
```bash
ngrok http 3000
```

2. Update `.env.local`:
```bash
NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok.io
```

3. Update Facebook App redirect URIs with ngrok URL

4. Restart your app

## 📞 Getting Help

If you're still stuck after trying these steps:

1. **Collect Information:**
   - Run diagnostics and save the JSON output
   - Copy server logs from the failed attempt
   - Take screenshots of error messages

2. **Check These Specific Things:**
   - Can you create a test page using "Test Database Save"?
   - Do the callback URLs in diagnostic panel match Facebook App Settings?
   - Is your Facebook App in "Live" mode?
   - Are you testing with an account that has pages?

3. **Common "Gotchas":**
   - Facebook App must be reviewed/approved for certain permissions
   - Some Facebook accounts don't have pages (need Business account)
   - Localhost doesn't work with Facebook OAuth (use ngrok)
   - Environment variables need server restart to take effect

## ✅ Success Checklist

Before attempting to connect a Facebook page, ensure:

- [ ] All environment variables are set and valid
- [ ] Database connection is working (green in diagnostics)
- [ ] Facebook App is properly configured with correct redirect URIs
- [ ] You're logged in with an account that manages Facebook pages
- [ ] Server logs are accessible to debug if needed
- [ ] Diagnostics show "System Healthy"

## 🎉 Expected Flow

When everything works correctly:

1. Click "Connect with Facebook" → Popup opens
2. Authorize on Facebook → Popup shows success message
3. Popup closes → Page selector dialog opens
4. Select pages → Click "Connect X Pages"
5. Success toast → Pages appear in connected list
6. Database updated → Can see pages in dashboard

Each step should complete in 1-2 seconds. If any step takes longer or hangs, check server logs for that specific step.

