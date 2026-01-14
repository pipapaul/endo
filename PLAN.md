# Plan: Add "Stimmung" (Mood) Module

## Overview
Add a new daily check-in module called "Stimmung" (Mood) positioned right below "Darm & Blase". The module will track overall daily mood using a scientifically validated 4-point scale with emoji indicators. Mood data will be visualized in the main chart with color coding (red to green) and included in tooltips.

## Scientific Approach
Use a simplified 4-point mood scale based on validated affect measures:
1. **Sehr schlecht** (Very bad) - Major negative affect
2. **Eher schlecht** (Rather bad) - Mild negative affect
3. **Eher gut** (Rather good) - Mild positive affect
4. **Sehr gut** (Very good) - Major positive affect

This 4-point scale avoids neutral midpoint bias and aligns with validated single-item mood measures used in experience sampling methodology (ESM).

## Implementation Steps

### 1. Update Types (`lib/types.ts`)
Add `mood` field to `DailyEntry` interface:
```typescript
mood?: 1 | 2 | 3 | 4;  // 1=sehr schlecht, 2=eher schlecht, 3=eher gut, 4=sehr gut
```

Note: Using simple numeric scale (1-4) rather than a nested optional module structure since this is a single-field entry that should be always visible (not feature-flagged).

### 2. Update Terms (`lib/terms.ts`)
Add mood term definition:
```typescript
mood: {
  label: "Stimmung",
  tech: "Affect/Mood Rating",
  help: "Wie war deine Stimmung heute insgesamt?",
},
```

### 3. Add Daily Category (`app/page.tsx`)
- Add `"mood"` to `DailyCategoryId` type
- Add to `DAILY_CATEGORY_KEYS` array (after `bowelBladder`)
- Add color scheme to `CATEGORY_COLORS`:
  ```typescript
  mood: { saturated: "#10b981", pastel: "#ecfdf5", border: "rgba(16, 185, 129, 0.25)" },
  ```
- Add to `TRACKED_DAILY_CATEGORY_IDS`

### 4. Create Mood UI Section (`app/page.tsx`)
Position after "Darm & Blase" section. Use 4 selectable buttons with emojis:
- 1: Very sad emoji + "Sehr schlecht"
- 2: Slightly sad emoji + "Eher schlecht"
- 3: Slightly happy emoji + "Eher gut"
- 4: Very happy emoji + "Sehr gut"

### 5. Update Chart Data Structure
Add `mood` field to `CycleOverviewPoint` type for chart visualization.

### 6. Update Chart Visualization
- Add a mood indicator dot/bar in the prediction row area
- Color coding: 1=red, 2=orange, 3=light green, 4=green
- Small colored dot below baseline similar to other prediction indicators

### 7. Update Tooltip
Add mood display to the chart tooltip showing:
- Mood emoji
- Mood label (e.g., "Eher gut")

### 8. Update Data Handling
- Update `selectDailyDate` to preserve mood when loading entries
- Update `handleDailySubmit` to save mood value
- Update normalization if needed

### 9. Weekly/Monthly Integration (Future Enhancement)
- Calculate average mood per week for weekly stats
- Could correlate mood with cycle phase in Zeit-Korrelation chart
- Consider adding mood trend to weekly report summary

## Files to Modify
1. `lib/types.ts` - Add mood to DailyEntry
2. `lib/terms.ts` - Add mood term
3. `app/page.tsx` - Main implementation:
   - Category types and colors
   - UI section
   - Chart data and visualization
   - Tooltip
   - Form handling

## UI Design
```
┌─────────────────────────────────────────┐
│ Stimmung                                │
│ Wie war deine Stimmung heute insgesamt? │
│                                         │
│  [Sehr schlecht]  [Eher schlecht]      │
│                                        │
│  [Eher gut]       [Sehr gut]           │
│                                         │
└─────────────────────────────────────────┘
```

Each button shows emoji prominently with label below.

## Chart Visualization
Small colored circle in the prediction row:
- Position: Below baseline at y=-1.1 (same as other prediction dots)
- Size: r=3 (similar to fertile window dots)
- Colors:
  - 1 (sehr schlecht): #ef4444 (red)
  - 2 (eher schlecht): #f97316 (orange)
  - 3 (eher gut): #84cc16 (lime)
  - 4 (sehr gut): #22c55e (green)
