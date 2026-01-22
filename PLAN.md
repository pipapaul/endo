# Daily Check-in Wizard Mode Implementation Plan

## Overview

Add an alternative "Wizard Mode" for the daily check-in that guides users through simple questions for each module sequentially. This complements the existing overview-based entry system.

---

## User Flow

### Entry Point
- New button below the existing "Täglicher Check-in" button on home screen
- Label: "Schnell-Check" or "Geführter Check-in"
- Distinct visual style (outline/secondary) to differentiate from main button

### Wizard Flow
```
[Start] → Pain → Symptoms → Bleeding → Medication → Sleep → Bowel/Bladder → Mood → Notes → [Summary/Done]
```

- Each step shows a simple question with clear answer options
- Skip option always available ("Überspringen" or "Keine Angabe")
- Progress indicator at top (e.g., "3 von 8" or dots)
- Back navigation to previous question

### Modules Included (Core Only)
1. **Pain** - "Hattest du heute Schmerzen?"
2. **Symptoms** - "Hattest du heute Symptome?"
3. **Bleeding** - "Hattest du heute eine Blutung?"
4. **Medication** - "Hast du heute Medikamente genommen?"
5. **Sleep** - "Wie hast du geschlafen?"
6. **Bowel/Bladder** - "Wie war dein Verdauung heute?"
7. **Mood** - "Wie war deine Stimmung heute?"
8. **Notes** - "Möchtest du Notizen oder Tags hinzufügen?"

### Excluded from Wizard
- **Optional Values** - Too specialized, users can add via normal check-in
- **Cervix Mucus** - Only for Billings method users, can add via normal check-in

---

## Integration with Existing Data

### Quick Tracker Awareness
The wizard should detect and acknowledge existing data from quick trackers:

**Pain (quickPainEvents)**:
```
"Du hast heute bereits [N] Schmerzereignis(se) erfasst:
 • [Region] - Intensität [X]/10
 • [Region] - Intensität [Y]/10

Möchtest du weitere Schmerzen hinzufügen oder ist das alles für heute?"

[Weitere hinzufügen] [Das ist alles] [Überspringen]
```

**Bleeding (pbacCounts)**:
```
"Du hast heute bereits Blutungsdaten erfasst:
 • [N] × [Produkt]

Möchtest du weitere Produkte hinzufügen oder ist das alles?"

[Weitere hinzufügen] [Das ist alles] [Überspringen]
```

### Pre-filled Data Detection
For each module, check if data already exists in `dailyDraft`:
- If yes: Show summary and ask "Möchtest du das ändern?"
- If no: Show the question normally

---

## Question Design per Module

### 1. Pain Module
**Initial Question**: "Hattest du heute Schmerzen?"
- [Ja] → Goes to pain detail entry (simplified body map + intensity)
- [Nein] → Triggers `handleQuickNoPain()` equivalent, moves to next
- [Überspringen] → Moves to next without recording

**If existing quickPainEvents**:
- Show summary of existing events
- [Weitere hinzufügen] → Pain detail entry
- [Das ist alles] → Mark complete, next
- [Überspringen] → Next without changes

**Detail Entry** (if "Ja"):
- Simplified body region picker (main regions only)
- Intensity slider (0-10)
- Optional: Pain qualities (checkboxes)
- [Fertig] → Save and next

### 2. Symptoms Module
**Question**: "Hattest du heute eines dieser Symptome?"
- Show toggleable list of main symptoms:
  - Müdigkeit/Erschöpfung
  - Blähungen
  - Übelkeit
  - Dysmenorrhoe
  - Beckenschmerzen
- [Keine Symptome] → Triggers quick action, next
- [Fertig] → Save selections, next
- [Überspringen] → Next

### 3. Bleeding Module
**Initial Question**: "Hattest du heute eine Blutung?"
- [Ja] → Simple intensity picker
- [Nein] → Triggers `handleQuickNoBleeding()` equivalent, next
- [Überspringen] → Next

