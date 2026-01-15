# Daily Check-in UX Improvement Plan

## Current Pain Points

### 1. Navigation Friction
- **Problem**: User enters a category (e.g., "Stimmung") and must click "Zurück" button in the header to return to overview
- **Issue**: Back button is at top, content is in middle/bottom - requires scrolling or reaching up
- **Issue**: No clear "done" action when finishing a category

### 2. Save/Revert Confusion
- **Problem**: Save button ("Tagesdaten speichern") only visible in overview, not in individual categories
- **Problem**: When leaving a category with changes, a modal asks "Speichern oder verwerfen?" - confusing because user might not realize they need to save
- **Problem**: The global save in overview saves ALL categories at once, but user edited only one category
- **Problem**: "Wiederhergestellt" and status messages scattered, not always visible

### 3. Mental Model Mismatch
- **Problem**: User thinks: "I filled out mood, I'm done with mood" - but data isn't saved until they go back to overview AND click save
- **Problem**: Categories feel like separate forms, but they share a single save action

---

## Proposed Solutions

### Option A: Sticky Bottom Action Bar (Recommended)

Add a persistent bottom bar that shows current state and provides context-aware actions.

**In Category View:**
```
┌─────────────────────────────────────────────┐
│  [Verwerfen]        ●        [Fertig ✓]     │
└─────────────────────────────────────────────┘
```
- "Fertig" saves the current category and returns to overview
- Dot indicator shows unsaved changes (amber) or saved (green)
- "Verwerfen" discards and returns to overview

**In Overview:**
```
┌─────────────────────────────────────────────┐
│  3 Bereiche ausgefüllt    [Tag speichern]   │
└─────────────────────────────────────────────┘
```
- Shows count of categories with data
- Clear primary action to save everything

**Benefits:**
- Always visible, no scrolling needed
- Thumb-friendly on mobile (bottom of screen)
- Clear state indication
- Reduces clicks: one tap to finish category

---

### Option B: Auto-Save with Visual Feedback

- Auto-save changes after short delay (1-2 seconds of inactivity)
- Show persistent toast/indicator: "Gespeichert ✓" or "Speichert..."
- Remove explicit save buttons entirely
- Back button just navigates, no confirmation needed

**Benefits:**
- Zero friction - just enter data and leave
- Modern UX pattern (like Google Docs)
- No lost data

**Drawbacks:**
- Users might accidentally save unwanted data
- Need to add undo functionality
- More complex state management

---

### Option C: Per-Category Save Buttons

Add a "Speichern & Zurück" button at the bottom of each category section.

**Benefits:**
- Simple to implement
- Clear action per category

**Drawbacks:**
- Still requires scrolling in long categories
- Doesn't solve overview save confusion

---

### Option D: Swipe/Carousel Navigation

- Swipe left/right to navigate between categories
- Bottom dots indicate position (like onboarding flows)
- Auto-advance to next category after selection (for simple inputs like mood)

**Benefits:**
- Very fast for quick check-ins
- Gamified, engaging feel
- Natural flow through all categories

**Drawbacks:**
- Major UX redesign
- May not work well for complex categories (pain with body map)
- Forces linear navigation

---

## Recommendation

**Implement Option A (Sticky Bottom Bar)** with these specifics:

### Design Details

1. **Sticky bar height**: 60px + safe-area-inset-bottom for iOS
2. **Visual design**: White/rose-50 background, subtle top border, slight shadow
3. **State indicator**: Small colored dot or text showing status

### In Category View:
```
┌───────────────────────────────────────────────────┐
│                                                   │
│  [Verwerfen]                      [Fertig ✓]      │
│                                                   │
└───────────────────────────────────────────────────┘
```
- Left: "Verwerfen" (ghost/outline button) - discards changes, returns to overview
- Right: "Fertig" (primary button) - saves & returns to overview
- If no changes: Only show "Zurück zur Übersicht" centered

### In Overview:
```
┌───────────────────────────────────────────────────┐
│                                                   │
│  ● 3 Bereiche            [Tag speichern]          │
│                                                   │
└───────────────────────────────────────────────────┘
```
- Left: Status text showing how many categories have data
- Right: Primary save button (disabled if nothing to save)
- Green dot if already saved for today, amber if unsaved changes

### Behavior Changes:
1. **"Fertig" button**: Saves current category AND returns to overview (one tap)
2. **Remove confirmation modal**: The sticky bar makes state obvious
3. **Header back button**: Pure navigation (no prompts), goes to overview
4. **Auto-scroll**: When entering a category, scroll to top

### Quick Wins to Include:
- Haptic feedback on save (mobile)
- Success animation/toast when saving
- Keyboard shortcuts for power users (Cmd+S to save, Esc to go back)

---

## Implementation Steps

1. Create `DailyActionBar` component with context-aware rendering
2. Add fixed positioning at bottom of daily check-in view
3. Add padding-bottom to content area to prevent overlap
4. Update save logic to work from within categories
5. Simplify/remove confirmation dialogs
6. Update back button to be purely navigational
7. Add safe-area-inset support for iOS notch/home indicator
8. Test thoroughly on mobile viewports

---

## Technical Notes

```tsx
// Component structure
const DailyActionBar = () => {
  const isInCategory = dailyActiveCategory !== "overview";
  const hasUnsavedChanges = isDailyDirty;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-rose-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between px-4 py-3">
        {isInCategory ? (
          <>
            <Button variant="ghost" onClick={handleDiscard}>Verwerfen</Button>
            <Button onClick={handleFinishCategory}>Fertig</Button>
          </>
        ) : (
          <>
            <span className="text-sm text-rose-600">
              {completedCount} Bereiche ausgefüllt
            </span>
            <Button onClick={handleDailySubmit} disabled={!hasUnsavedChanges}>
              Tag speichern
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
```

---

## Alternative: Hybrid Approach

Combine Option A with elements of Option D:

1. Sticky bottom bar (always visible)
2. Add category navigation arrows in the bar: `[←] Fertig [→]`
3. Arrows navigate to prev/next category
4. "Fertig" saves current and returns to overview
5. Visual indicator shows which categories are complete

This allows both quick sequential entry AND random access via overview.
