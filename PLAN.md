# Daily Check-in & Wizard Parity Plan

## Goal
Ensure the wizard and daily check-in collect **identical data** while improving UX in both. The wizard should be a faster path to the same data, not a shortcut that records less.

## Critical Principle: Scientific Integrity & Terminology Consistency

**The wizard must NEVER dilute medical data quality.**

- Scales must match validated instruments (Bristol scale 1-7, NRS 0-10, PBAC scoring)
- Data fields must map 1:1 to daily check-in — no "simplified" versions that lose precision
- If the daily check-in uses a validated scale, the wizard must use the same scale
- User-facing simplifications (emojis, visual pickers) must map to correct underlying values

**Wizard and Daily Check-in MUST use identical terminology.**

- If daily check-in says "Schmerzen beim Stuhlgang", wizard must say "Schmerzen beim Stuhlgang" (not "Kloschmerzen")
- If daily check-in says "Vermuteter Eisprungschmerz", wizard must say "Vermuteter Eisprungschmerz"
- Labels CAN be user-friendly German (not Latin/medical jargon) — but must be **identical** in both views
- All labels should come from shared `TERMS` constants to guarantee consistency
- When adding new UI elements, always check what label the daily check-in uses first

**Why this matters:** Users may share this data with healthcare providers. Inconsistent terminology confuses users and undermines data quality.

---

## Current Gaps (Wizard Missing Data)

### 1. Pain Module
| Field | Daily Check-in | Wizard | Action |
|-------|---------------|--------|--------|
| painRegions (regionId, nrs, qualities) | ✅ | ✅ | Parity ✓ |
| impactNRS (overall impact 0-10) | ✅ | ❌ | Add to wizard |
| ovulationPain (side, intensity) | ✅ | ❌ | Add optional question |
| deepDyspareunia | ✅ (in pain section) | ⚠️ (in symptoms) | Move to symptoms in both |

### 2. Symptoms Module
| Field | Daily Check-in | Wizard | Action |
|-------|---------------|--------|--------|
| fatigue, bloating | ✅ Base | ✅ | Keep |
| dysmenorrhea, pelvicPainNonMenses, dyschezia, deepDyspareunia, dysuria | ⚠️ Separate modules | ✅ | Consolidate in daily check-in |
| dizzinessOpt (present, nrs, orthostatic) | ✅ Feature-gated | ❌ | Add to wizard if flag active |

### 3. Bleeding Module
| Field | Daily Check-in | Wizard | Action |
|-------|---------------|--------|--------|
| simpleBleedingIntensity | ✅ | ✅ | Parity ✓ |
| clots, flooding | ✅ | ✅ | Parity ✓ |
| PBAC product tracking | ✅ | ❌ | **Do not add** - too complex for wizard |

**Decision**: Wizard uses simple intensity mode. Users needing PBAC tracking use daily check-in. This is acceptable.

### 4. Medication Module
| Field | Daily Check-in | Wizard | Action |
|-------|---------------|--------|--------|
| name | ✅ | ✅ | Parity ✓ |
| doseMg | ✅ | ❌ | Add optional field |
| time | ✅ | ❌ | Add optional field |

### 5. Sleep Module
| Field | Daily Check-in | Wizard | Action |
|-------|---------------|--------|--------|
| quality (0-10 in check-in, 1-5 emoji in wizard) | ⚠️ Different scales | ⚠️ | Unify to same scale |
| hours | ✅ | ❌ | Add to wizard |
| awakenings | ✅ | ❌ | Add to wizard |

### 6. Bowel/Bladder Module
| Field | Daily Check-in | Wizard | Action |
|-------|---------------|--------|--------|
| Bristol type (1-7 dropdown) | ✅ All 7 | ⚠️ Only 1,4,6 | **Fix wizard to use full scale** |
| urinary.freqPerDay | ✅ | ❌ | Add optional |
| urinary.urgency | ✅ | ❌ | Add optional |
| dyschezia (present, score) | ✅ | ⚠️ In symptoms | Keep in symptoms for both |
| dysuria (present, score) | ✅ | ⚠️ In symptoms | Keep in symptoms for both |

### 7. Mood Module
- **Already at parity** - both use 1-4 scale