**If existing pbacCounts**:
- Show summary: "Du hast X Produkte erfasst"
- [Mehr hinzufügen] → Product picker
- [Das ist alles] → Next
- [Überspringen] → Next

**Detail Entry** (if "Ja"):
- Simple intensity: Leicht / Mittel / Stark
- Or product-based if user prefers PBAC

### 4. Medication Module
**Question**: "Hast du heute Schmerzmittel oder andere Medikamente genommen?"
- [Ja] → Medication entry (simplified)
- [Nein] → Triggers quick action, next
- [Überspringen] → Next

**Detail Entry**:
- Quick select from recent/common medications
- Dosage input
- [Fertig] → Save and next

### 5. Sleep Module
**Question**: "Wie hast du letzte Nacht geschlafen?"
- Visual scale or emoji picker:
  - 😫 Sehr schlecht
  - 😕 Schlecht
  - 😐 Okay
  - 🙂 Gut
  - 😴 Sehr gut
- Optional: Hours input
- [Überspringen] → Next

### 6. Bowel/Bladder Module
**Question**: "Hattest du heute Verdauungsbeschwerden?"
- [Ja] → Detail entry
- [Nein] → Mark normal, next
- [Überspringen] → Next

**Detail Entry**:
- Bristol scale visual picker (optional)
- Common issues: Durchfall, Verstopfung, Blähungen, Krämpfe

### 7. Mood Module
**Question**: "Wie war deine Stimmung heute?"
- 4 emoji buttons (existing UI):
  - 😢 Sehr schlecht (1)
  - 😕 Schlecht (2)
  - 🙂 Gut (3)
  - 😊 Sehr gut (4)
- [Überspringen] → Next

### 8. Notes Module
**Question**: "Möchtest du Notizen oder Tags hinzufügen?"
- [Ja] → Tag picker + text input
- [Nein] → Next/Finish
- [Überspringen] → Finish

---

## UI/UX Design

### Wizard Container
```tsx
<div className="fixed inset-0 z-50 bg-white flex flex-col">
  {/* Header with progress */}
  <header className="px-4 py-3 border-b">
    <div className="flex items-center justify-between">
      <Button variant="ghost" onClick={handleBack}>
        <ChevronLeft /> Zurück
      </Button>
      <span className="text-sm text-rose-600">
        {currentStep} von {totalSteps}
      </span>
      <Button variant="ghost" onClick={handleClose}>
        Abbrechen
      </Button>
    </div>
    {/* Progress bar */}
    <div className="mt-2 h-1 bg-rose-100 rounded-full">
      <div
        className="h-full bg-rose-500 rounded-full transition-all"
        style={{ width: `${(currentStep / totalSteps) * 100}%` }}
      />
    </div>
  </header>

  {/* Question content */}
  <main className="flex-1 overflow-auto p-4">
    {/* Current step content */}
  </main>

  {/* Bottom actions */}
  <footer className="px-4 py-3 border-t bg-white">
    {/* Context-aware buttons */}
  </footer>
</div>
```

### Visual Style
- Clean, minimal design
- Large touch targets
- Clear visual hierarchy
- Consistent button placement
- Smooth transitions between steps

### Progress Indicator Options
1. **Numbered**: "3 von 8"
2. **Dots**: ○ ○ ● ○ ○ ○ ○ ○
3. **Bar**: Progress bar (recommended)
4. **Icons**: Category icons showing completion state

---

## State Management

### Wizard State
```tsx
interface WizardState {
  isOpen: boolean;
  currentStep: number;
  completedSteps: Set<number>;
  skippedSteps: Set<number>;
}

const [wizardState, setWizardState] = useState<WizardState>({
  isOpen: false,
  currentStep: 0,
  completedSteps: new Set(),
  skippedSteps: new Set(),
});
```

