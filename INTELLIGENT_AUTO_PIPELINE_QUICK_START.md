# 🚀 Intelligent Auto Pipeline - Quick Start Guide

**Last Updated:** November 12, 2025

---

## ⚡ What's New

Your auto pipeline is now **INTELLIGENT**! It automatically:

✅ **Routes by status** - WON contacts → Won stage, LOST contacts → Lost stage  
✅ **Routes by score** - High scores → Advanced stages, Low scores → Early stages  
✅ **Sorts by priority** - Hot leads appear first in each stage  
✅ **Auto-generates ranges** - Analyzes pipeline and assigns score ranges  

---

## 🗂️ Database Migration Required

**⚠️ IMPORTANT:** Run this SQL on your database first:

```sql
-- Add lead score range fields to PipelineStage
ALTER TABLE "PipelineStage" 
  ADD COLUMN "leadScoreMin" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "leadScoreMax" INTEGER NOT NULL DEFAULT 100;

-- Add index for lead score sorting (improves query performance)
CREATE INDEX "Contact_stageId_leadScore_idx" 
  ON "Contact"("stageId", "leadScore");
```

**Verify it worked:**
```sql
SELECT "id", "name", "leadScoreMin", "leadScoreMax" 
FROM "PipelineStage" 
LIMIT 5;
```

---

## 🎬 Quick Start (3 Steps)

### Step 1: Generate Score Ranges for Your Pipelines

Option A: **Analyze All Pipelines** (Recommended for first time)
```bash
curl -X POST http://localhost:3000/api/pipelines/analyze-all \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Option B: **Analyze Single Pipeline**
```bash
curl -X POST http://localhost:3000/api/pipelines/PIPELINE_ID/analyze-stages \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**What this does:**
- Analyzes your pipeline stages
- Assigns intelligent score ranges based on stage types
- Example: "New Lead" gets 0-15, "Qualified" gets 31-50, "Closed Won" gets 81-100

### Step 2: Enable Auto-Pipeline (If Not Already)

Go to Settings → Integrations → Click "Settings" on your Facebook page → Select pipeline → Save

### Step 3: Sync Contacts

Click "Sync Contacts" - watch the magic happen!

---

## 📊 How It Works

### Score Ranges (Auto-Generated)

```
LEAD stages:        0-30   (Cold to warm leads)
IN_PROGRESS stages: 31-80  (Qualified to closing)
WON stages:         81-100 (Hot leads to closed)
LOST stages:        0-20   (Lost opportunities)
```

### Example: Sales Pipeline

```
┌────────────────────┬──────────────┬─────────────────┐
│ Stage Name         │ Type         │ Score Range     │
├────────────────────┼──────────────┼─────────────────┤
│ New Lead           │ LEAD         │ 0-15            │
│ Contacted          │ IN_PROGRESS  │ 16-30           │
│ Qualified          │ IN_PROGRESS  │ 31-50           │
│ Proposal Sent      │ IN_PROGRESS  │ 51-65           │
│ Negotiating        │ IN_PROGRESS  │ 66-80           │
│ Closed Won         │ WON          │ 81-100          │
│ Closed Lost        │ LOST         │ 0-20            │
└────────────────────┴──────────────┴─────────────────┘
```

### Routing Logic

```
Priority 1: STATUS ROUTING
├─ leadStatus === "WON"  → Route to WON stage
└─ leadStatus === "LOST" → Route to LOST stage

Priority 2: SCORE ROUTING
└─ Find stage where: leadScoreMin <= score <= leadScoreMax

Priority 3: FALLBACK
└─ Use stage with closest midpoint score
```

---

## 🎯 Example Scenarios

### Scenario 1: Deal Closed!

**Conversation:**
```
Customer: "Perfect! Let's go ahead with the order"
Customer: "I'll send the signed contract today"
```

**AI Analysis:**
- Lead Score: 95
- Lead Status: **WON** ← Key!
- Recommended Stage: "Closed Won"

**Result:** 
✅ Automatically routed to "Closed Won" stage  
✅ No manual movement needed!

### Scenario 2: High Engagement

**Conversation:**
```
Customer: "I'm interested in 500 units"
Customer: "What's the pricing?"
Business: "We offer 20% discount for 500 units"
Customer: "Great! What's the timeline?"
```

**AI Analysis:**
- Lead Score: 72
- Lead Status: QUALIFIED
- Recommended Stage: "Negotiating"

**Result:**
✅ Score 72 falls in "Negotiating" range (66-80)  
✅ Assigned to correct stage automatically!

### Scenario 3: Lead Prioritization

**Stage: "Qualified" (Score Range: 31-50)**

Contacts sorted automatically:
```
1. Sarah Johnson - Score: 49 ⭐⭐⭐ (HOT - Follow up NOW!)
2. Mike Davis - Score: 45 ⭐⭐⭐
3. Emma Wilson - Score: 38 ⭐⭐
4. John Smith - Score: 32 ⭐
```

**Result:**
✅ Hot leads appear first  
✅ Easy to prioritize follow-ups  
✅ No manual sorting needed!

---

## 🔧 API Endpoints

### Analyze Pipeline Stages

