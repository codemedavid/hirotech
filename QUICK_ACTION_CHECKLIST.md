# ✅ Quick Action Checklist - Your Vercel Domain

## 🎯 Your Domain
**https://hirotechofficial-beta.vercel.app**

---

## 🔴 URGENT - Do These Now

### 1. Update Environment Variables in Vercel (2 minutes)

**Go to:** https://vercel.com/dashboard → Your Project → **Settings** → **Environment Variables**

**Update these two:**
- `NEXT_PUBLIC_APP_URL` = `https://hirotechofficial-beta.vercel.app`
- `NEXTAUTH_URL` = `https://hirotechofficial-beta.vercel.app`

**Then:** Go to **Deployments** → Click **"Redeploy"** on the latest deployment

---

### 2. Set Build Command for Auto-Migrations (1 minute)

**Go to:** Vercel Dashboard → **Settings** → **General** → **Build & Development Settings**

**Change Build Command to:**
```
npm run vercel-build
```

This will automatically run database migrations on every deployment.

**Then:** Redeploy (or wait for next Git push)

---

### 3. Configure Facebook Webhook (3 minutes)

**Go to:** https://developers.facebook.com/apps/ → Your App (802438925861067)

1. **Messenger** → **Webhooks** → **Edit**
2. **Callback URL:** `https://hirotechofficial-beta.vercel.app/api/webhooks/facebook`
3. **Verify Token:** (use your `FACEBOOK_WEBHOOK_VERIFY_TOKEN` from Vercel)
4. **Subscribe to:**
   - ✅ `messages`
   - ✅ `messaging_postbacks`
   - ✅ `message_deliveries`
   - ✅ `message_reads`
5. Click **"Verify and Save"**

---

### 4. Update Facebook OAuth Redirect URIs (2 minutes)

**Go to:** Facebook Developers → **Facebook Login** → **Settings**

**Add these to Valid OAuth Redirect URIs:**
```
https://hirotechofficial-beta.vercel.app/api/facebook/callback
https://hirotechofficial-beta.vercel.app/api/facebook/callback-popup
```

Click **"Save Changes"**

---

## ✅ Test Your Deployment

After completing the above:

1. **Visit:** https://hirotechofficial-beta.vercel.app
2. **Test Login:** Try logging in
3. **Test Registration:** Create a new account
4. **Test Facebook Connection:** Settings → Integrations → Connect Facebook

---

## 📋 Summary

✅ **Domain:** `https://hirotechofficial-beta.vercel.app`  
✅ **Update 2 environment variables**  
✅ **Set build command**  
✅ **Configure Facebook webhook**  
✅ **Update Facebook OAuth URIs**  
✅ **Test everything**

---

**Total Time:** ~10 minutes  
**Status:** Ready to complete! 🚀