### 8. Notes Module
| Field | Daily Check-in | Wizard | Action |
|-------|---------------|--------|--------|
| notesTags | ✅ Custom only | ✅ Preset + custom | Add presets to daily check-in |
| notesFree | ✅ | ✅ | Parity ✓ |

---

## UX Improvements for Daily Check-in

### Sleep Module (Currently Cluttered)

**Current Issues:**
- Three separate input fields in a grid layout
- 0-10 slider for quality is granular but not intuitive
- No visual feedback for sleep quality level

**Proposed Improvements:**
```
┌─────────────────────────────────────────┐
│ Schlafqualität                          │
│                                         │
│   😫    😕    😐    🙂    😴           │
│  Sehr  Schlecht Okay  Gut  Sehr        │
│ schlecht              gut              │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ Stunden geschlafen                      │
│ [  7.5  ] ◀─────●─────▶                │
│           0           12               │
│                                         │
│ Aufgewacht in der Nacht                 │
│ [  -  ] 0 [ + ]    oder [ Nie ]        │
│                                         │
└─────────────────────────────────────────┘
```

- **Replace 0-10 slider** with 5-level emoji picker (matches wizard)
- **Map to values**: 1=2, 2=4, 3=6, 4=8, 5=10 for data compatibility
- **Hours**: Keep slider but with cleaner visual
- **Awakenings**: Use stepper buttons or quick "Nie" option

### Bowel/Bladder Module (Currently Cluttered)

**Current Issues:**
- Bristol scale dropdown with 7 technical options is intimidating
- Multiple sub-sections for GI, urinary, optional urinary
- Too many inputs visible at once

**Proposed Improvements:**
```
┌─────────────────────────────────────────┐
│ Stuhlgang heute?                        │
│                                         │
│   ○ Ja    ○ Nein                        │
│                                         │
│ [If Ja:]                                │
│ Wie war die Konsistenz?                 │
│                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │ 💎       │ │ 🥜       │ │ 🌭       │  │
│ │ Hart     │ │ Klumpig  │ │ Wurstform│  │
│ │ (1-2)    │ │ (3)      │ │ Normal   │  │
│ │          │ │          │ │ (4)      │  │
│ └──────────┘ └──────────┘ └──────────┘  │
│                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │ 🧈       │ │ 💧       │ │ 🌊       │  │
│ │ Weich    │ │ Breiig   │ │ Flüssig  │  │
│ │ (5)      │ │ (6)      │ │ (7)      │  │
│ └──────────┘ └──────────┘ └──────────┘  │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ Schmerzen beim Stuhlgang?               │
│   [ ] Ja  → Stärke: ●────────── 5/10    │
│                                         │
│ ─────────────────────────────────────── │
│                                         │
│ Blase & Wasserlassen      [Optional ▼]  │
│   [Collapsed by default, expand for     │
│    frequency, urgency, etc.]            │
│                                         │
└─────────────────────────────────────────┘
```

- **Visual Bristol scale**: Replace dropdown with visual card selection
- **Group into 3 categories**: Hart/Klumpig (1-3), Normal (4), Weich/Breiig/Flüssig (5-7)
- **Question-based flow**: "Stuhlgang heute?" → "Wie war die Konsistenz?"
- **Collapsible urinary section**: Most users don't need detailed urinary tracking

---

## Implementation Plan

### Phase 1: Unify Data Collection (Wizard → Daily Check-in Parity)

#### 1.1 Sleep Module - Unify Scale
- Change daily check-in from 0-10 slider to 1-5 emoji picker
- Store as quality value 1-5 (breaking change or map to 0-10?)
- Add hours and awakenings to wizard

#### 1.2 Bowel/Bladder - Full Bristol in Wizard
- Replace wizard's 3-option (1,4,6) with full 7-type visual picker
- Use same visual picker in daily check-in

#### 1.3 Medication - Add Dose/Time to Wizard
- Add optional "Dosis" and "Uhrzeit" fields after medication selection
- Make them skippable (user can just tap "Fertig")

#### 1.4 Pain - Add Impact to Wizard
- After adding pain entries, ask: "Wie stark beeinträchtigen dich die Schmerzen heute?"
- Add impactNRS slider (0-10)

### Phase 2: UX Improvements (Both Modules)

#### 2.1 Sleep Module Redesign
- Implement emoji picker for both
- Add visual slider for hours
- Add stepper for awakenings with "Nie" quick option