```http
POST /api/pipelines/{pipelineId}/analyze-stages

Response:
{
  "success": true,
  "distribution": {
    "pipelineName": "Sales Pipeline",
    "stages": [
      {
        "name": "New Lead",
        "type": "LEAD",
        "scoreRange": "0-15",
        "contactCount": 45
      },
      ...
    ]
  }
}
```

### Get Stage Distribution

```http
GET /api/pipelines/{pipelineId}/analyze-stages

Response:
{
  "distribution": { ... }
}
```

### Analyze All Pipelines

```http
POST /api/pipelines/analyze-all

Response:
{
  "success": true,
  "updatedCount": 5,
  "message": "Successfully generated score ranges for 5 pipelines"
}
```

### Get Stage Contacts (Sorted by Score)

```http
GET /api/pipelines/stages/{stageId}/contacts?sort=leadScore&order=desc

Response:
{
  "contacts": [
    {
      "id": "...",
      "firstName": "Sarah",
      "lastName": "Johnson",
      "leadScore": 95,
      "leadStatus": "WON"
    },
    ...
  ],
  "pagination": { ... }
}
```

---

## 🎨 Console Logs

When sync runs with intelligent routing enabled, you'll see:

```
[Sync] Starting contact sync...
[Auto-Pipeline] Enabled: true
[Auto-Pipeline] Target Pipeline: Sales Pipeline
[Stage Analyzer] Calculated score ranges for pipeline Sales Pipeline:
  - New Lead: 0-15
  - Contacted: 16-30
  - Qualified: 31-50
  - Proposal Sent: 51-65
  - Negotiating: 66-80
  - Closed Won: 81-100
[Google AI] Stage recommendation: Qualified (confidence: 85%)
[Stage Analyzer] Score-based routing: 45 → Qualified (31-50)
[Auto-Assign] Contact abc123 → Sales Pipeline → Qualified (score: 45, confidence: 85%)
```

---

## ⚙️ Configuration Options

### Sort Contacts in Stage

```javascript
// By lead score (default - highest first)
?sort=leadScore&order=desc

// By lead score (lowest first)
?sort=leadScore&order=asc

// By entry time
?sort=stageEnteredAt&order=desc

// By name
?sort=name&order=asc
```

### Re-analyze Pipeline Anytime

If you add/remove/reorder stages:
```bash
# Recalculate score ranges
curl -X POST http://localhost:3000/api/pipelines/PIPELINE_ID/analyze-stages
```

---

## 🚨 Troubleshooting

### Issue: Contacts not routing to WON/LOST stages

**Check:**
1. Do you have stages with type WON/LOST?
2. Is AI detecting the status correctly?
3. Check console logs for routing decisions

**Fix:**
- Create stages with proper types (WON, LOST)
- Run analyze-stages to set score ranges
- Re-sync contacts

### Issue: All contacts going to first stage

**Check:**
1. Have you run analyze-stages?
2. Check if stages have score ranges set

**Fix:**
```bash
# Generate score ranges
curl -X POST http://localhost:3000/api/pipelines/PIPELINE_ID/analyze-stages
```

### Issue: Scores seem wrong

**Remember:** Scores are AI-calculated based on:
- Conversation maturity
- Customer engagement
- Buying signals
- Timeline/urgency

**If consistently off:**
- Review AI reasoning in activity logs
- Adjust stage descriptions for clarity
- Consider re-analyzing conversations

---

## 📈 Benefits You'll See

**Before:**
- All new contacts in "New Lead" stage
- Manual categorization required
- No prioritization
- Time-consuming

**After:**
- Contacts auto-sorted into correct stages
- WON/LOST deals automatically filed
- Hot leads appear first
- Zero manual work!

---

## 🎉 Success Indicators

You'll know it's working when:

✅ **Console shows:** `[Stage Analyzer] Score-based routing: 75 → Negotiating (66-80)`  
✅ **Contacts appear in different stages** (not all in first stage)  
✅ **High-score contacts at top** of each stage  
✅ **WON deals automatically** in "Closed Won" stage  
✅ **Activity logs show** AI reasoning with scores  

---

## 🔮 What's Next?

After setting this up, you can:

1. **Monitor accuracy** - Check if AI assignments are correct
2. **Adjust ranges** - Manually tweak if needed (future feature)
3. **Review analytics** - See lead score distribution
4. **Optimize stages** - Add/remove based on needs

---

## 📞 Need Help?

**Check logs:**
```bash
# Filter console output
[Stage Analyzer]  # Routing decisions
[Google AI]       # AI analysis
[Auto-Assign]     # Assignment confirmations
```

**Review documentation:**
- `INTELLIGENT_AUTO_PIPELINE_ENHANCEMENT.md` - Full details
- `AUTO_PIPELINE_COMPREHENSIVE_ANALYSIS.md` - Original feature

---

**Status:** ✅ Ready to use (after database migration)  
**Time to setup:** 5 minutes  
**Complexity:** Low (3 simple steps)

---

## 🎯 TL;DR

1. **Run SQL** to add score range fields
2. **Run** `POST /api/pipelines/analyze-all`
3. **Sync contacts** and watch them auto-organize!

That's it! Your pipeline is now intelligent! 🎉

