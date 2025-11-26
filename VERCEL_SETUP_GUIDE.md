# 🚀 Vercel Deployment Setup Guide

## 📋 Complete Environment Variables for Vercel

Go to your Vercel project → **Settings** → **Environment Variables** and add ALL of these:

### 🔴 REQUIRED - Core Configuration

```env
# Application URL (Use your Vercel domain after deployment)
NEXT_PUBLIC_APP_URL=https://your-project-name.vercel.app
NEXTAUTH_URL=https://your-project-name.vercel.app

# NextAuth Secret (Already generated)
AUTH_SECRET=35N2uXdsujOpav4kgFsedFkQeyF_7u2dqhp9EMSnbAbDNhiSK
NEXTAUTH_SECRET="35N2uXdsujOpav4kgFsedFkQeyF_7u2dqhp9EMSnbAbDNhiSK="

# Node Environment
NODE_ENV=production
```

### 🗄️ REQUIRED - Database (Supabase)

```env
# Connection Pooling (for regular queries)
DATABASE_URL="postgresql://postgres.qudsmrrfbatasnyvuxch:demet5732595@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct Connection (for migrations)
DIRECT_URL="postgresql://postgres.qudsmrrfbatasnyvuxch:demet5732595@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

### 🔐 REQUIRED - Supabase Auth

```env
NEXT_PUBLIC_SUPABASE_URL=https://qudsmrrfbatasnyvuxch.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1ZHNtcnJmYmF0YXNueXZ1eGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MjgxMDMsImV4cCI6MjA3ODUwNDEwM30.S2WNnRwW0XHyrj5KwGOgcKHuxN4EXKi5rBTX7mscuLA
```

### 📘 REQUIRED - Facebook Integration

```env
FACEBOOK_APP_ID=802438925861067
FACEBOOK_APP_SECRET=99e11ff061cd03fa9348547f754f96b9
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your-custom-webhook-verify-token
```

**⚠️ IMPORTANT:** Generate a secure webhook token:
```bash
# Generate secure token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then update `FACEBOOK_WEBHOOK_VERIFY_TOKEN` with the generated value.

### ⚡ REQUIRED - Redis (Campaign Processing)

```env
REDIS_URL=redis://default:KGg04axFynrwFjFjFaEEX5yK3lPAVpyN@redis-14778.c326.us-east-1-3.ec2.redns.redis-cloud.com:14778
```

### 🔒 REQUIRED - Encryption Key (API Key Encryption)

```env
ENCRYPTION_KEY=f902ad293f5f9af42c98b007dfdc0eede8614ac2be7a985c23347e051f3bcf81
```

**⚠️ IMPORTANT:** This key is used to encrypt API keys in the database. Keep it secure!
**Note:** If you need to generate a new key, run:
```bash
npx tsx scripts/generate-encryption-key.ts
```

---

## 🎯 Step-by-Step Vercel Setup

### Step 1: Connect Your Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New"** → **"Project"**
3. Import your GitHub repository: `cjlara032107/hirotechofficial`
4. Select the **main** branch (or **jad** if you prefer)

### Step 2: Configure Build Settings

Vercel should auto-detect Next.js, but verify:

- **Framework Preset:** Next.js
- **Build Command:** `npm run build` (or leave default)
- **Output Directory:** `.next` (default)
- **Install Command:** `npm install` (default)

### Step 3: Add Environment Variables

**Before deploying**, add ALL environment variables:

1. Go to **Settings** → **Environment Variables**
2. Add each variable from the list above
3. **Important:** Set them for:
   - ✅ **Production**
   - ✅ **Preview** 
   - ✅ **Development** (if you use Vercel dev)

**Quick Copy-Paste Format:**

```
NEXT_PUBLIC_APP_URL=https://your-project-name.vercel.app
NEXTAUTH_URL=https://your-project-name.vercel.app
AUTH_SECRET=35N2uXdsujOpav4kgFsedFkQeyF_7u2dqhp9EMSnbAbDNhiSK
NEXTAUTH_SECRET="35N2uXdsujOpav4kgFsedFkQeyF_7u2dqhp9EMSnbAbDNhiSK="
NODE_ENV=production
DATABASE_URL="postgresql://postgres.qudsmrrfbatasnyvuxch:demet5732595@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.qudsmrrfbatasnyvuxch:demet5732595@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL=https://qudsmrrfbatasnyvuxch.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1ZHNtcnJmYmF0YXNueXZ1eGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MjgxMDMsImV4cCI6MjA3ODUwNDEwM30.S2WNnRwW0XHyrj5KwGOgcKHuxN4EXKi5rBTX7mscuLA
FACEBOOK_APP_ID=802438925861067
FACEBOOK_APP_SECRET=99e11ff061cd03fa9348547f754f96b9
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your-custom-webhook-verify-token
REDIS_URL=redis://default:KGg04axFynrwFjFjFaEEX5yK3lPAVpyN@redis-14778.c326.us-east-1-3.ec2.redns.redis-cloud.com:14778
```

