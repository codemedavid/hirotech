# ⚡ AI Automation Quick Start Guide

**For:** Hiro Development Team  
**Goal:** Implement AI automation in 4-6 hours  
**Status:** Ready to implement

---

## 🎯 What This Adds

**Before:**
- ❌ Manual follow-ups only
- ❌ Contacts go cold after 24-48 hours
- ❌ Staff manually tracking who needs follow-up

**After:**
- ✅ Automatic AI-generated follow-ups
- ✅ Personalized messages based on conversation history
- ✅ Tag-based targeting (send to "Hot Leads", skip "Purchased")
- ✅ Smart timing (24hr, 48hr, 7 days, etc.)
- ✅ Auto-stops when user replies
- ✅ 13,500 messages/day capacity

---

## 🚀 Implementation Steps

### Step 1: Environment Variables (5 minutes)

Add to your `.env.local` or `.env`:

```env
# If you don't have 9 keys yet, your existing 8 are fine
# Add one more if you want full 135 req/min capacity
GOOGLE_AI_API_KEY_9=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Generate this: openssl rand -hex 32
CRON_SECRET=your_generated_secret_here_12345678901234567890
```

---

### Step 2: Database Schema (30 minutes)

**File:** `prisma/schema.prisma`

Add these models at the end of the file:

```prisma
// ============================================
// AI AUTOMATION SYSTEM
// ============================================

model AIAutomationRule {
  id                    String    @id @default(cuid())
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  name                  String
  description           String?
  enabled               Boolean   @default(true)
  
  // Time settings
  triggerType           String    @default("time_based")
  timeIntervalMinutes   Int?
  timeIntervalHours     Int?
  timeIntervalDays      Int?
  
  // AI settings
  customPrompt          String    @db.Text
  languageStyle         String    @default("taglish")
  
  // Targeting
  facebookPageId        String?
  facebookPage          FacebookPage? @relation(fields: [facebookPageId], references: [id], onDelete: Cascade)
  includeTags           String[]  // Tag names to include
  excludeTags           String[]  // Tag names to exclude
  
  // Limits & schedules
  maxMessagesPerDay     Int       @default(100)
  activeHoursStart      Int       @default(9)
  activeHoursEnd        Int       @default(21)
  run24_7               Boolean   @default(false)
  
  // Behavior
  stopOnReply           Boolean   @default(true)
  removeTagOnReply      String?   // Tag to remove when user replies
  messageTag            MessageTag? // ACCOUNT_UPDATE, etc.
  
  // Stats
  lastExecutedAt        DateTime?
  executionCount        Int       @default(0)
  successCount          Int       @default(0)
  failureCount          Int       @default(0)
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  executions            AIAutomationExecution[]
  stops                 AIAutomationStop[]
  
  @@index([userId, enabled])
  @@index([enabled, lastExecutedAt])
}

model AIAutomationExecution {
  id                    String    @id @default(cuid())
  
  ruleId                String
  rule                  AIAutomationRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  contactId             String
  contact               Contact   @relation(fields: [contactId], references: [id], onDelete: Cascade)
  
  conversationId        String?
  conversation          Conversation? @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  recipientPSID         String
  recipientName         String?
  
  // AI data
  aiPromptUsed          String?   @db.Text
  generatedMessage      String?   @db.Text
  aiReasoning           String?   @db.Text
  previousMessages      Json?     // Array of messages shown to AI
  
  // Execution result
  status                String    @default("processing") // processing, sent, failed
  facebookMessageId     String?
  errorMessage          String?
  
  followUpNumber        Int       @default(1)
  executedAt            DateTime  @default(now())
  createdAt             DateTime  @default(now())
  
  @@index([ruleId, createdAt])
  @@index([contactId, createdAt])
  @@index([status])
}

model AIAutomationStop {
  id                String    @id @default(cuid())
  
  ruleId            String
  rule              AIAutomationRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  
  contactId         String
  contact           Contact   @relation(fields: [contactId], references: [id], onDelete: Cascade)
  
  recipientPSID     String
  stoppedReason     String    // "user_replied", "manual_stop", "max_reached"
  followUpsSent     Int       @default(0)
  tagRemoved        String?
  
  createdAt         DateTime  @default(now())
  
  @@unique([ruleId, contactId])
  @@index([contactId])
}
```