#### 2.2 Bowel/Bladder Redesign
- Create visual Bristol scale component
- Reorganize into question-based flow
- Make urinary section collapsible

#### 2.3 Notes - Add Presets to Daily Check-in
- Add same preset tags as wizard to daily check-in
- Keep ability to add custom tags

### Phase 3: Symptom Consolidation

#### 3.1 Consolidate Symptoms
- Move all symptom tracking to symptoms module
- Same symptom list in wizard and daily check-in:
  - fatigue, bloating, dysmenorrhea, pelvicPainNonMenses, dyschezia, deepDyspareunia, dysuria
- Add dizziness if feature flag active
- Each with present toggle + score slider

---

## Data Compatibility Considerations

### Sleep Quality Scale Change
**Option A**: Map 5-level to 0-10
- 1 (Sehr schlecht) → 2
- 2 (Schlecht) → 4
- 3 (Okay) → 6
- 4 (Gut) → 8
- 5 (Sehr gut) → 10

**Option B**: Change data model to 1-5
- Requires migration of existing data
- Cleaner going forward

**Recommendation**: Option A (mapping) - maintains backward compatibility

### Bristol Scale
No change needed - full 1-7 scale in both, just better UI

---

## Summary of Changes

### Wizard Additions (to match daily check-in)
1. ✅ Pain: Add impactNRS question after pain entries
2. ✅ Sleep: Add hours and awakenings inputs
3. ✅ Bowel/Bladder: Full 7-type Bristol scale
4. ✅ Medication: Add optional dose and time fields
5. ✅ Dizziness: Add if feature flag active (in symptoms step)

### Daily Check-in Improvements
1. ✅ Sleep: Replace 0-10 slider with emoji picker, cleaner layout
2. ✅ Bowel/Bladder: Visual Bristol scale, question-based flow, collapsible urinary
3. ✅ Notes: Add preset quick-tags like wizard
4. ✅ Symptoms: Consolidate all symptom tracking in one place

### Unchanged (Already at Parity)
- Mood module
- Bleeding simple mode (PBAC stays daily check-in only)
- Pain region/intensity/qualities

---

## Files Modified
- `app/page.tsx` - Main component with both wizard and daily check-in
  - Integrated BristolScalePicker and SleepQualityPicker components
  - Added preset quick-tags to daily check-in notes section
  - Added dizziness to wizard symptoms step (when feature flag active)
- Created new components:
  - `components/home/BristolScalePicker.tsx` - Visual 7-type Bristol scale with categories
  - `components/home/SleepQualityPicker.tsx` - 5-level emoji picker with 0-10 scale mapping

---

## Phase 4: Remaining Parity Gaps

### 4.1 Pain Module - Add Ovulation Pain (Mittelschmerz)

**Current State:**
- Daily check-in: Has "Vermuteter Eisprungschmerz" (Mittelschmerz) card with side selection (links/rechts/beidseitig/unsicher) + intensity slider (NRS 0-10)
- Wizard: Missing entirely

**Implementation:**
- Add ovulation pain question in wizard's pain step (after deepDyspareunia toggle)
- Use exact label from daily check-in: "Vermuteter Eisprungschmerz"
- UI: Side selection buttons + NRS intensity slider (0-10)
- Fields: `ovulationPain.side` + `ovulationPain.intensity`
- Must use `OVULATION_PAIN_SIDES` constant for consistent options

### 4.2 Bleeding Module - Use Settings-Based Tracking Method

**Current State:**
- Daily check-in: Respects `productSettings.trackingMethod` (simple | pbac_classic | pbac_extended)
- Wizard: Hardcoded to simple mode only

**Problem:** User selects extended PBAC in settings but wizard only offers simple intensity selection.

**Implementation:**
1. Read `productSettings.trackingMethod` in wizard
2. For `simple` mode: Keep current UI (intensity selection with `SIMPLE_BLEEDING_INTENSITIES`)
3. For `pbac_classic` mode: Show product counter UI (tampons, pads with fill levels)
4. For `pbac_extended` mode: Show ExtendedBleedingEntryForm component

