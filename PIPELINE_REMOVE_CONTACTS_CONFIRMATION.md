# Pipeline Contact Removal Confirmation

## Overview
Added a confirmation dialog before removing contacts from pipeline stages to prevent accidental deletions.

## Changes Made

### 1. Updated PipelineState Interface
Added new state properties to track the remove contacts dialog:
- `dialogs.showRemoveContacts`: Boolean to show/hide the confirmation dialog
- `selectedStageForRemove`: String to track which stage's contacts are being removed

### 2. Updated Reducer Actions
Added new action type:
- `SET_SELECTED_STAGE_FOR_REMOVE`: Sets the stage ID for pending contact removal

### 3. Modified handleBulkRemoveContacts Function
**Before:**
- Immediately removed contacts without confirmation
- User could accidentally delete contacts

**After:**
- Shows a confirmation dialog first
- Sets the stage ID for pending removal
- Waits for user confirmation

### 4. Added confirmRemoveContacts Function
New function that:
- Executes after user confirms the removal
- Removes contacts from the pipeline stage
- Shows loading state during the operation
- Displays success/error messages
- Cleans up state after completion

### 5. Added Confirmation Dialog Component
New AlertDialog that displays:
- Title: "Remove Contacts from Pipeline?"
- Description: Shows the number of contacts being removed and clarifies they won't be deleted
- Actions:
  - Cancel button (closes dialog)
  - Remove Contacts button (executes removal)
  - Both buttons disabled during deletion operation

## User Experience Flow

### Before Enhancement
1. User selects contacts in a stage
2. Clicks "Remove" button
3. ❌ Contacts immediately removed (no confirmation)

### After Enhancement
1. User selects contacts in a stage
2. Clicks "Remove" button
3. ✅ Confirmation dialog appears
4. Dialog shows:
   - Number of contacts to be removed
   - Clear message that contacts won't be deleted, only removed from pipeline
5. User can:
   - Cancel (no action taken)
   - Confirm removal (contacts removed from pipeline)
6. Loading state shown during operation
7. Success message displayed

## Benefits

### 1. **Prevents Accidental Deletions**
- Users must explicitly confirm before removing contacts
- Reduces risk of mistakes

### 2. **Clear Communication**
- Dialog explains what will happen
- Clarifies that contacts aren't being deleted, just removed from pipeline
- Shows exact number of contacts affected

### 3. **Better UX**
- Loading states during operation
- Clear success/error messages
- Non-blocking UI (can cancel at any time)

### 4. **Consistent with Best Practices**
- Follows the same pattern as stage deletion
- Uses AlertDialog component for consistency
- Proper state management with reducer pattern

## Technical Implementation

### State Management
```typescript
interface PipelineState {
  // ... other properties
  dialogs: {
    showRemoveContacts: boolean;  // New dialog flag
  };
  selectedStageForRemove: string | null;  // Track which stage
  isDeleting: boolean;  // Shared loading state
}
```

### Confirmation Flow
```typescript
// Step 1: User clicks Remove button
handleBulkRemoveContacts(stageId) {
  // Show dialog instead of removing immediately
  dispatch({ type: 'SET_SELECTED_STAGE_FOR_REMOVE', payload: stageId });
  dispatch({ type: 'TOGGLE_DIALOG', payload: { dialog: 'showRemoveContacts', value: true } });
}

// Step 2: User confirms in dialog
confirmRemoveContacts() {
  // Execute the actual removal
  const stageId = state.selectedStageForRemove;
  const contactIds = Array.from(state.selectedStageContacts[stageId] || []);
  
  // API call to remove contacts
  await fetch(`/api/pipelines/stages/${stageId}/contacts/bulk-remove`, {
    method: 'POST',
    body: JSON.stringify({ contactIds }),
  });
  
  // Clean up and refresh
}
```

## Testing Checklist

- [x] Confirmation dialog appears when clicking Remove button
- [x] Dialog shows correct number of selected contacts
- [x] Cancel button closes dialog without removing contacts
- [x] Remove button successfully removes contacts
- [x] Loading state shown during removal
- [x] Success message displayed after removal
- [x] Error handling works properly
- [x] State cleaned up after operation
- [x] No linter errors

## Files Modified

1. `/src/app/(dashboard)/pipelines/[id]/page.tsx`
   - Added new state properties
   - Added new reducer action
   - Modified handleBulkRemoveContacts function
   - Added confirmRemoveContacts function
   - Added AlertDialog component for confirmation

## API Endpoint Used

```
POST /api/pipelines/stages/{stageId}/contacts/bulk-remove
Body: { contactIds: string[] }
```

This endpoint:
- Removes contacts from the pipeline stage
- Does NOT delete the contacts themselves
- Updates the pipeline view automatically via Supabase Realtime

## Notes

- Contacts are only removed from the pipeline, not deleted from the system
- The same contacts can be re-added to the pipeline later
- The confirmation dialog is consistent with the stage deletion dialog
- Loading states prevent multiple simultaneous operations

## Future Enhancements (Optional)

1. Add "Don't ask again" checkbox for power users
2. Show contact names in confirmation dialog
3. Add undo functionality
4. Batch operations across multiple stages

---

**Status:** ✅ Complete and Ready for Testing
**Date:** November 12, 2025

