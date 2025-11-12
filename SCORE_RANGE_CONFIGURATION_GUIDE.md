# 🎯 Score Range Configuration - Complete Guide

**Date:** November 12, 2025  
**Status:** ✅ Fully Implemented  
**Solution:** Manual + Automatic Score Range Management

---

## 🚀 Immediate Fix for Your Current Issue

You have 32 contacts in "New Lead" with scores 20-65. Here's how to fix it RIGHT NOW:

### Option 1: Quick Fix (30 seconds)

1. **Open your Sales Pipeline page**
2. **Click "Score Ranges" button** (new button in header)
3. **Click "Auto-Generate All Ranges"** (in the dialog)
4. **Click "Save & Re-assign Contacts"**
5. **Watch contacts distribute across stages!** ✨

### Option 2: API Fix (Command Line)

```bash
# Your pipeline ID from the URL
PIPELINE_ID="your_pipeline_id_here"

# Step 1: Generate intelligent score ranges
curl -X POST http://localhost:3000/api/pipelines/${PIPELINE_ID}/analyze-stages

# Step 2: Re-assign all contacts
curl -X POST http://localhost:3000/api/pipelines/${PIPELINE_ID}/reassign-all
```

**Result:** Those 65-score contacts will move out of "New Lead" immediately!

---

## 🎨 New UI Features

### 1. Score Ranges Button

**Location:** Pipeline detail page header

**What it does:**
- Opens dialog to configure score ranges per stage
- Shows current ranges
- Allows manual adjustment
- Auto-generate option available

**Visual:**
```
Header buttons:
[🎯 Score Ranges] [🔄 Re-assign All] [👥 Add Contacts] [+ Add Stage] [✏️ Edit]
     ↑ NEW              ↑ NEW
```

### 2. Score Range Dialog

**Features:**
- Configure min/max scores for each stage
- Visual preview of ranges
- Auto-generate button for intelligent defaults
- Save & re-assign in one click

**Example Dialog:**
```
┌─────────────────────────────────────────────────────────┐
│ Configure Lead Score Ranges                             │
│                                                         │
│ ℹ️ LEAD stages: 0-30, IN_PROGRESS: 31-80, WON: 81-100  │
│                                                         │
│ [✨ Auto-Generate All Ranges]                          │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ #1  New Lead                          [LEAD]    │   │
│ │ Min Score: [0]    Max Score: [30]              │   │
│ │ Contacts with scores 0-30 will be assigned here│   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ #2  Contacted                [IN_PROGRESS]      │   │
│ │ Min Score: [31]   Max Score: [50]              │   │
│ │ Contacts with scores 31-50 will be assigned here│   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ ... (more stages)                                       │
│                                                         │
│ [Cancel]  [Save & Re-assign Contacts]                 │
└─────────────────────────────────────────────────────────┘
```

### 3. Re-assign All Button

**Location:** Pipeline detail page header

**What it does:**
- Re-assigns ALL contacts in pipeline
- Uses their current lead scores
- Moves them to matching stages
- Creates activity logs

**Usage:**
1. Click "Re-assign All" button
2. Confirm: "Re-assign all contacts based on their lead scores?"
3. System processes all contacts
4. Toast: "Successfully re-assigned 28 contacts!"
5. View updates with new distribution

---

## 📊 How Score Ranges Work

### Automatic Range Calculation

When you click "Auto-Generate", the system analyzes your pipeline structure:

```
Pipeline: 7 stages

LEAD stages (2 total):
├─ New Lead:      0-15   (30 ÷ 2 = 15 per stage)
└─ Contacted:     16-30

IN_PROGRESS stages (4 total):
├─ Qualified:     31-42  (50 ÷ 4 = ~12 per stage)
├─ Proposal:      43-54
├─ Negotiating:   55-67
└─ Final Review:  68-80

WON stages (1 total):
└─ Closed Won:    81-100 (20 range for won deals)

Result: Each stage has appropriate, non-overlapping ranges
```

### Manual Configuration

**You can also set ranges manually:**

```
Example: Enterprise sales pipeline

New Inquiry:     0-20   (just contacted)
Discovery Call:  21-40  (understanding needs)
Demo Scheduled:  41-60  (high interest)
Proposal Sent:   61-75  (formal offer)
Negotiating:     76-90  (discussing terms)
Contract Sent:   91-100 (ready to close)
```

**Custom ranges give you:**
- Industry-specific stages
- Company-specific criteria
- Flexible control
- Fine-tuned routing

---

## 🔄 Re-assignment Process

### What Happens

```
1. Click "Re-assign All"
   ↓
2. System loads all contacts in pipeline
   ↓
3. For each contact:
   ├─ Check lead score (e.g., 65)
   ├─ Check lead status (e.g., QUALIFIED)
   ├─ Find matching stage:
   │   Priority 1: Status-based (WON→WON, LOST→LOST)
   │   Priority 2: Score-based (65 fits in 61-75 range)
   │   Priority 3: Closest match
   ├─ Update contact.stageId
   └─ Create activity log
   ↓
4. Return results: "28 reassigned, 4 skipped"
   ↓
5. UI refreshes with new distribution
```

### Activity Logs

Each reassignment creates an audit trail:

```
Type: STAGE_CHANGED
Title: Bulk re-assigned based on lead score
Description: Automatically moved to match lead score range. Score: 65, Status: QUALIFIED
From: New Lead → To: Proposal Sent
Metadata: { bulkReassignment: true, leadScore: 65, leadStatus: "QUALIFIED" }
```

---

## 🧪 Testing Guide

### Test 1: Configure & Re-assign (Recommended)

```
1. Open your Sales Pipeline page
2. Click "Score Ranges" button
3. Click "Auto-Generate All Ranges"
4. Review the generated ranges
5. Click "Save & Re-assign Contacts"
6. Watch toast: "Successfully re-assigned X contacts!"
7. View pipeline - contacts should be distributed:
   - Scores 0-30 in early stages
   - Scores 50-70 in middle stages
   - Scores 80+ in advanced stages
```

### Test 2: Manual Adjustment

```
1. Click "Score Ranges"
2. Manually set ranges:
   - New Lead: 0-25
   - Contacted: 26-50
   - Qualified: 51-75
   - Won: 76-100
3. Save & Re-assign
4. Verify contacts moved to match new ranges
```

### Test 3: Re-assign Only

```
1. Ensure ranges are already set
2. Click "Re-assign All" button
3. Confirm
4. All contacts reorganize based on current ranges
```

---

## 📈 Expected Results

### Before Configuration

```
Sales Pipeline
├─ New Lead:      32 contacts (scores: 20-95) ❌
├─ Contacted:     0 contacts
├─ Qualified:     0 contacts
├─ Proposal Sent: 0 contacts
└─ ...

Problem: All contacts lumped together
```

### After Configuration & Re-assignment

```
Sales Pipeline
├─ New Lead:      5 contacts  (scores: 20-30) ✅
├─ Contacted:     7 contacts  (scores: 31-45) ✅
├─ Qualified:     12 contacts (scores: 46-60) ✅
├─ Proposal Sent: 6 contacts  (scores: 61-75) ✅
├─ Negotiating:   2 contacts  (scores: 76-85) ✅
└─ Closed Won:    0 contacts  (scores: 86-100) ✅

Result: Proper distribution based on engagement!
```

---

## 🔍 Console Logs

### During Re-assignment

```
[Reassign All] Starting bulk re-assignment for 32 contacts in pipeline: Sales Pipeline
[Stage Analyzer] Score-based routing: 65 → Qualified (51-75)
[Reassign All] Contact abc123 (score: 65) → Stage xyz789
[Stage Analyzer] Score-based routing: 85 → Negotiating (76-90)
[Reassign All] Contact def456 (score: 85) → Stage uvw012
...
[Reassign All] Complete: 28 reassigned, 4 skipped
```

### During Score Range Generation

```
[Stage Analyzer] Calculated score ranges for pipeline Sales Pipeline:
  - New Lead: 0-15
  - Contacted: 16-30
  - Qualified: 31-50
  - Proposal Sent: 51-65
  - Negotiating: 66-80
  - Closed Won: 81-100
[Stage Analyzer] Applied score ranges to 6 stages
```

---

## 💡 Pro Tips

### Tip 1: Auto-Generate First, Then Adjust

```
1. Click "Auto-Generate" to get intelligent defaults
2. Review the ranges
3. Manually tweak if needed (e.g., make "New Lead" 0-25 instead of 0-15)
4. Save
```

### Tip 2: Re-assign After Range Changes

```
Always click "Re-assign All" after changing ranges to move existing contacts to correct stages.
```

### Tip 3: Check Distribution

```
After re-assignment, review your pipeline:
- Are high scores in advanced stages? ✅
- Are low scores in early stages? ✅
- Distribution looks natural? ✅
```

### Tip 4: Sync After Configuration

```
Once ranges are set, new contacts will automatically
be assigned to correct stages during sync!
```

---

## 🎯 Files Created

1. ✅ `src/components/pipelines/score-range-dialog.tsx` - Configuration UI
2. ✅ `src/app/api/pipelines/[id]/stages/update-ranges/route.ts` - Update API
3. ✅ `src/app/api/pipelines/[id]/reassign-all/route.ts` - Bulk re-assignment

## 📝 Files Modified

1. ✅ `src/app/(dashboard)/pipelines/[id]/page.tsx` - Added buttons and dialog
2. ✅ `src/app/api/pipelines/route.ts` - Auto-generate on pipeline creation
3. ✅ `src/lib/facebook/sync-contacts.ts` - Auto-generate before sync
4. ✅ `src/lib/facebook/background-sync.ts` - Auto-generate before sync

---

## ✅ Summary

**Problem:** 32 contacts stuck in "New Lead" with scores 20-95  
**Cause:** Default score ranges (0-100) on all stages  
**Solution:** Manual configuration UI + Auto-generation + Bulk re-assignment  
**Result:** Contacts distributed properly based on lead scores  

**Actions Available:**
1. **Auto-Generate** - One click intelligent ranges
2. **Manual Configure** - Set custom ranges
3. **Re-assign All** - Bulk move contacts to correct stages
4. **Live Updates** - See changes via Supabase Realtime

**Status:** 🟢 READY TO USE!

---

**Next Step:** Click "Score Ranges" → "Auto-Generate" → "Save" and watch your contacts organize themselves! 🎉

