# 🔧 FIX LOGIN REDIRECT - Step by Step

**Issue**: Login succeeds but redirects back to login page  
**Diagnosis**: Cookie not persisting between requests  

---

## 🚨 CRITICAL: Tell Me This

**After you click "Sign in", what does your server terminal show?**

Specifically, look for these lines:
```
[Middleware] /dashboard - simple-session: ??? nextAuth: ??? isLoggedIn: ???
```

**Copy and paste that line here!**

---

## 🔍 Quick Debug

### Check 1: Cookie Being Set?

**In browser after clicking Sign in:**
1. F12 → Network tab
2. Find: `simple-login` request
3. Click on it
4. Go to "Response Headers"
5. Look for `set-cookie`

**Is there a Set-Cookie header?**
- ✅ YES → Cookie is being set
- ❌ NO → API isn't setting cookie

---

### Check 2: Cookie Exists in Browser?

**After clicking Sign in:**
1. F12 → Application → Cookies
2. Look at http://localhost:3000
3. Is there a cookie called `simple-session`?

**Does it exist?**
- ✅ YES → Cookie set but middleware not seeing it
- ❌ NO → Cookie not being set

---

## 🎯 Most Likely Issue

The cookie is being set but **window.location.href** redirect happens too fast, before the cookie is saved.

**Let me fix this now:**