### Step Configuration
```tsx
const WIZARD_STEPS = [
  { id: "pain", title: "Schmerzen", question: "Hattest du heute Schmerzen?" },
  { id: "symptoms", title: "Symptome", question: "Hattest du heute Symptome?" },
  { id: "bleeding", title: "Blutung", question: "Hattest du heute eine Blutung?" },
  { id: "medication", title: "Medikamente", question: "Hast du Medikamente genommen?" },
  { id: "sleep", title: "Schlaf", question: "Wie hast du geschlafen?" },
  { id: "bowelBladder", title: "Verdauung", question: "Wie war deine Verdauung?" },
  { id: "mood", title: "Stimmung", question: "Wie war deine Stimmung?" },
  { id: "notes", title: "Notizen", question: "Möchtest du Notizen hinzufügen?" },
] as const;
```

### Data Flow
1. Wizard opens → Load current `dailyDraft` for selected date
2. Each step → Update `dailyDraft` via existing `setDailyDraft()`
3. Data persists automatically (existing localStorage mechanism)
4. Wizard close → Data already saved, mark categories complete

---

## Implementation Steps

### Phase 1: Core Wizard Infrastructure
1. Create `DailyWizard` component with step navigation
2. Add wizard state management
3. Create step container with progress indicator
4. Add open/close handlers
5. Add "Schnell-Check" button to home screen

### Phase 2: Individual Step Components
6. Create `WizardStepPain` with existing data detection
7. Create `WizardStepSymptoms` with toggle list
8. Create `WizardStepBleeding` with quick tracker awareness
9. Create `WizardStepMedication` with medication picker
10. Create `WizardStepSleep` with quality scale
11. Create `WizardStepBowelBladder` with Bristol picker
12. Create `WizardStepMood` with emoji buttons
13. Create `WizardStepNotes` with tags/text

### Phase 3: Integration & Polish
14. Integrate with existing `dailyDraft` updates
15. Add transition animations between steps
16. Add haptic feedback (mobile)
17. Test existing data detection for all quick trackers
18. Add summary screen at end (optional)

### Phase 4: Edge Cases
19. Handle date changes during wizard
20. Handle external data updates (if app is open elsewhere)
21. Test with various feature flag combinations
22. Accessibility audit (keyboard nav, screen readers)

---

## Component Structure

```
components/
  daily-wizard/
    DailyWizard.tsx           # Main wizard container
    WizardProgress.tsx        # Progress bar/indicator
    WizardStep.tsx            # Generic step wrapper
    steps/
      WizardStepPain.tsx
      WizardStepSymptoms.tsx
      WizardStepBleeding.tsx
      WizardStepMedication.tsx
      WizardStepSleep.tsx
      WizardStepBowelBladder.tsx
      WizardStepMood.tsx
      WizardStepNotes.tsx
```

Or integrate directly in `app/page.tsx` if preferred for consistency with existing code.

---

## Open Questions

1. **Summary Screen**: Show a summary of all entered data at the end before closing?
   - Pro: User can review everything
   - Con: Extra step, might feel redundant

2. **Edit from Summary**: Allow jumping back to specific steps from summary?
   - Pro: Easy corrections
   - Con: More complex navigation

3. **Auto-advance**: Automatically move to next step after selection (like mood)?
   - Pro: Faster for simple inputs
   - Con: Might feel rushed, harder to correct

4. **Partial Completion**: What if user closes wizard midway?
   - Data is already saved via dailyDraft auto-persistence
   - Categories with data will show as partially complete

5. **Daily vs. Wizard Mode Preference**: Remember user's preferred mode?
   - Could store in settings
   - Or just offer both buttons always

---

## Estimated Scope

- **Core wizard infrastructure**: ~200 lines
- **8 step components**: ~100 lines each = ~800 lines
- **Integration & state**: ~150 lines
- **Total new code**: ~1,150 lines

This can be implemented incrementally, starting with the infrastructure and 2-3 core steps, then adding remaining steps.
