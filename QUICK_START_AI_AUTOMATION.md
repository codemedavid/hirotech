# 🚀 AI Automation - Quick Start (5 Minutes)

**Status:** ✅ READY TO USE  
**Last Updated:** November 12, 2025

---

## ⚡ Fast Track to Your First Automated Message

### Step 1: Navigate (10 seconds)

```
Dashboard → AI Automations (sidebar)
or go to: /ai-automations
```

### Step 2: Create Rule (2 minutes)

Click "Create Rule" button and fill in:

```yaml
Basic:
  Name: "Test 1-Hour Follow-up"
  Description: "Quick test rule"
  Facebook Page: [Select your page or leave as "All Pages"]

AI Configuration:
  AI Instructions: "Send a friendly follow-up message. Be casual and helpful."
  Language Style: English (or Taglish)

Time Settings:
  Hours: 1  # Test with 1 hour for quick results
  
Tag Filters:
  Include Tags: [Leave empty for now]
  Exclude Tags: [Add "Purchased" if you have that tag]

Limits:
  Max Messages Per Day: 10
  Run 24/7: No
  Active Hours: 9 AM to 9 PM
  
Behavior:
  Stop on Reply: ✅ Yes
  Message Tag: Account Update
  Enable Rule: ✅ Yes
```

Click "Create Rule" → See success message → Rule appears in list

### Step 3: Test Immediately (2 minutes)

#### Option A: Manual Test (Recommended)
1. Find your rule in the list
2. Click the Play button (▶)
3. Wait 10-30 seconds
4. Check the toast notification for results

#### Option B: Wait for Cron
1. Wait 1-2 minutes
2. Cron runs automatically
3. Check rule stats update

### Step 4: Verify (1 minute)

**Check the rule card:**
- Executions count increased?
- Success count shows messages sent?
- Last executed timestamp updated?

**Check Facebook Messenger:**
- Did contacts receive messages?
- Are messages personalized?

---

## ✅ Success Checklist

After following steps above:

- [x] Rule created successfully
- [ ] Manual test executed (or cron ran)
- [ ] At least 1 message sent
- [ ] Message visible in Facebook Messenger
- [ ] Message is personalized (not generic)

**If all checked:** 🎉 You're done! AI automation is working!

---

## 📱 What Happens Next?

### Automatic Operation

1. **Every Minute:** Cron job checks your enabled rules
2. **Find Contacts:** Looks for contacts inactive for 1 hour (your setting)
3. **Generate Messages:** AI creates personalized messages
4. **Send:** Messages sent via Facebook Messenger
5. **Track:** Stats updated in real-time

### When Contacts Reply

1. **Detection:** Webhook detects reply instantly
2. **Stop:** Automation stops for that contact
3. **Log:** Stop record created
4. **Tag Removal:** (if configured) Tag removed automatically

---

## 🎯 Recommended Next Steps

### Day 1: Test & Validate
```
✅ Create test rule with 1-hour interval
✅ Verify 5-10 messages sent
✅ Check personalization quality
✅ Test reply detection (reply as contact)
✅ Monitor for errors
```

### Day 2-3: Optimize
```
✅ Adjust AI prompt based on responses
✅ Fine-tune time intervals
✅ Add tag filters (include/exclude)
✅ Test different language styles
✅ Monitor reply rates
```

### Week 1: Scale
```
✅ Create 24-hour hot lead rule
✅ Create 48-hour qualification rule
✅ Create 7-day re-engagement rule
✅ Increase daily limits
✅ Expand to more pages
```

---

## 💡 Pro Tips

### 1. Start Small
- Use 1-hour interval for testing
- Limit to 10 messages/day initially
- Test with non-critical contacts first

### 2. Good Prompts
**Do:**
- "Follow up on their [specific] inquiry"
- "Reference what they asked about"
- "Be friendly and helpful"

**Don't:**
- "Send marketing message"
- "Promote products"
- "Be pushy"

### 3. Tag Strategy
**Smart Filtering:**
- Include: "Hot Lead", "Interested"
- Exclude: "Purchased", "Not Interested"

### 4. Timing
- **1-4 hours:** Urgent/hot leads
- **24 hours:** Standard follow-up
- **48 hours:** Qualification
- **7 days:** Re-engagement

---

## 🐛 Quick Troubleshooting

### No Messages Sent?

**Check:**
1. Rule is enabled (green "Active" badge)
2. Contacts have `lastInteraction` > 1 hour ago
3. Contacts have Messenger PSID
4. Within active hours (9 AM - 9 PM)
5. Daily limit not reached

**Quick Fix:**
```sql
-- Find eligible contacts
SELECT 
  "firstName", 
  "lastInteraction", 
  "messengerPSID"
FROM "Contact"
WHERE "lastInteraction" < NOW() - INTERVAL '1 hour'
  AND "messengerPSID" IS NOT NULL
LIMIT 5;
```

### Messages Not Personalized?

**Check:**
1. Conversation history exists
2. Messages linked to conversation
3. AI service has API keys

**Quick Test:**
- Look at "Recent Executions" in database
- Check `generatedMessage` field
- Should reference conversation context

### Cron Not Running?

**Solutions:**
1. Check Vercel Dashboard → Cron Jobs
2. Verify `vercel.json` exists
3. Redeploy if needed

---

## 📊 Monitor Your Success

### Daily Check (2 minutes)
```
1. Go to /ai-automations
2. Check each rule's stats:
   - Executions (how many times ran)
   - Success (messages sent)
   - Stopped (contacts replied)
3. Click Play button to test
```

### Weekly Review (15 minutes)
```sql
-- This week's performance
SELECT 
  r.name,
  COUNT(*) as total_sent,
  COUNT(*) FILTER (WHERE s.id IS NOT NULL) as got_replies,
  ROUND(100.0 * COUNT(*) FILTER (WHERE s.id IS NOT NULL) / COUNT(*), 1) as reply_rate
FROM "AIAutomationExecution" e
JOIN "AIAutomationRule" r ON e."ruleId" = r.id
LEFT JOIN "AIAutomationStop" s ON s."contactId" = e."contactId" AND s."ruleId" = r.id
WHERE e."createdAt" >= NOW() - INTERVAL '7 days'
  AND e.status = 'sent'
GROUP BY r.name;
```

---

## 🎉 You're All Set!

**What You Have Now:**
- ✅ Working AI automation system
- ✅ Personalized message generation
- ✅ Automatic follow-ups
- ✅ Reply detection
- ✅ Real-time monitoring

**What To Do:**
1. Create your first rule (2 min)
2. Test with Play button (30 sec)
3. Verify messages sent (1 min)
4. Monitor and optimize (ongoing)

**Expected Results:**
- 📈 Higher response rates
- 💬 More engaged conversations
- ⏰ Time saved on manual follow-ups
- 💰 Increased conversions

---

## 📞 Need Help?

### Documentation
- **Full Guide:** `AI_AUTOMATION_IMPLEMENTATION_COMPLETE_HIRO.md`
- **Detailed Docs:** `AI_AUTOMATION_MEGA_FILE.md` (from kickerpro)
- **This Guide:** `QUICK_START_AI_AUTOMATION.md`

### Quick Support
1. Check rule is enabled
2. Verify contacts eligible
3. Test with Play button
4. Check Vercel logs
5. Review database records

---

**Ready? Let's go! 🚀**

Create your first rule now: `/ai-automations` → "Create Rule"