### Step 4: Update URLs After First Deployment

**After your first deployment:**

1. Vercel will give you a URL like: `https://your-project-name.vercel.app`
2. Go back to **Environment Variables**
3. Update:
   - `NEXT_PUBLIC_APP_URL` = `https://your-project-name.vercel.app`
   - `NEXTAUTH_URL` = `https://your-project-name.vercel.app`
4. **Redeploy** (or wait for auto-deploy if connected to Git)

### Step 5: Run Database Migrations

After deployment, you need to run Prisma migrations:

**Option A: Via Vercel Build Command (Recommended)**

Add to your `package.json` or Vercel build settings:

```json
{
  "scripts": {
    "vercel-build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

**Option B: Via Vercel CLI (One-time)**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Run migrations
vercel env pull .env.production
npx prisma migrate deploy
```

**Option C: Manual SQL (If migrations fail)**

Go to your Supabase dashboard → SQL Editor and run migrations manually.

### Step 6: Configure Facebook Webhook

After deployment, update your Facebook App webhook:

1. Go to [Facebook Developers](https://developers.facebook.com/apps/)
2. Select your app (ID: 802438925861067)
3. Go to **Messenger** → **Webhooks**
4. Update webhook URL:
   ```
   https://your-project-name.vercel.app/api/webhooks/facebook
   ```
5. Set **Verify Token** to match `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
6. Subscribe to events:
   - ✅ `messages`
   - ✅ `messaging_postbacks`
   - ✅ `message_deliveries`
   - ✅ `message_reads`

### Step 7: Update Facebook OAuth Redirect URIs

1. Go to **Facebook Login** → **Settings**
2. Add **Valid OAuth Redirect URIs**:
   ```
   https://your-project-name.vercel.app/api/facebook/callback
   https://your-project-name.vercel.app/api/facebook/callback-popup
   ```

---

## 🔧 Vercel-Specific Configuration

### Build Command

Vercel will automatically run `npm run build`, but you can customize:

```json
// vercel.json (already exists)
{
  "buildCommand": "prisma generate && prisma migrate deploy && next build"
}
```

### Environment Variables Priority

Vercel reads environment variables in this order:
1. Vercel Dashboard (Settings → Environment Variables) ✅ **Use this**
2. `.env.production` (if exists)
3. `.env.local` (not used in production)

**Always set variables in Vercel Dashboard for production!**

---

## ✅ Post-Deployment Checklist

- [ ] All environment variables added to Vercel
- [ ] Database migrations run successfully
- [ ] Facebook webhook URL updated
- [ ] Facebook OAuth redirect URIs updated
- [ ] Test login flow works
- [ ] Test Facebook connection works
- [ ] Test webhook receives events
- [ ] Redis connection verified (for campaigns)

---

## 🐛 Troubleshooting

### Build Fails: "Environment variable not found"

**Solution:** Make sure you added ALL variables in Vercel Dashboard → Settings → Environment Variables

### Database Connection Error

**Solution:** 
- Verify `DATABASE_URL` and `DIRECT_URL` are correct
- Check Supabase database is running
- Verify connection pooling is enabled

### Facebook Webhook Not Working

**Solution:**
- Verify webhook URL is accessible (no 404)
- Check `FACEBOOK_WEBHOOK_VERIFY_TOKEN` matches Facebook App settings
- Ensure webhook is subscribed to correct events

### NextAuth Errors

**Solution:**
- Verify `NEXTAUTH_URL` matches your Vercel domain exactly
- Check `NEXTAUTH_SECRET` is set and matches across environments
- Clear browser cookies and try again

---

## 📚 Additional Resources

- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Deployment on Vercel](https://nextjs.org/docs/deployment)
- [Prisma with Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)

---

**Created:** November 24, 2025  
**Status:** ✅ Ready for Deployment