**Also update these models to add relations:**

```prisma
model User {
  // ... existing fields ...
  
  // Add these lines:
  aiAutomationRules      AIAutomationRule[]
  aiAutomationExecutions AIAutomationExecution[]
}

model Contact {
  // ... existing fields ...
  
  // Add these lines:
  aiAutomationExecutions AIAutomationExecution[]
  aiAutomationStops      AIAutomationStop[]
}

model Conversation {
  // ... existing fields ...
  
  // Add this line:
  aiAutomationExecutions AIAutomationExecution[]
}

model FacebookPage {
  // ... existing fields ...
  
  // Add this line:
  aiAutomationRules AIAutomationRule[]
}
```

**Apply the schema:**
```bash
npx prisma db push
```

---

### Step 3: AI Service Enhancement (15 minutes)

**File:** `src/lib/ai/google-ai-service.ts`

Add at the end of the file (before the last closing brace):

```typescript
// Add 9th key to the constructor
constructor() {
  this.keys = [
    process.env.GOOGLE_AI_API_KEY,
    process.env.GOOGLE_AI_API_KEY_2,
    process.env.GOOGLE_AI_API_KEY_3,
    process.env.GOOGLE_AI_API_KEY_4,
    process.env.GOOGLE_AI_API_KEY_5,
    process.env.GOOGLE_AI_API_KEY_6,
    process.env.GOOGLE_AI_API_KEY_7,
    process.env.GOOGLE_AI_API_KEY_8,
    process.env.GOOGLE_AI_API_KEY_9, // ⭐ NEW
  ].filter((key): key is string => !!key);

  if (this.keys.length === 0) {
    console.warn('[Google AI] No API keys configured');
  }
}

// Add new function
export interface FollowUpMessageResult {
  message: string;
  reasoning: string;
}

export async function generateFollowUpMessage(
  contactName: string,
  conversationHistory: Array<{ from: string; text: string; timestamp?: Date }>,
  customInstructions: string,
  languageStyle: string = 'taglish',
  retries = 2
): Promise<FollowUpMessageResult | null> {
  const apiKey = keyManager.getNextKey();
  if (!apiKey) {
    console.error('[Google AI] No API key available');
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const conversationText = conversationHistory
      .slice(0, 20) // Last 20 messages
      .map(msg => `${msg.from}: ${msg.text}`)
      .join('\n');

    const prompt = `You are a helpful customer support assistant generating a follow-up message.

Contact Name: ${contactName}

Recent Conversation:
${conversationText}

Instructions: ${customInstructions}

Language Style: ${languageStyle}

Generate a personalized follow-up message that:
1. References their specific conversation context
2. Uses ${languageStyle} language naturally
3. Is friendly and helpful (not pushy or salesy)
4. Encourages a genuine response
5. Is concise (2-4 sentences maximum)

