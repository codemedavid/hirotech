# ✅ Add Your NVIDIA API Key

Your NVIDIA API key has been provided. Here are **two easy ways** to add it:

## 🎯 Option 1: Through the UI (Easiest - Recommended!)

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Login to your app** at `http://localhost:3000`

3. **Navigate to Settings → API Keys**
   - Go to: `/settings/integrations` or look for "API Keys" section

4. **Click "Add API Key"**

5. **Paste your NVIDIA API key:**
   ```
   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
   ```

6. **Optional:** Give it a name like "NVIDIA Primary Key"

7. **Click "Add"**

8. **Done!** ✅ Your key is now stored in the database and ready to use.

---

## 🎯 Option 2: Using cURL (If you prefer command line)

If your dev server is running, you can add it via API:

```bash
curl -X POST http://localhost:3000/api/api-keys \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "key": "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",
    "name": "NVIDIA Primary Key"
  }'
```

**Note:** You'll need to be logged in as an ADMIN user and include your session cookie.

---

## ✅ Verification

After adding the key:

1. **Check the UI** - You should see your key listed in Settings → API Keys
2. **Test AI features** - Sync a contact and check if AI Context analysis works
3. **Check console logs** - You should see `[NVIDIA]` logs when AI features are used

---

## 🎉 That's It!

Your NVIDIA API key is now configured and ready to use. The system will automatically:
- Use the key for all AI features
- Rotate to other keys if you add more
- Handle rate limits automatically
- Track usage and status

**No Vercel configuration needed!** Everything is stored in your database.