**Scientific Accuracy:**
- PBAC (Pictorial Blood Loss Assessment Chart) is a validated instrument
- Simple mode maps to PBAC-equivalent scores via `getSimpleBleedingPbacEquivalent()`
- Classic/Extended modes use actual PBAC product scoring
- All modes must produce comparable `pbacScore` values for analytics
- Labels must match `SIMPLE_BLEEDING_INTENSITIES` definitions exactly (e.g., "Sehr schwach", "Schwach", "Mittel", "Stark", "Sehr stark")

### 4.3 Medication Module - Share Med List

**Current State:**
- Daily check-in: Uses `rescueMedOptions` = `STANDARD_RESCUE_MEDS` + `customRescueMeds`
  - STANDARD_RESCUE_MEDS: ["Ibuprofen", "Paracetamol", "Naproxen", "Buscopan", "Novalgin", "Triptan"]
- Wizard: Hardcoded `commonMeds` = ["Ibuprofen", "Paracetamol", "Naproxen", "Buscopan", "Aspirin"]

**Problems:**
1. Different default meds (wizard has Aspirin, missing Novalgin/Triptan)
2. Custom meds added in daily check-in don't appear in wizard

**Implementation:**
1. Replace wizard's `commonMeds` with `rescueMedOptions` (shared list)
2. When user adds custom med in wizard, also add to `customRescueMeds` state
3. Both views show identical medication options

### 4.4 Bowel/Bladder Module - Add Urinary Fields

**Current State:**
- Daily check-in has:
  - `urinary.freqPerDay` - Miktionsfrequenz (number of voids per day)
  - `urinary.urgency` - Harndrang score (NRS 0-10)
  - "Dranginkontinenz" toggle (`moduleUrinary` feature flag) enabling:
    - `urinaryOpt.leaksCount` - Inkontinenzepisoden
    - `urinaryOpt.padsCount` - Vorlagenverbrauch
    - `urinaryOpt.nocturia` - Nykturie (nighttime voids)
- Wizard: Only has Bristol scale, dyschezia, dysuria (missing all urinary fields)

**Implementation:**
1. Add Miktionsfrequenz input (number field, label from `TERMS.urinary_freq`)
2. Add Harndrang slider (NRS 0-10, label from `TERMS.urinary_urgency`)
3. If `featureFlags.moduleUrinary` active, show Dranginkontinenz section:
   - Use exact labels from `MODULE_TERMS.urinaryOpt.*`
   - Leaks count, pads count, nocturia inputs

**Scientific Accuracy:**
- Use standardized urological terminology (Miktionsfrequenz, Nykturie, Dranginkontinenz)
- NRS 0-10 scale for subjective urgency rating
- All labels must match `TERMS` and `MODULE_TERMS` constants

---

## Implementation Checklist - Phase 4

**Remember:** Always use labels from `TERMS` / `MODULE_TERMS` constants — never hardcode strings!

### 4.1 Ovulation Pain in Wizard
- [ ] Add ovulation pain UI after deepDyspareunia in pain step
- [ ] Use label: `TERMS.ovulationPain.label` ("Vermuteter Eisprungschmerz")
- [ ] Side selection using `OVULATION_PAIN_SIDES` and `OVULATION_PAIN_SIDE_LABELS`
- [ ] Intensity slider (NRS 0-10)

### 4.2 Bleeding Method Parity
- [ ] Read `productSettings.trackingMethod` in wizard bleeding step
- [ ] Conditional rendering based on tracking method
- [ ] For simple: Use `SIMPLE_BLEEDING_INTENSITIES` (labels: "Sehr schwach", "Schwach", etc.)
- [ ] For pbac_classic: Add product counting UI (tampon/pad with fill levels)
- [ ] For pbac_extended: Integrate `ExtendedBleedingEntryForm` component

### 4.3 Shared Medication List
- [ ] Replace wizard `commonMeds` with `rescueMedOptions`
- [ ] When custom med added in wizard, call `setCustomRescueMeds` to persist
- [ ] Verify both views show same meds

### 4.4 Urinary Fields in Wizard
- [ ] Add urinary frequency input using `TERMS.urinary_freq.label`
- [ ] Add urinary urgency slider using `TERMS.urinary_urgency.label` (NRS 0-10)
- [ ] If `featureFlags.moduleUrinary` active:
  - [ ] Use labels from `MODULE_TERMS.urinaryOpt.*`
  - [ ] Add leaks count input
  - [ ] Add pads count input
  - [ ] Add nocturia input