Respond with valid JSON:
{
  "message": "your generated message here",
  "reasoning": "brief explanation of your approach"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    // Parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Google AI] No JSON in response');
      return null;
    }
    
    const parsed = JSON.parse(jsonMatch[0]) as FollowUpMessageResult;
    console.log(`[Google AI] Generated follow-up for ${contactName}`);
    
    return parsed;
  } catch (error: any) {
    if (error.message?.includes('429') && retries > 0) {
      console.warn('[Google AI] Rate limited, retrying...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return generateFollowUpMessage(
        contactName,
        conversationHistory,
        customInstructions,
        languageStyle,
        retries - 1
      );
    }
    
    console.error('[Google AI] Follow-up generation failed:', error.message);
    return null;
  }
}
```

---

### Step 4: Create API Routes (1 hour)

I'll create all the necessary API route files. Let me know when you're ready and I'll generate them.

**Files to create:**
1. `src/app/api/ai-automations/route.ts`
2. `src/app/api/ai-automations/[id]/route.ts`
3. `src/app/api/ai-automations/execute/route.ts`
4. `src/app/api/cron/ai-automations/route.ts`

---

### Step 5: Webhook Enhancement (15 minutes)

**File:** `src/app/api/webhooks/facebook/route.ts`

In the `handleIncomingMessage` function, add after line 224 (after updating contact):

```typescript
// ⭐ NEW: AI Automation Reply Detection
const activeAutomations = await prisma.aIAutomationRule.findMany({
  where: {
    enabled: true,
    stopOnReply: true,
    OR: [
      { facebookPageId: page.id },
      { facebookPageId: null } // Rules for all pages
    ]
  }
});

for (const rule of activeAutomations) {
  const existingStop = await prisma.aIAutomationStop.findUnique({
    where: {
      ruleId_contactId: {
        ruleId: rule.id,
        contactId: contact.id
      }
    }
  });

  if (!existingStop) {
    const executionCount = await prisma.aIAutomationExecution.count({
      where: {
        ruleId: rule.id,
        contactId: contact.id,
        status: 'sent'
      }
    });

    await prisma.aIAutomationStop.create({
      data: {
        ruleId: rule.id,
        contactId: contact.id,
        recipientPSID: senderId,
        stoppedReason: 'user_replied',
        followUpsSent: executionCount
      }
    });

    if (rule.removeTagOnReply && contact.tags.includes(rule.removeTagOnReply)) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          tags: contact.tags.filter(t => t !== rule.removeTagOnReply)
        }
      });
    }

    console.log(`[AI Automation] Stopped rule ${rule.id} for contact ${contact.id}`);
  }
}
```

---

### Step 6: Cron Configuration (10 minutes)

**File:** `vercel.json` (create in project root)

```json
{
  "crons": [
    {
      "path": "/api/cron/teams",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/ai-automations",
      "schedule": "* * * * *"
    }
  ]
}
```

---

### Step 7: Deploy & Test (30 minutes)

```bash
# Commit changes
git add .
git commit -m "Add AI automation feature"

# Deploy to Vercel
git push origin main

# Verify in Vercel dashboard:
# 1. Go to Settings → Cron Jobs
# 2. Confirm ai-automations cron is listed
# 3. Check logs after 1 minute
```

---

## 🧪 Testing Checklist

### Manual Testing

```bash
# 1. Test AI generation
curl -X POST http://localhost:3000/api/ai-automations/execute

# 2. Check database
# Verify AIAutomationRule, AIAutomationExecution tables exist

# 3. Create test rule via API
curl -X POST http://localhost:3000/api/ai-automations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Rule",
    "customPrompt": "Send a friendly follow-up",
    "languageStyle": "english",
    "timeIntervalHours": 24,
    "maxMessagesPerDay": 10,
    "stopOnReply": true
  }'

# 4. Verify cron runs (check Vercel logs after 1 minute)
```

### Production Testing

1. Create rule with small time interval (15 minutes)
2. Use test contact with old `lastInteraction`
3. Monitor executions in database
4. Reply as test contact
5. Verify automation stops

---

## 📊 Monitoring

### Check Execution Stats

```sql
-- Today's executions
SELECT 
  r.name,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE e.status = 'sent') as sent,
  COUNT(*) FILTER (WHERE e.status = 'failed') as failed
FROM "AIAutomationExecution" e
JOIN "AIAutomationRule" r ON e."ruleId" = r.id
WHERE e."createdAt" >= CURRENT_DATE
GROUP BY r.name;

-- Recent executions with messages
SELECT 
  e."recipientName",
  e."generatedMessage",
  e.status,
  e."createdAt"
