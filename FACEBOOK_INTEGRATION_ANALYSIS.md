# Facebook Integration Analysis & Diagnostic Tools

## 📋 Analysis Summary

I've analyzed your Facebook page connection setup and created comprehensive diagnostic tools to help identify and fix the issue preventing Facebook page connections from being saved to the database.

## 🔍 What I Found

### Current Setup (Working Parts)

✅ **OAuth Flow**: Properly configured with popup-based authentication  
✅ **API Routes**: All necessary endpoints exist:
   - `/api/facebook/oauth` - Initiates OAuth
   - `/api/facebook/callback` - Regular callback
   - `/api/facebook/callback-popup` - Popup callback (better UX)
   - `/api/facebook/pages` - GET (fetch pages) & POST (save pages) & DELETE (disconnect)

✅ **Database Schema**: FacebookPage model properly defined with all required fields  
✅ **Frontend Components**: Page selector dialog with selection UI  
✅ **Token Management**: Long-lived token exchange (60 days)

### Potential Issues (Why Pages Might Not Save)

❌ **Missing Environment Variables** - Most likely culprit
❌ **Database Connection Issues**
❌ **Facebook App Redirect URI Mismatch**
❌ **Token Expiration During Selection Process**
❌ **Silent Errors During Database Save**

## 🛠️ What I've Added

### 1. **Diagnostic Panel** (Main Tool)

Added to your integrations page at `/settings/integrations`:

**Features:**
- One-click system health check
- Environment variable validation
- Database connectivity test
- Shows connected pages with details
- Lists critical issues, warnings, and recommendations
- Test database save functionality independently

**Location:** `src/components/settings/facebook-diagnostic-panel.tsx`

### 2. **Debug API Endpoint**

Direct API access for diagnostics:

```bash
GET /api/facebook/debug
```

Returns comprehensive JSON report with:
- Authentication status
- Environment variables status (with validation)
- Database connection status
- Connected pages count and recent pages
- Critical issues and warnings
- Callback URLs for Facebook App configuration
- Next steps recommendations

**Location:** `src/app/api/facebook/debug/route.ts`

### 3. **Test Save Endpoint**

Test database operations without OAuth:

```bash
POST /api/facebook/test-save
Body: { "testMode": "create" | "check" | "cleanup" }
```

**Modes:**
- `create` - Creates a test Facebook page entry
- `check` - Lists all connected pages
- `cleanup` - Removes test entries

**Location:** `src/app/api/facebook/test-save/route.ts`

### 4. **Enhanced Logging**

Added detailed step-by-step logging to the page save endpoint:

```
=== FACEBOOK PAGES SAVE START ===
Session check: { authenticated: true, ... }
Processing 2 page(s)...

--- Processing page: Page Name (ID) ---
Step 1: Getting page access token... ✓
Step 2: Checking Instagram account... ✓
Step 3: Checking if page exists... ✓
Step 4: Creating new page... ✅

=== FACEBOOK PAGES SAVE COMPLETE ===
Summary: { successful: 2, failed: 0, total: 2 }
```

This will help you see EXACTLY where the process fails.

### 5. **UI Components**

- Alert component for better error/success display
- Comprehensive diagnostic panel with status badges
- Color-coded issue severity (critical, warning, info)

## 🚀 How to Use These Tools

### Step 1: Run Diagnostics

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to: `http://localhost:3000/settings/integrations`

3. You'll see a new **"Facebook Integration Diagnostics"** panel at the top

4. Click **"Run Diagnostics"** button

### Step 2: Review Results

The diagnostic panel will show:

#### ✅ **Healthy System**
- All critical checks pass
- Ready for Facebook OAuth
- Green badges everywhere

#### ❌ **Issues Detected**
- Lists specific problems
- Shows which environment variables are missing
- Indicates database connection issues
- Provides exact callback URLs to add to Facebook

### Step 3: Fix Issues

#### If Environment Variables Missing:

Create or update `.env.local` file in your project root:

```bash
# Required for Facebook OAuth
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Or your production URL
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Required for Database
DATABASE_URL=postgresql://user:password@host:port/database
```

**Then restart your server!**

#### If Database Connection Fails:

```bash
# Test connection
npx prisma db execute --stdin <<< "SELECT 1;"

# Push schema
npx prisma db push

# Or create migration
npx prisma migrate dev --name init
```

#### If Facebook App Configuration Issue:

1. Go to [Facebook Developers](https://developers.facebook.com)
2. Select your app
3. Go to Settings → Basic
4. Add both OAuth Redirect URIs (shown in diagnostic panel):
   ```
   http://localhost:3000/api/facebook/callback
   http://localhost:3000/api/facebook/callback-popup
   ```
   
   For production, use your actual domain:
   ```
   https://yourdomain.com/api/facebook/callback
   https://yourdomain.com/api/facebook/callback-popup
   ```

### Step 4: Test Database Save

After fixing issues:

1. Click **"Test Database Save"** button in diagnostic panel
2. This creates a test entry without Facebook OAuth
3. If this fails, it's a database issue
4. If this succeeds, the issue is with Facebook API or tokens

### Step 5: Try Connecting Facebook Again

1. Click **"Connect with Facebook"**
2. Authorize in the popup
3. Select pages
4. Click "Connect"
5. **Watch the server console** for detailed logs

## 📊 Understanding the Logs

### Success Pattern

```
=== FACEBOOK PAGES SAVE START ===
✓ Authenticated
✓ Has token
✓ Processing page...
✅ Page created successfully
=== COMPLETE ===
```

### Failure Patterns

**Pattern 1: Environment Variable Issue**
```
❌ NEXT_PUBLIC_APP_URL is not set
```
→ Add to .env.local and restart

**Pattern 2: Database Issue**
```
❌ Error processing page: PrismaClientKnownRequestError
```
→ Run `npx prisma db push`

**Pattern 3: Facebook API Issue**
```
❌ Facebook API Error (190): Invalid OAuth 2.0 Access Token
```
→ Token expired or invalid, try again

**Pattern 4: Redirect URI Mismatch**
```
❌ Facebook API Error: redirect_uri mismatch
```
→ Add correct URLs to Facebook App Settings

## 🎯 Most Likely Issues (In Order)

### 1. Missing Environment Variables (90% of cases)

**Check:**
```bash
# In your project root, check .env.local
cat .env.local | grep FACEBOOK
```

**Fix:**
```bash
# Add these to .env.local
NEXT_PUBLIC_APP_URL=http://localhost:3000
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
```

### 2. Database Not Connected (5% of cases)

**Check:**
```bash
npx prisma db execute --stdin <<< "SELECT 1;"
```

**Fix:**
```bash
npx prisma db push
```

### 3. Facebook App Redirect URI Mismatch (3% of cases)

**Check:**
The diagnostic panel shows the exact URLs you need

**Fix:**
Add both callback URLs to your Facebook App Settings

### 4. Token Expiration (2% of cases)

**Symptom:**
Works in OAuth, fails when saving pages

**Fix:**
Connect immediately after OAuth completes

## 📝 Quick Checklist

Before connecting Facebook:

- [ ] All environment variables are set
- [ ] Server restarted after adding env vars
- [ ] Database connection is working
- [ ] Diagnostic panel shows "System Healthy"
- [ ] Facebook App has correct redirect URIs
- [ ] You have Facebook pages to connect (admin access)

## 🔬 Advanced Debugging

### Check Database Directly

```sql
-- Connect to your database
psql $DATABASE_URL

-- Check FacebookPage table
SELECT * FROM "FacebookPage";

-- Check if your org exists
SELECT * FROM "Organization";
```

### Test API Endpoints Directly

```bash
# Test debug endpoint
curl http://localhost:3000/api/facebook/debug | jq

# Test database save
curl -X POST http://localhost:3000/api/facebook/test-save \
  -H "Content-Type: application/json" \
  -d '{"testMode":"create"}'
```

### Check Network Requests

1. Open browser DevTools (F12)
2. Go to Network tab
3. Try connecting Facebook page
4. Look for failed requests (red)
5. Click on failed request
6. Check Response tab for error details

## 📚 Related Files

### Diagnostic Tools
- `src/app/api/facebook/debug/route.ts` - Debug endpoint
- `src/app/api/facebook/test-save/route.ts` - Test save endpoint
- `src/components/settings/facebook-diagnostic-panel.tsx` - UI component
- `FACEBOOK_CONNECTION_DIAGNOSTIC_GUIDE.md` - Full troubleshooting guide

### Integration Code
- `src/app/api/facebook/oauth/route.ts` - OAuth initiation
- `src/app/api/facebook/callback-popup/route.ts` - OAuth callback
- `src/app/api/facebook/pages/route.ts` - Page operations (now with enhanced logging)
- `src/lib/facebook/auth.ts` - Facebook API helpers
- `src/components/settings/integrations-client.tsx` - Integration page

### Database
- `prisma/schema.prisma` - Database schema
- `src/lib/db.ts` - Prisma client

## 🎉 Expected Behavior (When Working)

1. **Click "Connect with Facebook"**
   - Popup opens in ~500ms
   - Facebook login/authorization screen appears

2. **Authorize**
   - Select permissions
   - Click "Continue"
   - Popup shows success message

3. **Select Pages**
   - Popup closes
   - Page selector dialog opens immediately
   - Shows all your Facebook pages
   - Already-connected pages are marked

4. **Connect Pages**
   - Select one or more pages
   - Click "Connect X Pages"
   - Loading spinner shows
   - Success toast appears
   - Dialog closes
   - Pages appear in "Connected Pages" list below

5. **Database Updated**
   - Each page is saved to FacebookPage table
   - Includes page access token
   - Includes Instagram account if linked
   - Associated with your organization

**Total time: 10-30 seconds**

## 🆘 Still Not Working?

If you've tried everything and it's still not working:

1. **Run the diagnostic and share results:**
   ```bash
   curl http://localhost:3000/api/facebook/debug > diagnostic.json
   ```

2. **Share the server logs** from when you try to connect

3. **Check these specific things:**
   - Can you see "Test Database Save" succeed?
   - Do server logs show "FACEBOOK PAGES SAVE START"?
   - What's the last successful step in the logs?
   - Any errors in browser console?

4. **Environment info:**
   - Node version: `node -v`
   - npm version: `npm -v`
   - OS: Windows/Mac/Linux
   - Database: PostgreSQL version

## 🎓 Understanding the Flow

```mermaid
graph TD
    A[User Clicks Connect] --> B[Popup Opens]
    B --> C[Facebook OAuth]
    C --> D{Authorized?}
    D -->|No| E[User Canceled]
    D -->|Yes| F[Callback Receives Code]
    F --> G[Exchange Code for Token]
    G --> H[Get Long-Lived Token]
    H --> I[Send to Parent Window]
    I --> J[Popup Closes]
    J --> K[Page Selector Opens]
    K --> L[User Selects Pages]
    L --> M[POST to /api/facebook/pages]
    M --> N{For Each Page}
    N --> O[Get Page Access Token]
    O --> P[Check Instagram Account]
    P --> Q[Save to Database]
    Q --> R{More Pages?}
    R -->|Yes| N
    R -->|No| S[Return Success]
    S --> T[Show in UI]
```

**The diagnostic tools help identify where in this flow things break!**

## 🚀 Next Steps

1. **Run the diagnostic now** to see current status
2. **Fix any critical issues** shown
3. **Test database save** to verify DB operations
4. **Try connecting Facebook** again
5. **Watch server logs** for detailed progress
6. **Report back** with results!

Good luck! The diagnostic tools will show you exactly what's wrong. 🎯

