# 🚀 Quick Setup Reference

## Your New Ngrok URL
```
https://overinhibited-delphia-superpatiently.ngrok-free.dev
```

---

## 📝 Copy & Paste for .env.local

```env
NEXT_PUBLIC_APP_URL=https://overinhibited-delphia-superpatiently.ngrok-free.dev
NEXTAUTH_URL=https://overinhibited-delphia-superpatiently.ngrok-free.dev
```

---

## 🔵 Copy & Paste for Facebook OAuth Redirect URIs

```
https://overinhibited-delphia-superpatiently.ngrok-free.dev/api/facebook/callback
https://overinhibited-delphia-superpatiently.ngrok-free.dev/api/facebook/callback-popup
```

**Where to add:** Facebook Developers → Your App → Products → Facebook Login → Settings → Valid OAuth Redirect URIs

---

## 🪝 Copy & Paste for Facebook Webhook

```
https://overinhibited-delphia-superpatiently.ngrok-free.dev/api/webhooks/facebook
```

**Where to add:** Facebook Developers → Your App → Products → Webhooks → Edit Callback URL

---

## ✅ Quick Checklist

1. **Update .env.local** (add the 2 lines above)
2. **Update Facebook App** (add the 2 OAuth redirect URIs)
3. **Restart dev server** (`npm run dev`)
4. **Clear browser cookies** (F12 → Application → Cookies → Clear)
5. **Visit:** https://overinhibited-delphia-superpatiently.ngrok-free.dev/login

---

## 🎯 That's It!

Everything is ready. Just follow the 5 steps above and you're good to go! 🎉