FROM "AIAutomationExecution" e
ORDER BY e."createdAt" DESC
LIMIT 10;
```

### Vercel Logs

```
1. Vercel Dashboard
2. Your Project → Deployments
3. Click latest deployment
4. Functions → /api/cron/ai-automations
5. View logs
```

---

## 🔥 Quick Wins

### Example Rule: 24-Hour Follow-Up

```typescript
{
  name: "24hr Hot Lead Follow-up",
  customPrompt: "Remind them about their inquiry. Mention any products they asked about. Be friendly and helpful.",
  languageStyle: "taglish",
  timeIntervalHours: 24,
  includeTags: ["Hot Lead"],
  excludeTags: ["Purchased", "Not Interested"],
  maxMessagesPerDay: 50,
  activeHoursStart: 9,
  activeHoursEnd: 21,
  stopOnReply: true,
  removeTagOnReply: "Hot Lead",
  messageTag: "ACCOUNT_UPDATE"
}
```

### Example Rule: 7-Day Re-engagement

```typescript
{
  name: "7-Day Re-engagement",
  customPrompt: "Check in to see if they still need help. Be casual and non-pushy.",
  languageStyle: "english",
  timeIntervalDays: 7,
  excludeTags: ["Purchased"],
  maxMessagesPerDay: 20,
  run24_7: false,
  stopOnReply: true
}
```

---

## 🚨 Common Issues

### Issue: Cron not running

**Check:**
- `vercel.json` committed to git
- Deployed to Vercel (not just local)
- Check Vercel dashboard → Cron Jobs

**Fix:**
```bash
git add vercel.json
git commit -m "Add cron config"
git push
```

### Issue: No messages sent

**Check:**
- Rule is enabled: `enabled: true`
- Time interval passed (check `lastInteraction` vs `timeInterval`)
- Active hours (9am-9pm by default)
- Daily limit not reached
- Contact has `messengerPSID`

**Debug:**
```sql
SELECT 
  c."firstName",
  c."lastInteraction",
  c.tags,
  c."messengerPSID"
FROM "Contact" c
WHERE c."lastInteraction" < NOW() - INTERVAL '24 hours'
LIMIT 10;
```

### Issue: Messages not personalized

**Check:**
- Conversation exists in database
- Messages linked to conversation
- AI service has valid API keys

**Test:**
```typescript
import { generateFollowUpMessage } from '@/lib/ai/google-ai-service';

const result = await generateFollowUpMessage(
  'Test User',
  [{ from: 'Test User', text: 'Hello, I need help' }],
  'Reply helpfully',
  'english'
);

console.log(result);
```

---

## 💡 Tips

### Start Small

```
Day 1: Test with 1 rule, 10 contacts
Day 2: Expand to 50 contacts
Day 3: Enable for all qualifying contacts
```

### Monitor Closely

- Check logs daily for first week
- Monitor Facebook message delivery rates
- Track reply rates in executions table
- Adjust prompts based on results

### Optimize Prompts

```
Good: "Follow up on their coffee order inquiry from yesterday"
Bad: "Send a generic marketing message"

Good: "Reference their specific questions about wholesale pricing"
Bad: "Ask if they're interested in our products"
```

---

## 🎉 Success Metrics

### Week 1 Goals

- ✅ At least 1 automation rule active
- ✅ 50+ automated messages sent
- ✅ 95%+ delivery success rate
- ✅ Zero system errors

### Month 1 Goals

- ✅ 3-5 automation rules running
- ✅ 500+ automated messages sent
- ✅ 30%+ reply rate
- ✅ Measurable increase in re-engagement

---

## 📞 Need Help?

**Issues?** Check:
1. This guide (common issues section)
2. Vercel logs (deployment → functions)
3. Database records (AIAutomationExecution table)
4. Console logs (browser & server)

**Ready to implement?** Follow steps 1-7 sequentially. Each step builds on the previous one.

---

**Estimated Total Time:** 4-6 hours  
**Difficulty:** Medium  
**Risk:** Low  
**Impact:** High  

Let's build it! 🚀

