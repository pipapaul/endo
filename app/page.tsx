"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, ComponentType, ReactNode, SVGProps } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  Cell,
  Area,
  ComposedChart,
  ScatterChart,
  Scatter,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import type { DotProps, TooltipProps, TooltipContentProps } from "recharts";
import {
  AlertTriangle,
  Activity,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Flame,
  HardDrive,
  Home,
  Minus,
  Pill,
  Plus,
  CheckCircle2,
  Settings,
  ShieldCheck,
  Smartphone,
  Upload,
  TrendingUp,
  X,
} from "lucide-react";
import InfoTip from "@/components/InfoTip";
import { Labeled } from "@/components/Labeled";

import {
  DailyEntry,
  FeatureFlags,
  MonthlyEntry,
  PainGranularity,
  PainTimeOfDay,
  QuickPainEvent,
} from "@/lib/types";
import { TERMS, type TermDescriptor, type TermKey } from "@/lib/terms";
import {
  hasBleedingForEntry,
  normalizeDailyEntry,
  normalizeQuickPainEvent,
} from "@/lib/dailyEntries";
import { validateDailyEntry, validateMonthlyEntry, type ValidationIssue } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/ui/back-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { SliderValueDisplay } from "@/components/ui/slider-value-display";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Checkbox from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";
import { touchLastActive, loadProductSettings, saveProductSettings } from "@/lib/persistence";
import { ProductSettings, DEFAULT_PRODUCT_SETTINGS, getProductById, FILL_LEVEL_LABELS, FREE_BLEEDING_INTENSITY_LABELS } from "@/lib/productSettings";
import { ProductSettingsPanel, ProductConfigPanel } from "@/components/ui/ProductSettingsPanel";
import { usePersistentState } from "@/lib/usePersistentState";
import WeeklyTabShell from "@/components/weekly/WeeklyTabShell";
import {
  BauchIcon,
  CervixMucusIcon,
  MedicationIcon,
  NotesTagsIcon,
  OptionalValuesIcon,
  PainIcon,
  PeriodIcon,
  SleepIcon,
  SymptomsIcon,
} from "@/components/icons";
import {
  listWeeklyReports,
  replaceWeeklyReports,
  type WeeklyReport,
  type PromptAnswers,
} from "@/lib/weekly/reports";
import { normalizeWpai, type WeeklyWpai } from "@/lib/weekly/wpai";
import {
  arePbacCountsEqual,
  createEmptyPbacCounts,
  PBAC_COUNT_KEYS,
  normalizePbacCounts,
  calculatePbacScore,
  aggregateExtendedPbacData,
  SIMPLE_BLEEDING_INTENSITIES,
  getSimpleBleedingPbacEquivalent,
  getSimpleBleedingIntensityDefinition,
  getTrackingMethodLabel,
  type PbacCountKey,
  type PbacCounts,
  type ExtendedBleedingEntry,
  type FreeBleedingEntry,
  type ExtendedPbacData,
  type SimpleBleedingIntensity,
  type TrackingMethod,
} from "@/lib/pbac";
import { ExtendedBleedingEntryForm } from "@/components/home/ExtendedBleedingEntry";
import {
  type ColorScheme,
  getColorSchemeName,
  getColorSchemeDescription,
  getColorSchemeSwatches,
} from "@/lib/theme";
import {
  ANALYTICS_SECTION_OPTIONS,
  BASE_PAIN_QUALITIES,
  DETAIL_TOOLBAR_FALLBACK_HEIGHT,
  HEAD_PAIN_QUALITIES,
  MIGRAINE_LABEL,
  MIGRAINE_PAIN_QUALITIES,
  MIGRAINE_QUALITY_SET,
  MIGRAINE_WITH_AURA_LABEL,
  MODULE_TERMS,
  PAIN_QUALITIES,
  SYMPTOM_TERMS,
  type AnalyticsSectionKey,
  type AnalyticsSectionOption,
  type BackupPayload,
  type BeforeInstallPromptEvent,
  type CycleAlignmentMode,
  type CycleViewMode,
  type PendingCheckIn,
  type PendingCheckInType,
  type PendingOverviewConfirm,
  type SymptomKey,
  type TrendMetricKey,
} from "@/lib/home/constants";
import {
  dateToIsoWeek,
  formatIsoWeekCompactLabel,
  monthToDate,
  parseIsoWeekKey,
} from "@/lib/home/analytics";
import {
  Section,
  SectionCompletionContext,
  SectionScopeContext,
  type SectionCompletionContextValue,
  type SectionCompletionState,
  type SectionRegistryState,
} from "@/components/home/Section";
import {
  InlineNotice,
  ModuleToggleRow,
  MultiSelectChips,
  NrsInput,
  NumberField,
  ScoreInput,
} from "@/components/home/inputs";
import { TermField, TermHeadline } from "@/components/home/terms";
import { useDailySectionCompletion } from "@/lib/useDailySectionCompletion";

const ALL_PAIN_QUALITIES: DailyEntry["painQuality"] = HEAD_PAIN_QUALITIES;

const HEAD_REGION_ID = "head";
type OvulationPainSide = Exclude<NonNullable<DailyEntry["ovulationPain"]>["side"], undefined>;

const STANDARD_RESCUE_MEDS = [
  "Ibuprofen",
  "Paracetamol",
  "Naproxen",
  "Diclofenac",
  "Buscopan",
  "Novalgin",
  "Triptan",
] as const;

const OVULATION_PAIN_SIDES: OvulationPainSide[] = [
  "links",
  "rechts",
  "beidseitig",
  "unsicher",
];
const OVULATION_PAIN_SIDE_LABELS: Record<OvulationPainSide, string> = {
  links: "Links",
  rechts: "Rechts",
  beidseitig: "Beidseitig",
  unsicher: "Unsicher",
};

const SYMPTOM_MODULE_TOGGLES: Array<{
  key: keyof FeatureFlags;
  label: string;
  term: TermDescriptor;
}> = [{ key: "moduleDizziness", label: "Schwindel", term: MODULE_TERMS.dizzinessOpt.present }];

const createInitialCycleComputationState = () => ({
  cycleDay: null as number | null,
  previousDate: null as Date | null,
  previousBleeding: false,
  lastBleedingDate: null as Date | null,
});

type CycleComputationState = ReturnType<typeof createInitialCycleComputationState>;

/**
 * Billings Method: Score cervix mucus for fertility indication
 * Based on the Billings Ovulation Method (BOM) scientific criteria:
 * - Peak mucus (slippery + egg white) indicates imminent ovulation
 * - Returns a score from 0-4, where 4 is peak fertility
 */
const scoreCervixMucusFertility = (
  mucus: DailyEntry["cervixMucus"] | undefined
): number => {
  if (!mucus) return 0;

  const observation = mucus.observation;
  const appearance = mucus.appearance;

  const isSlippery = observation === "slippery";
  const isWet = observation === "wet";
  const isMoist = observation === "moist";
  const isEggWhite = appearance === "eggWhite";
  const isCreamy = appearance === "creamy";
  const isSticky = appearance === "sticky";

  // Peak fertility: slippery sensation with egg-white appearance
  if (isSlippery && isEggWhite) return 4;

  // High fertility combinations
  if (isSlippery || isEggWhite) return 3;
  if (isWet && (isCreamy || isEggWhite)) return 3;

  // Medium fertility
  if (isWet || isCreamy) return 2;
  if (isMoist && isSticky) return 1;

  // Low fertility (dry/none/sticky)
  return 0;
};

/**
 * Identifies peak mucus days in a cycle (score >= 3)
 * The last day of peak mucus is the "Peak Day" in Billings terminology
 */
const findPeakMucusDayInCycle = (
  entries: Array<{ entry: DailyEntry; cycleDay: number | null }>,
  cycleStartDate: string
): number | null => {
  const cycleEntries = entries.filter(({ entry, cycleDay }) => {
    if (cycleDay === null || cycleDay < 1) return false;
    return entry.date >= cycleStartDate;
  });

  // Find the last day with peak mucus (score >= 3) followed by a drop
  let lastPeakDay: number | null = null;
  let previousScore = 0;

  for (const { entry, cycleDay } of cycleEntries) {
    const score = scoreCervixMucusFertility(entry.cervixMucus);
    if (score >= 3) {
      lastPeakDay = cycleDay;
    }
    // If we had peak mucus and now it dropped, we found the Peak Day
    if (previousScore >= 3 && score < 3 && lastPeakDay !== null) {
      return lastPeakDay;
    }
    previousScore = score;
  }

  return lastPeakDay;
};

/**
 * Result type for ovulation calculation
 */
type OvulationResult = {
  ovulationDay: number;
  confidence: number; // 0-100%
  method: "mucus_pain" | "mucus" | "pain" | "personal_luteal" | "standard";
  signals: {
    peakMucusDay?: number;
    ovulationPainDay?: number;
    symptomPeakDay?: number;
  };
};

/**
 * Shared cycle ovulation data - single source of truth for all ovulation calculations.
 * This data is computed once and consumed by cycleAnalysis, cycleOverview, and timeCorrelationData.
 */
type CycleOvulationData = {
  /** All cycles with computed ovulation data */
  cycles: Array<{
    startDate: string;
    endDate: string | null;
    length: number;
    isCompleted: boolean;
    ovulationDay: number;
    ovulationConfidence: number;
    ovulationMethod: OvulationResult["method"];
    entries: Array<{ cycleDay: number; entry: DailyEntry }>;
  }>;
  /** Personal luteal phase calculated from high-confidence cycles */
  personalLutealPhase: number | null;
  /** Map from cycle start date to ovulation data for quick lookup */
  cycleOvulationMap: Map<string, { ovulationDay: number; cycleStart: string; cycleEnd: string | null; confidence: number; method: OvulationResult["method"] }>;
  /** Completed cycle results for weighted predictions */
  completedCycleResults: Array<{
    cycleLength: number;
    ovulationDay: number;
    confidence: number;
    method: OvulationResult["method"];
  }>;
};

/**
 * Calculates personal average luteal phase length from completed cycles.
 * Only uses cycles where ovulation was detected with confidence >= 70%.
 * Returns null if insufficient data (< 2 qualifying cycles).
 */
const calculatePersonalLutealPhase = (
  completedCycleResults: Array<{
    cycleLength: number;
    ovulationDay: number;
    confidence: number;
  }>
): number | null => {
  // Filter to high-confidence detections only
  const qualifyingCycles = completedCycleResults.filter(
    (c) => c.confidence >= 70
  );

  if (qualifyingCycles.length < 2) return null;

  // Calculate luteal phase for each cycle
  const lutealPhases = qualifyingCycles.map(
    (c) => c.cycleLength - c.ovulationDay
  );

  // Return average, clamped to physiological range (10-16 days)
  const avg = lutealPhases.reduce((a, b) => a + b, 0) / lutealPhases.length;
  return Math.max(10, Math.min(16, Math.round(avg)));
};

/**
 * Detects symptom patterns that may correlate with ovulation.
 * Looks for fatigue/bloating spikes that often occur around ovulation.
 * Returns the day with highest symptom score in the expected window.
 */
const detectSymptomPeak = (
  cycleEntries: Array<{ entry: DailyEntry; cycleDay: number }>,
  expectedOvulationWindow: { start: number; end: number }
): { peakDay: number; score: number } | null => {
  const windowEntries = cycleEntries.filter(
    ({ cycleDay }) =>
      cycleDay >= expectedOvulationWindow.start &&
      cycleDay <= expectedOvulationWindow.end
  );

  if (windowEntries.length === 0) return null;

  // Score each day based on ovulation-related symptoms
  let maxScore = 0;
  let peakDay: number | null = null;

  for (const { entry, cycleDay } of windowEntries) {
    let score = 0;

    // Fatigue often increases around ovulation
    if (entry.symptoms?.fatigue?.present) {
      score += (entry.symptoms.fatigue.score ?? 5) / 10;
    }

    // Bloating is common around ovulation
    if (entry.symptoms?.bloating?.present) {
      score += (entry.symptoms.bloating.score ?? 5) / 10;
    }

    // Pelvic discomfort (non-menstrual) may indicate ovulation
    if (entry.symptoms?.pelvicPainNonMenses?.present) {
      score += (entry.symptoms.pelvicPainNonMenses.score ?? 5) / 10;
    }

    if (score > maxScore) {
      maxScore = score;
      peakDay = cycleDay;
    }
  }

  // Only return if we found meaningful symptoms (score > 0.5)
  return peakDay !== null && maxScore > 0.5 ? { peakDay, score: maxScore } : null;
};

const clampScore = (value: number | undefined | null): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(10, Math.round(value)));
};

const computeMaxPainIntensity = (entry: DailyEntry, extraPain?: number | null): number | null => {
  const intensities: number[] = [];
  const generalPain = clampScore(entry.painNRS);
  if (generalPain !== null) {
    intensities.push(generalPain);
  }
  (entry.painRegions ?? []).forEach((region) => {
    const regionScore = clampScore(region?.nrs);
    if (regionScore !== null) {
      intensities.push(regionScore);
    }
  });
  (entry.quickPainEvents ?? []).forEach((event) => {
    const eventScore = clampScore(event?.intensity);
    if (eventScore !== null) {
      intensities.push(eventScore);
    }
  });
  const shortcutPain = clampScore(extraPain);
  if (shortcutPain !== null) {
    intensities.push(shortcutPain);
  }
  if (!intensities.length) {
    return null;
  }
  return Math.max(...intensities);
};

/**
 * Unified multi-signal ovulation calculator.
 * Uses bleeding, mucus, pain, and symptoms to detect ovulation with confidence scoring.
 * Both charts should use this function for consistent results.
 */
const calculateOvulationForCycle = (
  cycleEntries: Array<{ entry: DailyEntry; cycleDay: number }>,
  cycleStartDate: string,
  cycleLength: number,
  options: {
    useBillingsMethod: boolean;
    isCompletedCycle: boolean;
    personalLutealPhase: number | null;
    /** Number of completed cycles with mucus data - needed for confidence calculation */
    completedCyclesWithMucus?: number;
  }
): OvulationResult => {
  const signals: OvulationResult["signals"] = {};

  // 1. Peak mucus detection (Billings method)
  if (options.useBillingsMethod) {
    const entriesWithNullableCycleDay = cycleEntries.map((e) => ({
      entry: e.entry,
      cycleDay: e.cycleDay as number | null,
    }));
    const peakDay = findPeakMucusDayInCycle(
      entriesWithNullableCycleDay,
      cycleStartDate
    );
    if (peakDay !== null) signals.peakMucusDay = peakDay;
  }

  // 2. Ovulation pain detection (strongest pain day with intensity >= 3)
  // Also require visible pain on chart >= 3 to ensure the pain is actually shown
  // This uses computeMaxPainIntensity which considers painNRS, painRegions, and quickPainEvents
  // This prevents predictions based on "invisible" ovulation pain data
  let strongestPainDay: number | null = null;
  let strongestPainIntensity = 0;
  for (const { entry, cycleDay } of cycleEntries) {
    const ovulationPainIntensity = entry.ovulationPain?.intensity ?? 0;
    // Use the same logic as the chart to determine visible pain
    const visiblePain = computeMaxPainIntensity(entry) ?? 0;
    // Require both ovulation pain AND visible pain on chart
    if (ovulationPainIntensity > strongestPainIntensity && ovulationPainIntensity >= 3 && visiblePain >= 3) {
      strongestPainIntensity = ovulationPainIntensity;
      strongestPainDay = cycleDay;
    }
  }
  if (strongestPainDay !== null) {
    signals.ovulationPainDay = strongestPainDay;
  }

  // 3. Symptom pattern detection (supporting evidence)
  const lutealPhase = options.personalLutealPhase ?? 14;
  const expectedOvulation = cycleLength - lutealPhase;
  const symptomPeak = detectSymptomPeak(cycleEntries, {
    start: Math.max(1, expectedOvulation - 5),
    end: Math.min(cycleLength, expectedOvulation + 5),
  });
  if (symptomPeak) signals.symptomPeakDay = symptomPeak.peakDay;

  // Priority-based calculation with cross-validation
  // Mucus-based confidence requires >= 2 completed cycles with mucus data for full confidence
  const hasEnoughMucusHistory = (options.completedCyclesWithMucus ?? 0) >= 2;

  // Priority 1: Peak mucus + Ovulation pain (cross-validated)
  // Only claim cross-validation if we have enough history to trust mucus data
  if (signals.peakMucusDay && signals.ovulationPainDay) {
    const mucusOvulation = signals.peakMucusDay + 1;
    // If pain is within ±2 days of mucus prediction, cross-validated
    if (Math.abs(mucusOvulation - signals.ovulationPainDay) <= 2) {
      // Only use "mucus_pain" method if we have enough history to trust the cross-validation
      // Otherwise just report as "mucus" since we can't reliably claim cross-validation yet
      return {
        ovulationDay: mucusOvulation,
        confidence: hasEnoughMucusHistory ? 95 : 65,
        method: hasEnoughMucusHistory ? "mucus_pain" : "mucus",
        signals,
      };
    }
    // If they disagree, trust mucus (more reliable)
    return {
      ovulationDay: mucusOvulation,
      confidence: hasEnoughMucusHistory ? 80 : 55,
      method: "mucus",
      signals,
    };
  }

  // Priority 2: Peak mucus only
  if (signals.peakMucusDay) {
    const mucusOvulation = signals.peakMucusDay + 1;
    // Boost confidence if symptom peak agrees
    const symptomsAgree =
      signals.symptomPeakDay &&
      Math.abs(mucusOvulation - signals.symptomPeakDay) <= 2;
    // Without enough history, mucus-only predictions get lower confidence (55-60% instead of 85-90%)
    // This reflects that we're still learning the user's patterns
    const baseConfidence = hasEnoughMucusHistory
      ? (symptomsAgree ? 90 : 85)
      : (symptomsAgree ? 60 : 55);
    return {
      ovulationDay: mucusOvulation,
      confidence: baseConfidence,
      method: "mucus",
      signals,
    };
  }

  // Priority 3: Ovulation pain only (high intensity)
  if (signals.ovulationPainDay && strongestPainIntensity >= 5) {
    // Boost confidence if symptom peak agrees
    const symptomsAgree =
      signals.symptomPeakDay &&
      Math.abs(signals.ovulationPainDay - signals.symptomPeakDay) <= 2;
    return {
      ovulationDay: signals.ovulationPainDay,
      confidence: symptomsAgree ? 75 : 70,
      method: "pain",
      signals,
    };
  }

  // Priority 4: Personal luteal phase calculation
  if (options.personalLutealPhase !== null) {
    return {
      ovulationDay: Math.round(cycleLength - options.personalLutealPhase),
      confidence: 60,
      method: "personal_luteal",
      signals,
    };
  }

  // Priority 5: Standard fallback (cycle length - 14)
  return {
    ovulationDay: Math.round(cycleLength - 14),
    confidence: 50,
    method: "standard",
    signals,
  };
};

/**
 * Calculate fertility window from ovulation day
 * Based on: sperm survival (5 days) + egg viability (1 day after ovulation)
 */
const calculateFertileWindow = (ovulationDay: number) => ({
  fertileStart: Math.max(1, ovulationDay - 5),
  fertileEnd: ovulationDay + 1,
});

/**
 * Check if a cycle day falls within the fertile window
 */
const isFertileDay = (cycleDay: number, ovulationDay: number | null): boolean => {
  if (ovulationDay === null) return false;
  const { fertileStart, fertileEnd } = calculateFertileWindow(ovulationDay);
  return cycleDay >= fertileStart && cycleDay <= fertileEnd;
};

const computeCycleDayForEntry = (
  state: CycleComputationState,
  entry: DailyEntry
): { cycleDay: number | null; state: CycleComputationState } => {
  const currentDate = new Date(entry.date);
  const isValidDate = !Number.isNaN(currentDate.getTime());
  const diffDays =
    state.previousDate && isValidDate
      ? Math.round((currentDate.getTime() - state.previousDate.getTime()) / 86_400_000)
      : 0;
  let nextCycleDay = state.cycleDay;
  if (nextCycleDay !== null && diffDays > 0) {
    nextCycleDay += diffDays;
  }
  const isBleeding = hasBleedingForEntry(entry);
  let nextLastBleedingDate = state.lastBleedingDate;

  if (isValidDate) {
    const daysWithoutBleedingBeforeCurrent =
      state.lastBleedingDate === null
        ? null
        : Math.max(
            0,
            Math.round((currentDate.getTime() - state.lastBleedingDate.getTime()) / 86_400_000) - 1
          );
    const hasRequiredBleedingBreak =
      daysWithoutBleedingBeforeCurrent === null || daysWithoutBleedingBeforeCurrent >= 7;
    const bleedingStartsToday =
      isBleeding &&
      (!state.previousBleeding || diffDays > 1 || nextCycleDay === null) &&
      hasRequiredBleedingBreak;
    if (bleedingStartsToday) {
      nextCycleDay = 1;
    }
    if (isBleeding) {
      nextLastBleedingDate = currentDate;
    }
  }

  return {
    cycleDay: nextCycleDay,
    state: {
      cycleDay: nextCycleDay,
      previousDate: isValidDate ? currentDate : state.previousDate,
      previousBleeding: isBleeding,
      lastBleedingDate: nextLastBleedingDate,
    },
  };
};

const sanitizeHeadRegionQualities = (
  qualities: DailyEntry["painQuality"]
): DailyEntry["painQuality"] => {
  const base = Array.from(new Set(qualities)) as DailyEntry["painQuality"];
  if (base.includes(MIGRAINE_WITH_AURA_LABEL)) {
    return base.filter((quality) => quality !== MIGRAINE_LABEL) as DailyEntry["painQuality"];
  }
  return base;
};

const mergeHeadacheOptIntoPainRegions = (
  regions: DailyEntry["painRegions"] | undefined,
  headacheOpt: DailyEntry["headacheOpt"] | undefined
): DailyEntry["painRegions"] | undefined => {
  if (!headacheOpt?.present) {
    return regions;
  }
  const desiredQuality = headacheOpt.aura ? MIGRAINE_WITH_AURA_LABEL : MIGRAINE_LABEL;
  const targetNrs =
    typeof headacheOpt.nrs === "number" ? Math.max(0, Math.min(10, Math.round(headacheOpt.nrs))) : 0;

  if (!regions || regions.length === 0) {
    return [
      { regionId: HEAD_REGION_ID, nrs: targetNrs, qualities: [desiredQuality] as DailyEntry["painQuality"] },
    ];
  }

  const headIndex = regions.findIndex((region) => region.regionId === HEAD_REGION_ID);
  if (headIndex === -1) {
    return [
      ...regions,
      { regionId: HEAD_REGION_ID, nrs: targetNrs, qualities: [desiredQuality] as DailyEntry["painQuality"] },
    ];
  }

  const headRegion = regions[headIndex];
  const originalQualities = headRegion.qualities ?? [];
  const filtered = originalQualities.filter((quality) => !MIGRAINE_QUALITY_SET.has(quality));
  const hasDesired = originalQualities.includes(desiredQuality);
  const nextQualities = hasDesired && filtered.length === originalQualities.length
    ? sanitizeHeadRegionQualities(originalQualities as DailyEntry["painQuality"])
    : sanitizeHeadRegionQualities([...(filtered as DailyEntry["painQuality"]), desiredQuality]);
  const nextNrs = typeof headRegion.nrs === "number" ? headRegion.nrs : targetNrs;

  if (nextQualities === headRegion.qualities && nextNrs === headRegion.nrs) {
    return regions;
  }

  const updatedHead = { ...headRegion, nrs: nextNrs, qualities: nextQualities };
  const nextRegions = [...regions];
  nextRegions[headIndex] = updatedHead;
  return nextRegions;
};

const deriveHeadacheFromPainRegions = (
  regions: DailyEntry["painRegions"] | undefined,
  previous: DailyEntry["headacheOpt"] | undefined
): DailyEntry["headacheOpt"] | undefined => {
  if (!regions) return undefined;
  const headRegion = regions.find((region) => region.regionId === HEAD_REGION_ID);
  if (!headRegion) return undefined;
  const qualities = headRegion.qualities ?? [];
  const hasMigraine = qualities.some((quality) => MIGRAINE_QUALITY_SET.has(quality));
  if (!hasMigraine) return undefined;
  const next: NonNullable<DailyEntry["headacheOpt"]> = {
    present: true,
    nrs: headRegion.nrs,
  };
  if (qualities.includes(MIGRAINE_WITH_AURA_LABEL)) {
    next.aura = true;
  }
  if (previous?.meds?.length) {
    next.meds = previous.meds;
  }
  return next;
};

const collectPainRegionQualities = (regions: NonNullable<DailyEntry["painRegions"]>): DailyEntry["painQuality"] => {
  const qualities = new Set<string>();
  regions.forEach((region) => {
    (region.qualities ?? []).forEach((quality) => qualities.add(quality));
  });
  return Array.from(qualities) as DailyEntry["painQuality"];
};

const buildDailyDraftWithPainRegions = (
  prev: DailyEntry,
  nextRegions: NonNullable<DailyEntry["painRegions"]>
): DailyEntry => {
  const nextHeadache = deriveHeadacheFromPainRegions(nextRegions, prev.headacheOpt);
  return {
    ...prev,
    painRegions: nextRegions,
    painMapRegionIds: nextRegions.map((region) => region.regionId),
    painQuality: collectPainRegionQualities(nextRegions),
    headacheOpt: nextHeadache,
  };
};

type BodyRegion = { id: string; label: string };

type PendingQuickPainAdd = QuickPainEvent & { source: "daily" | "shortcut" };

type PainShortcutTimelineSegment = {
  maxIntensity: number;
  eventCount: number;
};

const PAIN_SHORTCUT_SEGMENT_COUNT = 6;
const PAIN_TIMES_OF_DAY: PainTimeOfDay[] = ["morgens", "mittags", "abends"];
const PAIN_TIME_OF_DAY_SET = new Set<PainTimeOfDay>(PAIN_TIMES_OF_DAY);
const PAIN_TIME_OF_DAY_LABEL: Record<PainTimeOfDay, string> = {
  morgens: "Morgens",
  mittags: "Mittags",
  abends: "Abends",
};

const formatPainTimeOfDayList = (timeOfDay?: PainTimeOfDay[]): string | null => {
  if (!Array.isArray(timeOfDay) || !timeOfDay.length) {
    return null;
  }
  return timeOfDay.map((time) => PAIN_TIME_OF_DAY_LABEL[time] ?? time).join(" / ");
};

const computePainShortcutTimeline = (
  events: QuickPainEvent[]
): PainShortcutTimelineSegment[] => {
  const segments: PainShortcutTimelineSegment[] = Array.from(
    { length: PAIN_SHORTCUT_SEGMENT_COUNT },
    () => ({ maxIntensity: 0, eventCount: 0 })
  );
  events.forEach((event) => {
    const parsed = new Date(event.timestamp);
    if (Number.isNaN(parsed.getTime())) {
      return;
    }
    const hour = parsed.getHours() + parsed.getMinutes() / 60;
    const index = Math.min(
      segments.length - 1,
      Math.max(0, Math.floor((hour / 24) * segments.length))
    );
    const clampedIntensity = Math.max(0, Math.min(10, Math.round(event.intensity)));
    const current = segments[index];
    segments[index] = {
      maxIntensity: Math.max(current.maxIntensity, clampedIntensity),
      eventCount: current.eventCount + 1,
    };
  });
  return segments;
};

const sortQuickPainEvents = (events: QuickPainEvent[]): QuickPainEvent[] =>
  events.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp));

type DailyCategoryId =
  | "overview"
  | "cervixMucus"
  | "pain"
  | "symptoms"
  | "bleeding"
  | "medication"
  | "sleep"
  | "bowelBladder"
  | "notes"
  | "optional";

const DAILY_CATEGORY_KEYS: Exclude<DailyCategoryId, "overview">[] = [
  "cervixMucus",
  "pain",
  "symptoms",
  "bleeding",
  "medication",
  "sleep",
  "bowelBladder",
  "notes",
  "optional",
];

/**
 * Color mapping for daily check-in categories.
 * Each category has a saturated color for icons and a pastel color for backgrounds.
 */
const CATEGORY_COLORS: Record<
  Exclude<DailyCategoryId, "overview">,
  { saturated: string; pastel: string; border: string }
> = {
  pain: { saturated: "#a855f7", pastel: "#f8f0fc", border: "rgba(168, 85, 247, 0.25)" },
  symptoms: { saturated: "#ec4899", pastel: "#fcf0f4", border: "rgba(236, 72, 153, 0.25)" },
  bleeding: { saturated: "#e8524a", pastel: "#fdf0ef", border: "rgba(232, 82, 74, 0.25)" },
  medication: { saturated: "#0ea5e9", pastel: "#edf5fc", border: "rgba(14, 165, 233, 0.25)" },
  sleep: { saturated: "#8b5cf6", pastel: "#f3f0fa", border: "rgba(139, 92, 246, 0.25)" },
  bowelBladder: { saturated: "#ec4899", pastel: "#fcf0f4", border: "rgba(236, 72, 153, 0.25)" },
  notes: { saturated: "#f97316", pastel: "#faf4ed", border: "rgba(249, 115, 22, 0.25)" },
  optional: { saturated: "#f59e0b", pastel: "#fef7e8", border: "rgba(245, 158, 11, 0.25)" },
  cervixMucus: { saturated: "#14b8a6", pastel: "#e8f6f1", border: "rgba(20, 184, 166, 0.25)" },
};

const isTrackedDailyCategory = (
  categoryId: DailyCategoryId
): categoryId is TrackableDailyCategoryId =>
  TRACKED_DAILY_CATEGORY_IDS.includes(categoryId as TrackableDailyCategoryId);

const BODY_REGION_GROUPS: { id: string; label: string; regions: BodyRegion[] }[] = [
  {
    id: "head-neck",
    label: "Kopf & Nacken",
    regions: [
      { id: "head", label: "Kopf" },
      { id: "neck", label: "Nacken / Hals" },
    ],
  },
  {
    id: "back",
    label: "Rücken",
    regions: [
      { id: "upper_back_left", label: "Oberer Rücken links" },
      { id: "upper_back_right", label: "Oberer Rücken rechts" },
      { id: "mid_back_left", label: "Mittlerer Rücken links" },
      { id: "mid_back_right", label: "Mittlerer Rücken rechts" },
      { id: "lower_back", label: "LWS / Kreuzbein" },
    ],
  },
  {
    id: "upper-body",
    label: "Brust & Oberbauch",
    regions: [
      { id: "chest_left", label: "Brust links" },
      { id: "chest_right", label: "Brust rechts" },
      { id: "upper_abdomen_left", label: "Oberbauch links" },
      { id: "upper_abdomen", label: "Oberbauch Mitte" },
      { id: "upper_abdomen_right", label: "Oberbauch rechts" },
    ],
  },
  {
    id: "abdomen",
    label: "Unterleib & Becken",
    regions: [
      { id: "lower_abdomen_left", label: "Unterbauch links" },
      { id: "lower_abdomen", label: "Unterbauch Mitte" },
      { id: "lower_abdomen_right", label: "Unterbauch rechts" },
      { id: "pelvis_left", label: "Becken links" },
      { id: "pelvis_right", label: "Becken rechts" },
      { id: "uterus", label: "Uterus" },
      { id: "rectal", label: "Rektalbereich" },
      { id: "vaginal", label: "Vaginalbereich" },
    ],
  },
  {
    id: "arms",
    label: "Schultern, Arme & Hände",
    regions: [
      { id: "shoulder_left", label: "Schulter links" },
      { id: "shoulder_right", label: "Schulter rechts" },
      { id: "upper_arm_left", label: "Oberarm links" },
      { id: "upper_arm_right", label: "Oberarm rechts" },
      { id: "forearm_left", label: "Unterarm links" },
      { id: "forearm_right", label: "Unterarm rechts" },
      { id: "hand_left", label: "Hand links" },
      { id: "hand_right", label: "Hand rechts" },
    ],
  },
  {
    id: "legs",
    label: "Beine & Füße",
    regions: [
      { id: "hip_left", label: "Hüfte links" },
      { id: "hip_right", label: "Hüfte rechts" },
      { id: "thigh_left", label: "Oberschenkel links" },
      { id: "thigh_right", label: "Oberschenkel rechts" },
      { id: "knee_left", label: "Knie links" },
      { id: "knee_right", label: "Knie rechts" },
      { id: "calf_left", label: "Unterschenkel links" },
      { id: "calf_right", label: "Unterschenkel rechts" },
      { id: "ankle_left", label: "Sprunggelenk links" },
      { id: "ankle_right", label: "Sprunggelenk rechts" },
      { id: "foot_left", label: "Fuß links" },
      { id: "foot_right", label: "Fuß rechts" },
    ],
  },
];

const ABDOMEN_REGION_IDS = new Set(
  (BODY_REGION_GROUPS.find((group) => group.id === "abdomen")?.regions ?? []).map((region) => region.id)
);

const computePelvicPainOutsidePeriodIntensity = (entry: DailyEntry): number | null => {
  const pelvicScores = (entry.painRegions ?? [])
    .filter((region) => ABDOMEN_REGION_IDS.has(region.regionId))
    .map((region) => clampScore(region?.nrs))
    .filter((score): score is number => score !== null);
  if (!pelvicScores.length) {
    return null;
  }
  return Math.max(...pelvicScores);
};

const applyAutomatedPainSymptoms = (entry: DailyEntry): DailyEntry => {
  const symptoms: DailyEntry["symptoms"] = { ...(entry.symptoms ?? {}) };
  const bleedingActive = hasBleedingForEntry(entry);
  const bleeding = entry.bleeding ?? { isBleeding: false };
  const result: DailyEntry = {
    ...entry,
    bleeding: { ...bleeding, isBleeding: bleedingActive },
    symptoms,
  };

  if (bleedingActive) {
    const maxPain = computeMaxPainIntensity(entry);
    if (maxPain !== null && maxPain > 0) {
      symptoms.dysmenorrhea = { present: true, score: maxPain };
    } else {
      delete symptoms.dysmenorrhea;
    }
    delete symptoms.pelvicPainNonMenses;
  } else {
    const pelvicPain = computePelvicPainOutsidePeriodIntensity(entry);
    if (pelvicPain !== null && pelvicPain > 0) {
      symptoms.pelvicPainNonMenses = { present: true, score: pelvicPain };
    } else {
      delete symptoms.pelvicPainNonMenses;
    }
    delete symptoms.dysmenorrhea;
  }

  if (Object.keys(symptoms).length === 0) {
    result.symptoms = {};
  }

  return result;
};

const getRegionLabel = (regionId: string): string => {
  for (const group of BODY_REGION_GROUPS) {
    for (const region of group.regions) {
      if (region.id === regionId) {
        return region.label;
      }
    }
  }
  return regionId;
};

const formatList = (items: string[], limit = 3) => {
  const filtered = items.filter(Boolean);
  if (filtered.length <= limit) {
    return filtered.join(", ");
  }
  const remaining = filtered.length - limit;
  return `${filtered.slice(0, limit).join(", ")} +${remaining} weitere`;
};

const truncateText = (text: string, maxLength = 80) => {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
};

const formatNumber = (
  value: number,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
) => {
  const hasFraction = !Number.isInteger(value);
  const maximumFractionDigits = options?.maximumFractionDigits ?? (hasFraction ? 1 : 0);
  const minimumFractionDigits =
    options?.minimumFractionDigits ?? (hasFraction ? Math.min(1, maximumFractionDigits) : 0);
  return value.toLocaleString("de-DE", { maximumFractionDigits, minimumFractionDigits });
};

const SYMPTOM_ITEMS: { key: SymptomKey; termKey: TermKey }[] = [
  { key: "fatigue", termKey: "fatigue" },
  { key: "bloating", termKey: "bloating" },
];

type PbacSaturation = "light" | "medium" | "heavy";

const PBAC_ICON_BASE_OPACITY = 0.12;
const PBAC_ICON_DETAIL_OPACITY = 0.75;
const PBAC_ICON_STRING_OPACITY = 0.35;

const PBAC_PAD_BASE_PATH =
  "M56.3,86.58c-5.5,2.54-11.01,2.54-16.51,0-3.54-1.68-5.94-7.01-5.47-10.38,2.26-18.47,2.26-36.95,0-55.42-.47-3.38,1.93-8.7,5.47-10.38,5.5-2.54,11.01-2.54,16.51,0,3.54,1.68,5.94,7.01,5.47,10.38-2.26,18.47-2.26,36.95,0,55.42.47,3.38-1.93,8.7-5.47,10.38Z";

const PBAC_PAD_DETAIL_PATHS: Record<PbacSaturation, string> = {
  light:
    "M49.05,57.89c-.78,1.2-1,1.05-1.78-.15-1.2-1.84-1.62-1.77-1.62-3.96s1.92-2.19,1.92-4.39-2.05-2.2-2.05-4.39,1.69-2.2,1.69-4.4-.99-2.03.21-3.87c.78-1.2,1.6-1.94,2.38-.75,1.2,1.84-.38,2.41-.38,4.61s.82,2.19.82,4.39-1.04,2.2-1.04,4.39.54,2.15.79,4.33.25,2.34-.94,4.18Z",
  medium:
    "M52.34,74.48c-3.82,2.81-4.51,2.47-8.34-.34-2.81-2.06-2.18-2.53-2.18-6.01s2.93-3.49,2.93-6.97-3.13-3.49-3.13-6.97,2.58-3.49,2.58-6.98.56-3.49.56-6.97-2.08-3.49-2.08-6.98.68-3.49.68-6.98-3.59-5.86-.78-7.93c3.82-2.81,6.12-1.53,9.95,1.28,2.81,2.06,1.05,3.16,1.05,6.64s-.29,3.49-.29,6.97-.72,3.49-.72,6.97-.65,3.49-.65,6.98,1.44,3.49,1.44,6.97.82,3.49.82,6.98-2.15,3.57-1.44,6.99,2.39,4.29-.42,6.36Z",
  heavy:
    "M56.73,82.08c-2.11,2.04-2.53-.48-5.47-.48s-2.94,2-5.87,2-3,.14-5.11-1.9-2.02-2.03-2.02-4.86,1.95-2.82,1.95-5.65.42-2.82.42-5.65-1.57-2.82-1.57-5.65.52-2.83.52-5.65-.95-2.83-.95-5.65,1.2-2.83,1.2-5.65-.92-2.83-.92-5.65.22-2.82.22-5.65.54-2.83.54-5.65.49-2.83.49-5.66-2.99-4.01-.95-5.98,3.24-.74,6.18-.74,2.94,1.08,5.87,1.08,3.72-2.02,5.84.02-.67,2.79-.67,5.61,1.25,2.82,1.25,5.65-1.16,2.82-1.16,5.65,1.74,2.82,1.74,5.65-1.79,2.83-1.79,5.65.25,2.83.25,5.65-.74,2.83-.74,5.65.1,2.83.1,5.65,1.94,2.82,1.94,5.65-1.06,2.83-1.06,5.65-1.4,3.07-.89,5.85,2.69,3.09.66,5.05Z",
};

const PBAC_TAMPON_BODY_PATH =
  "M48.2,15.62h0c6.26,0,11.35,5.09,11.35,11.35v39.34c0,4.52-3.67,8.19-8.19,8.19h-6.32c-4.52,0-8.19-3.67-8.19-8.19V26.97c0-6.26,5.09-11.35,11.35-11.35Z";

const PBAC_TAMPON_DETAIL_PATHS: Record<PbacSaturation, string | null> = {
  light:
    "M36.96,25.52c2.52,1.2,5.4,1.89,8.47,1.89,5.21,0,9.87-1.98,13.11-5.1-1.78-3.94-5.73-6.68-10.34-6.68-5.78,0-10.53,4.32-11.25,9.9Z",
  medium:
    "M58.45,44.52c.34-.14.71-.3,1.1-.49v-17.06c0-6.27-5.08-11.35-11.35-11.35s-11.35,5.08-11.35,11.35v20.98c7.26-2.86,16.49-1.38,21.6-3.43Z",
  heavy: null,
};

const PBAC_TAMPON_STRING_PATH =
  "M59.67,95.62c-.2-.82-.31-1.4-.4-1.86-.23-1.17-.3-1.52-1.35-3.68-.9-1.84-2.67-3.26-4.54-4.78-3.11-2.51-6.64-5.36-6.64-10.75h2.38c0,4.25,2.8,6.51,5.76,8.91,1.99,1.61,4.05,3.27,5.18,5.58,1.14,2.33,1.28,2.88,1.55,4.27.09.44.19.99.38,1.77l-2.31.55Z";

type PbacIconProps = SVGProps<SVGSVGElement> & { saturation: PbacSaturation };

const PbacPadIcon = ({ saturation, ...props }: PbacIconProps) => {
  return (
    <svg
      viewBox="0 0 96.91 96.91"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="48.97" cy="47.94" r="48.45" fill="#fff" />
      <circle cx="48.97" cy="47.94" r="48.45" fill="currentColor" fillOpacity={PBAC_ICON_BASE_OPACITY} />
      <path d={PBAC_PAD_BASE_PATH} fill="currentColor" fillOpacity={PBAC_ICON_BASE_OPACITY} />
      <path d={PBAC_PAD_DETAIL_PATHS[saturation]} fill="currentColor" fillOpacity={PBAC_ICON_DETAIL_OPACITY} />
    </svg>
  );
};

const PbacTamponIcon = ({ saturation, ...props }: PbacIconProps) => {
  const detailPath = PBAC_TAMPON_DETAIL_PATHS[saturation];
  return (
    <svg
      viewBox="0 0 96.91 96.91"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="48.97" cy="47.94" r="48.45" fill="#fff" />
      <circle cx="48.97" cy="47.94" r="48.45" fill="currentColor" fillOpacity={PBAC_ICON_BASE_OPACITY} />
      <path d={PBAC_TAMPON_BODY_PATH} fill="currentColor" fillOpacity={PBAC_ICON_DETAIL_OPACITY} />
      {detailPath ? <path d={detailPath} fill="currentColor" fillOpacity={PBAC_ICON_DETAIL_OPACITY} /> : null}
      <path d={PBAC_TAMPON_STRING_PATH} fill="currentColor" fillOpacity={PBAC_ICON_STRING_OPACITY} />
    </svg>
  );
};

type PbacProductItem = {
  id: PbacCountKey;
  label: string;
  score: number;
  product: "pad" | "tampon";
  saturation: PbacSaturation;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

type PbacClotItem = {
  id: Extract<PbacCountKey, "clot_small" | "clot_large">;
  label: string;
  score: number;
};

const PBAC_PRODUCT_ITEMS = [
  {
    id: "pad_light",
    label: "Leicht gesättigt",
    score: 1,
    product: "pad",
    saturation: "light",
    Icon: (props: SVGProps<SVGSVGElement>) => <PbacPadIcon saturation="light" {...props} />,
  },
  {
    id: "pad_medium",
    label: "Mittel gesättigt",
    score: 5,
    product: "pad",
    saturation: "medium",
    Icon: (props: SVGProps<SVGSVGElement>) => <PbacPadIcon saturation="medium" {...props} />,
  },
  {
    id: "pad_heavy",
    label: "Stark gesättigt",
    score: 20,
    product: "pad",
    saturation: "heavy",
    Icon: (props: SVGProps<SVGSVGElement>) => <PbacPadIcon saturation="heavy" {...props} />,
  },
  {
    id: "tampon_light",
    label: "Leicht gesättigt",
    score: 1,
    product: "tampon",
    saturation: "light",
    Icon: (props: SVGProps<SVGSVGElement>) => <PbacTamponIcon saturation="light" {...props} />,
  },
  {
    id: "tampon_medium",
    label: "Mittel gesättigt",
    score: 5,
    product: "tampon",
    saturation: "medium",
    Icon: (props: SVGProps<SVGSVGElement>) => <PbacTamponIcon saturation="medium" {...props} />,
  },
  {
    id: "tampon_heavy",
    label: "Stark gesättigt",
    score: 10,
    product: "tampon",
    saturation: "heavy",
    Icon: (props: SVGProps<SVGSVGElement>) => <PbacTamponIcon saturation="heavy" {...props} />,
  },
] satisfies readonly PbacProductItem[];

const PBAC_CLOT_ITEMS = [
  { id: "clot_small", label: "Koagel <2 cm", score: 1 },
  { id: "clot_large", label: "Koagel ≥2 cm", score: 5 },
] satisfies readonly PbacClotItem[];

const PBAC_ITEMS = [...PBAC_PRODUCT_ITEMS, ...PBAC_CLOT_ITEMS] as const;
const PBAC_MAX_PRODUCT_COUNT = 12;
const PBAC_MAX_CLOT_COUNT = 6;

type PbacProduct = (typeof PBAC_PRODUCT_ITEMS)[number]["product"];
type PbacProductItemId = (typeof PBAC_PRODUCT_ITEMS)[number]["id"];
const PBAC_PRODUCT_GROUPS: Record<PbacProduct, (typeof PBAC_PRODUCT_ITEMS)[number][]> = {
  pad: PBAC_PRODUCT_ITEMS.filter((item) => item.product === "pad"),
  tampon: PBAC_PRODUCT_ITEMS.filter((item) => item.product === "tampon"),
} as const;

const PBAC_SATURATION_DOT_CLASSES: Record<PbacSaturation, string> = {
  light: "bg-rose-200",
  medium: "bg-rose-500",
  heavy: "bg-rose-700",
};

const PBAC_SATURATION_ICON_CLASSES: Record<PbacSaturation, string> = {
  light: "bg-rose-100 text-rose-500",
  medium: "bg-rose-200 text-rose-600",
  heavy: "bg-rose-500 text-rose-50",
};

const PBAC_SATURATION_LABELS: Record<PbacSaturation, string> = {
  light: "leicht",
  medium: "mittel",
  heavy: "stark",
};
const PBAC_SATURATION_ORDER: PbacSaturation[] = ["light", "medium", "heavy"];

type BleedingQuickAddNotice = {
  id: number;
  label: string;
  saturation: PbacSaturation;
  score: number;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const PBAC_ENTRY_CATEGORY_OPTIONS = [
  { id: "pad", label: "Binde", description: "Wie voll beim Wechsel?" },
  { id: "tampon", label: "Tampon", description: "Wie voll beim Wechsel?" },
  { id: "clot", label: "Koagel", description: "Größe & Häufigkeit" },
  { id: "flooding", label: "Flooding", description: "+5 PBAC bei Aktivierung" },
] as const;

type PbacEntryCategory = (typeof PBAC_ENTRY_CATEGORY_OPTIONS)[number]["id"];
const PBAC_FLOODING_SCORE = 5;
const HEAVY_BLEED_PBAC = 100;

const isHeavyBleedToday = (entry: DailyEntry) => (entry.bleeding?.pbacScore ?? 0) >= HEAVY_BLEED_PBAC;

const DEFAULT_PAGE_BG = "#fff1f2";
const SAVED_PAGE_BG = "#fff7ed";

const EHP5_ITEMS = [
  "Schmerz schränkt Alltagstätigkeiten ein",
  "Arbeit oder Studium litten unter Beschwerden",
  "Emotionale Belastung durch Endometriose",
  "Beziehungen und soziale Aktivitäten beeinflusst",
  "Energielevel/Erschöpfung im Alltag",
] as const;

const PHQ9_ITEMS = [
  "Wenig Interesse oder Freude an Tätigkeiten",
  "Niedergeschlagen, deprimiert oder hoffnungslos",
  "Einschlaf- oder Durchschlafprobleme bzw. zu viel Schlaf",
  "Müdigkeit oder Energiemangel",
  "Appetitmangel oder übermäßiges Essen",
  "Schlechtes Gefühl über sich selbst oder das Gefühl, versagt zu haben",
  "Schwierigkeiten, sich zu konzentrieren (z. B. Zeitung lesen, Fernsehen)",
  "Bewegungs- oder Sprechverlangsamung bzw. Unruhe",
  "Gedanken, dass es besser wäre, tot zu sein oder sich selbst Schaden zuzufügen",
] as const;

const GAD7_ITEMS = [
  "Nervosität, innere Unruhe oder Anspannung",
  "Unfähigkeit, Sorgen zu kontrollieren",
  "Übermäßige Sorgen über verschiedene Dinge",
  "Schwierigkeit, sich zu entspannen",
  "Ruhelosigkeit, so dass man nicht still sitzen kann",
  "Leicht reizbar oder verärgert",
  "Angst, dass etwas Schlimmes passieren könnte",
] as const;

const SCALE_OPTIONS_0_4 = [0, 1, 2, 3, 4] as const;
const SCALE_OPTIONS_0_3 = [0, 1, 2, 3] as const;

type TrackableDailyCategoryId =
  | "cervixMucus"
  | "pain"
  | "symptoms"
  | "bleeding"
  | "medication"
  | "sleep"
  | "bowelBladder"
  | "notes"
  | "optional";

const TRACKED_DAILY_CATEGORY_IDS: TrackableDailyCategoryId[] = [
  "cervixMucus",
  "pain",
  "symptoms",
  "bleeding",
  "medication",
  "sleep",
  "bowelBladder",
  "notes",
  "optional",
];

const PAIN_FREE_MESSAGES = [
  "Juhu, schmerzfrei",
  "Hurra, heute keine Schmerzen",
  "Wie schön, kein Schmerz weit und breit",
  "Yes, alles schmerzfrei",
  "Heute nur Wohlfühlmomente",
  "Super, null Schmerzen",
  "Frei von jedem Zwicken",
  "Ein Tag ganz ohne Schmerzen",
  "Schmerzlevel? Glatte Null",
  "Fantastisch. Keine Schmerzen",
] as const;

const PAIN_FREE_EMOJIS = ["😄", "🥳", "😊", "🤩", "🙌", "🎉", "🌈", "💖", "😌", "💃"] as const;

const SYMPTOM_FREE_MESSAGES = [
  "Yes! Keine Symptome",
  "Alles ruhig auf der Symptomfront",
  "So gut, keine Symptome heute",
  "Was für ein Glückstag ohne Symptome",
  "Frei von Symptomen – juhu",
  "Heute kein Symptom in Sicht",
  "Symptomfreie Zone",
  "Wunderbar symptomlos",
  "Null Symptome, nur Freude",
  "Alles entspannt, keine Symptome",
] as const;

const SYMPTOM_FREE_EMOJIS = ["✨", "🎉", "😊", "🥳", "🌟", "😄", "🙌", "🍀", "🤗", "💫"] as const;

const pickRandom = <T,>(values: readonly T[]): T => {
  return values[Math.floor(Math.random() * values.length)];
};

const createEmptyCategoryCompletion = (): Record<TrackableDailyCategoryId, boolean> =>
  TRACKED_DAILY_CATEGORY_IDS.reduce((acc, categoryId) => {
    acc[categoryId] = false;
    return acc;
  }, {} as Record<TrackableDailyCategoryId, boolean>);

type SymptomSnapshot = { present: boolean; score: number | null };

type CategorySnapshot = {
  entry?: Record<string, unknown>;
  featureFlags?: Partial<Record<keyof FeatureFlags, boolean>>;
  pbacCounts?: PbacCounts;
};

const deepClone = <T,>(value: T): T => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const equalWithNullUndefined = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((value, index) => equalWithNullUndefined(value, b[index]));
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return false;
  }
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) {
    return false;
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => bKeys.includes(key) && equalWithNullUndefined(aObj[key], bObj[key]));
};

const normalizeSymptom = (value?: { present?: boolean; score?: number }): SymptomSnapshot => ({
  present: Boolean(value?.present),
  score: typeof value?.score === "number" ? value.score : null,
});

const applySymptomSnapshot = (snapshot?: SymptomSnapshot) => {
  if (!snapshot) {
    return undefined;
  }
  if (!snapshot.present && snapshot.score === null) {
    return { present: false };
  }
  const result: { present: boolean; score?: number } = { present: snapshot.present };
  if (snapshot.score !== null) {
    result.score = snapshot.score;
  }
  return result;
};

const pickFeatureFlags = (
  featureFlags: FeatureFlags,
  keys: (keyof FeatureFlags)[]
): Partial<Record<keyof FeatureFlags, boolean>> => {
  const sortedKeys = [...keys].sort();
  return sortedKeys.reduce((acc, key) => {
    acc[key] = Boolean(featureFlags[key]);
    return acc;
  }, {} as Partial<Record<keyof FeatureFlags, boolean>>);
};

const sortPbacCounts = (counts: PbacCounts): PbacCounts => {
  const normalized = normalizePbacCounts(counts);
  return PBAC_COUNT_KEYS.reduce((acc, key) => {
    acc[key] = normalized[key];
    return acc;
  }, {} as PbacCounts);
};

const extractDailyCategorySnapshot = (
  entry: DailyEntry,
  categoryId: TrackableDailyCategoryId,
  featureFlags: FeatureFlags,
  pbacCounts: PbacCounts
): CategorySnapshot | null => {
  switch (categoryId) {
    case "cervixMucus": {
      return {
        entry: {
          cervixMucus: entry.cervixMucus ? { ...entry.cervixMucus } : null,
        },
      };
    }
    case "pain": {
      const painRegions = (entry.painRegions ?? []).map((region) => ({
        regionId: region.regionId,
        nrs: typeof region.nrs === "number" ? region.nrs : null,
        qualities: [...(region.qualities ?? [])],
      }));
      return {
        entry: {
          painRegions,
          painMapRegionIds: [...(entry.painMapRegionIds ?? [])],
          painQuality: [...(entry.painQuality ?? [])],
          painNRS: typeof entry.painNRS === "number" ? entry.painNRS : null,
          impactNRS: typeof entry.impactNRS === "number" ? entry.impactNRS : null,
          headacheOpt: entry.headacheOpt ? deepClone(entry.headacheOpt) : null,
          ovulationPain: entry.ovulationPain ? deepClone(entry.ovulationPain) : null,
          symptoms: {
            deepDyspareunia: normalizeSymptom(entry.symptoms?.deepDyspareunia),
          },
        },
      };
    }
    case "symptoms": {
      const symptomSnapshot: Record<string, SymptomSnapshot> = {};
      SYMPTOM_ITEMS.forEach((item) => {
        symptomSnapshot[item.key] = normalizeSymptom(entry.symptoms?.[item.key]);
      });
      return {
        entry: { symptoms: symptomSnapshot },
        featureFlags: pickFeatureFlags(
          featureFlags,
          SYMPTOM_MODULE_TOGGLES.map((toggle) => toggle.key)
        ),
      };
    }
    case "bleeding": {
      const bleedingActive = hasBleedingForEntry({ ...entry, pbacCounts });
      return {
        entry: {
          bleeding: {
            isBleeding: bleedingActive,
            pbacScore: typeof entry.bleeding?.pbacScore === "number" ? entry.bleeding.pbacScore : null,
            clots: Boolean(entry.bleeding?.clots),
            flooding: Boolean(entry.bleeding?.flooding),
          },
        },
        pbacCounts: sortPbacCounts(pbacCounts),
      };
    }
    case "medication": {
      return {
        entry: {
          rescueMeds: (entry.rescueMeds ?? []).map((med) => ({
            name: med.name,
            doseMg: typeof med.doseMg === "number" ? med.doseMg : null,
            time: med.time ?? null,
          })),
        },
      };
    }
    case "sleep": {
      const sleep = entry.sleep
        ? {
            hours: typeof entry.sleep.hours === "number" ? entry.sleep.hours : null,
            quality: typeof entry.sleep.quality === "number" ? entry.sleep.quality : null,
            awakenings:
              typeof entry.sleep.awakenings === "number" ? entry.sleep.awakenings : null,
          }
        : null;
      return {
        entry: { sleep },
      };
    }
    case "bowelBladder": {
      return {
        entry: {
          symptoms: {
            dyschezia: normalizeSymptom(entry.symptoms?.dyschezia),
            dysuria: normalizeSymptom(entry.symptoms?.dysuria),
          },
          gi: entry.gi ? { bristolType: entry.gi.bristolType ?? null } : null,
          urinary: entry.urinary
            ? {
                freqPerDay: typeof entry.urinary.freqPerDay === "number" ? entry.urinary.freqPerDay : null,
                urgency: typeof entry.urinary.urgency === "number" ? entry.urinary.urgency : null,
              }
            : null,
          urinaryOpt: entry.urinaryOpt
            ? {
                present: Boolean(entry.urinaryOpt.present),
                urgency: typeof entry.urinaryOpt.urgency === "number" ? entry.urinaryOpt.urgency : null,
                leaksCount:
                  typeof entry.urinaryOpt.leaksCount === "number" ? entry.urinaryOpt.leaksCount : null,
                nocturia:
                  typeof entry.urinaryOpt.nocturia === "number" ? entry.urinaryOpt.nocturia : null,
                padsCount:
                  typeof entry.urinaryOpt.padsCount === "number" ? entry.urinaryOpt.padsCount : null,
              }
            : null,
          dizzinessOpt: entry.dizzinessOpt
            ? {
                present: Boolean(entry.dizzinessOpt.present),
                nrs: typeof entry.dizzinessOpt.nrs === "number" ? entry.dizzinessOpt.nrs : null,
                orthostatic: Boolean(entry.dizzinessOpt.orthostatic),
              }
            : null,
        },
        featureFlags: pickFeatureFlags(featureFlags, ["moduleUrinary"]),
      };
    }
    case "notes": {
      return {
        entry: {
          notesTags: [...(entry.notesTags ?? [])],
          notesFree: entry.notesFree ?? null,
        },
      };
    }
    case "optional": {
      return {
        entry: {
          ovulation: entry.ovulation ? deepClone(entry.ovulation) : null,
          activity: entry.activity ? deepClone(entry.activity) : null,
          exploratory: entry.exploratory ? deepClone(entry.exploratory) : null,
          headacheOpt: entry.headacheOpt ? deepClone(entry.headacheOpt) : null,
        },
        featureFlags: pickFeatureFlags(featureFlags, ["moduleHeadache", "moduleDizziness"]),
      };
    }
    default:
      return null;
  }
};

const restoreDailyCategorySnapshot = (
  entry: DailyEntry,
  featureFlags: FeatureFlags,
  pbacCounts: PbacCounts,
  categoryId: TrackableDailyCategoryId,
  snapshot: CategorySnapshot
): { entry: DailyEntry; featureFlags: FeatureFlags; pbacCounts: PbacCounts } => {
  let nextEntry: DailyEntry = { ...entry };
  let nextFeatureFlags: FeatureFlags = { ...featureFlags };
  let nextPbacCounts: PbacCounts = pbacCounts;

  switch (categoryId) {
    case "cervixMucus": {
      const data = snapshot.entry as { cervixMucus?: DailyEntry["cervixMucus"] | null } | undefined;
      if (data) {
        nextEntry.cervixMucus = data.cervixMucus ? { ...data.cervixMucus } : undefined;
      }
      break;
    }
    case "pain": {
      const data = snapshot.entry as
        | {
            painRegions?: Array<{ regionId: string; nrs: number | null; qualities: string[] }>;
            painMapRegionIds?: string[];
            painQuality?: string[];
            painNRS?: number | null;
            impactNRS?: number | null;
            headacheOpt?: DailyEntry["headacheOpt"] | null;
            ovulationPain?: DailyEntry["ovulationPain"] | null;
            symptoms?: { deepDyspareunia?: SymptomSnapshot };
          }
        | undefined;
      if (data) {
        if (data.painRegions) {
          const normalizedRegions = data.painRegions.map((region) => ({
            regionId: region.regionId,
            nrs: typeof region.nrs === "number" ? region.nrs : 0,
            qualities: [...(region.qualities ?? [])],
          })) as NonNullable<DailyEntry["painRegions"]>;
          nextEntry = buildDailyDraftWithPainRegions(nextEntry, normalizedRegions);
        }
        if (data.painNRS !== undefined) {
          nextEntry.painNRS = data.painNRS ?? 0;
        }
        if (data.impactNRS !== undefined) {
          nextEntry.impactNRS = data.impactNRS ?? undefined;
        }
        nextEntry.headacheOpt = data.headacheOpt ? deepClone(data.headacheOpt) : undefined;
        nextEntry.ovulationPain = data.ovulationPain ? deepClone(data.ovulationPain) : undefined;
        const nextSymptoms = { ...(nextEntry.symptoms ?? {}) };
        const deepDyspareuniaSnapshot = data.symptoms?.deepDyspareunia;
        if (deepDyspareuniaSnapshot) {
          nextSymptoms.deepDyspareunia = applySymptomSnapshot(deepDyspareuniaSnapshot);
        } else {
          delete nextSymptoms.deepDyspareunia;
        }
        nextEntry.symptoms = nextSymptoms;
      }
      break;
    }
    case "symptoms": {
      const data = snapshot.entry as { symptoms?: Record<string, SymptomSnapshot> } | undefined;
      if (data?.symptoms) {
        const nextSymptoms = { ...(nextEntry.symptoms ?? {}) };
        SYMPTOM_ITEMS.forEach((item) => {
          const itemSnapshot = data.symptoms?.[item.key];
          if (itemSnapshot) {
            nextSymptoms[item.key] = applySymptomSnapshot(itemSnapshot);
          }
        });
        nextEntry.symptoms = nextSymptoms;
      }
      if (snapshot.featureFlags) {
        Object.entries(snapshot.featureFlags).forEach(([key, value]) => {
          nextFeatureFlags[key as keyof FeatureFlags] = Boolean(value);
        });
      }
      break;
    }
    case "bleeding": {
      const data = snapshot.entry as
        | {
            bleeding?: {
              isBleeding: boolean;
              pbacScore: number | null;
              clots: boolean;
              flooding: boolean;
            };
          }
        | undefined;
      if (data?.bleeding) {
        nextEntry.bleeding = {
          isBleeding: Boolean(data.bleeding.isBleeding),
          pbacScore:
            typeof data.bleeding.pbacScore === "number" ? data.bleeding.pbacScore : undefined,
          clots: Boolean(data.bleeding.clots),
          flooding: Boolean(data.bleeding.flooding),
        };
      }
      if (snapshot.pbacCounts) {
        nextPbacCounts = sortPbacCounts(snapshot.pbacCounts);
      }
      break;
    }
    case "medication": {
      const data = snapshot.entry as
        | {
            rescueMeds?: DailyEntry["rescueMeds"];
          }
        | undefined;
      if (data?.rescueMeds) {
        nextEntry.rescueMeds = data.rescueMeds.map((med) => ({
          name: med.name,
          doseMg: typeof med.doseMg === "number" ? med.doseMg : undefined,
          time: med.time ?? undefined,
        }));
      }
      break;
    }
    case "sleep": {
      const data = snapshot.entry as { sleep?: { hours: number | null; quality: number | null; awakenings: number | null } | null } | undefined;
      if (data) {
        nextEntry.sleep = data.sleep
          ? {
              hours: typeof data.sleep.hours === "number" ? data.sleep.hours : undefined,
              quality: typeof data.sleep.quality === "number" ? data.sleep.quality : undefined,
              awakenings:
                typeof data.sleep.awakenings === "number" ? data.sleep.awakenings : undefined,
            }
          : undefined;
      }
      break;
    }
    case "bowelBladder": {
      const data = snapshot.entry as
        | {
            symptoms?: { dyschezia?: SymptomSnapshot; dysuria?: SymptomSnapshot };
            gi?: { bristolType: number | null } | null;
            urinary?: { freqPerDay: number | null; urgency: number | null } | null;
            urinaryOpt?: {
              present: boolean;
              urgency: number | null;
              leaksCount: number | null;
              nocturia: number | null;
              padsCount: number | null;
            } | null;
            dizzinessOpt?: {
              present: boolean;
              nrs: number | null;
              orthostatic: boolean;
            } | null;
          }
        | undefined;
      if (data) {
        const nextSymptoms = { ...(nextEntry.symptoms ?? {}) };
        if (data.symptoms?.dyschezia) {
          nextSymptoms.dyschezia = applySymptomSnapshot(data.symptoms.dyschezia);
        }
        if (data.symptoms?.dysuria) {
          nextSymptoms.dysuria = applySymptomSnapshot(data.symptoms.dysuria);
        }
        nextEntry.symptoms = nextSymptoms;
        if (data.gi) {
          const bristolType = data.gi?.bristolType;
          nextEntry.gi =
            typeof bristolType === "number"
              ? {
                  bristolType:
                    bristolType as NonNullable<DailyEntry["gi"]>["bristolType"],
                }
              : undefined;
        } else {
          nextEntry.gi = undefined;
        }
        if (data.urinary) {
          const freqPerDay =
            typeof data.urinary.freqPerDay === "number" ? data.urinary.freqPerDay : undefined;
          const urgency =
            typeof data.urinary.urgency === "number" ? data.urinary.urgency : undefined;
          nextEntry.urinary = freqPerDay !== undefined || urgency !== undefined ? { freqPerDay, urgency } : undefined;
        } else {
          nextEntry.urinary = undefined;
        }
        if (data.urinaryOpt) {
          const urgency =
            typeof data.urinaryOpt.urgency === "number" ? data.urinaryOpt.urgency : undefined;
          const leaksCount =
            typeof data.urinaryOpt.leaksCount === "number" ? data.urinaryOpt.leaksCount : undefined;
          const nocturia =
            typeof data.urinaryOpt.nocturia === "number" ? data.urinaryOpt.nocturia : undefined;
          const padsCount =
            typeof data.urinaryOpt.padsCount === "number" ? data.urinaryOpt.padsCount : undefined;
          const present = Boolean(data.urinaryOpt.present);
          const hasDetails =
            present ||
            urgency !== undefined ||
            leaksCount !== undefined ||
            nocturia !== undefined ||
            padsCount !== undefined;
          nextEntry.urinaryOpt = hasDetails
            ? { present, urgency, leaksCount, nocturia, padsCount }
            : undefined;
        } else {
          nextEntry.urinaryOpt = undefined;
        }
        if (data.dizzinessOpt) {
          const nrs = typeof data.dizzinessOpt.nrs === "number" ? data.dizzinessOpt.nrs : undefined;
          const present = Boolean(data.dizzinessOpt.present);
          const orthostatic = Boolean(data.dizzinessOpt.orthostatic);
          const hasDizzinessDetails = present || nrs !== undefined || orthostatic;
          nextEntry.dizzinessOpt = hasDizzinessDetails ? { present, nrs, orthostatic } : undefined;
        } else {
          nextEntry.dizzinessOpt = undefined;
        }
      }
      if (snapshot.featureFlags) {
        Object.entries(snapshot.featureFlags).forEach(([key, value]) => {
          nextFeatureFlags[key as keyof FeatureFlags] = Boolean(value);
        });
      }
      break;
    }
    case "notes": {
      const data = snapshot.entry as { notesTags?: string[]; notesFree?: string | null } | undefined;
      if (data) {
        nextEntry.notesTags = Array.isArray(data.notesTags) ? [...data.notesTags] : undefined;
        if (typeof data.notesFree === "string") {
          nextEntry.notesFree = data.notesFree;
        } else {
          delete (nextEntry as { notesFree?: DailyEntry["notesFree"] }).notesFree;
        }
      }
      break;
    }
    case "optional": {
      const data = snapshot.entry as
        | {
            ovulation?: DailyEntry["ovulation"] | null;
            activity?: DailyEntry["activity"] | null;
            exploratory?: DailyEntry["exploratory"] | null;
            headacheOpt?: DailyEntry["headacheOpt"] | null;
          }
        | undefined;
      if (data) {
        nextEntry.ovulation = data.ovulation ? deepClone(data.ovulation) : undefined;
        nextEntry.activity = data.activity ? deepClone(data.activity) : undefined;
        nextEntry.exploratory = data.exploratory ? deepClone(data.exploratory) : undefined;
        nextEntry.headacheOpt = data.headacheOpt ? deepClone(data.headacheOpt) : undefined;
      }
      break;
    }
  }

  if (snapshot.featureFlags && categoryId !== "symptoms" && categoryId !== "bowelBladder") {
    Object.entries(snapshot.featureFlags).forEach(([key, value]) => {
      nextFeatureFlags[key as keyof FeatureFlags] = Boolean(value);
    });
  }

  nextEntry.pbacCounts = nextPbacCounts;

  return {
    entry: nextEntry,
    featureFlags: nextFeatureFlags,
    pbacCounts: nextPbacCounts,
  };
};

type CycleOverviewPoint = {
  date: string;
  cycleDay: number | null;
  painNRS: number;
  impactNRS: number | null;
  pbacScore: number | null;
  isBleeding: boolean;
  bleedingTrackingMethod: TrackingMethod | null;
  simpleBleedingIntensity: SimpleBleedingIntensity | null;
  ovulationPositive: boolean;
  ovulationPainIntensity: number | null;
  painTimeline: PainShortcutTimelineSegment[] | null;
  isPredictedOvulationDay: boolean;
  isInPredictedFertileWindow: boolean;
  mucusFertilityScore: number | null;
  ovulationMethod: OvulationResult["method"] | null;
  ovulationConfidence: number | null;
};

type CycleOverviewData = {
  startDate: string;
  points: CycleOverviewPoint[];
  todayIndex: number;
};

const CYCLE_OVERVIEW_PAST_DAYS = 180;
const CYCLE_OVERVIEW_FUTURE_DAYS = 30;
const CYCLE_OVERVIEW_VISIBLE_DAYS = 30;

type MenstruationComparisonPoint = {
  cycleDay: number;
  currentPBAC: number | null;
  previousPBAC: number | null;
  currentDate?: string;
  previousDate?: string;
  currentPain?: number | null;
  previousPain?: number | null;
  currentImpact?: number | null;
  previousImpact?: number | null;
};

const formatShortGermanDate = (iso: string) => {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  return parsed.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
};

const formatShortTimeLabel = (iso: string | null) => {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
};

const describeQuickPainEvent = (event: QuickPainEvent) => {
  const timeLabel =
    formatPainTimeOfDayList(event.timeOfDay) ??
    formatShortTimeLabel(event.timestamp) ??
    (event.granularity === "tag" ? "Ganzer Tag" : null);

  const parts = [timeLabel, getRegionLabel(event.regionId), `${event.intensity}/10`];
  const qualityLabel = event.qualities?.length
    ? formatList(event.qualities, 2)
    : event.quality
      ? event.quality
      : null;
  if (qualityLabel) {
    parts.push(qualityLabel);
  }
  return parts.filter(Boolean).join(" · ");
};

const describeBleedingLevel = (point: CycleOverviewPoint) => {
  if (!point.isBleeding) {
    return { label: "keine Blutung", value: 0, pbacEquivalent: 0 };
  }

  // Determine the PBAC equivalent score based on tracking method
  let score: number;
  if (point.bleedingTrackingMethod === "simple" && point.simpleBleedingIntensity) {
    // For simple mode, use the PBAC equivalent from intensity
    score = getSimpleBleedingPbacEquivalent(point.simpleBleedingIntensity);
  } else if (typeof point.pbacScore === "number") {
    // For classic/extended PBAC, use actual score
    score = point.pbacScore;
  } else {
    // Fallback for bleeding without score data
    score = 5;
  }

  if (score >= 41) {
    return { label: "sehr starke Blutung", value: score, pbacEquivalent: score };
  }
  if (score >= 26) {
    return { label: "starke Blutung", value: score, pbacEquivalent: score };
  }
  if (score >= 10) {
    return { label: "mittlere Blutung", value: score, pbacEquivalent: score };
  }
  if (score > 0) {
    return { label: "leichte Blutung", value: score, pbacEquivalent: score };
  }
  // Score is 0 but bleeding is marked - minimal bleeding
  return { label: "minimale Blutung", value: 1, pbacEquivalent: 0 };
};

type CycleOverviewChartPoint = CycleOverviewPoint & {
  bleedingLabel: string;
  bleedingValue: number | null;
  pbacEquivalent: number;
  // For simple mode: uncertainty range for thicker/blurry display
  simpleBleedingMin: number | null;
  simpleBleedingMax: number | null;
  isSimpleModeDay: boolean;
  dateLabel: string;
  painValue: number | null;
  impactValue: number | null;
  isCurrentDay: boolean;
  isFutureDay: boolean;
};

type PainDotProps = DotProps & { payload?: CycleOverviewChartPoint };

const PainDot = ({ cx, cy, payload }: PainDotProps) => {
  if (typeof cx !== "number" || typeof cy !== "number" || !payload) {
    return null;
  }

  if (!payload.isCurrentDay) {
    return null;
  }

  return (
    <g>
      {payload.ovulationPositive ? (
        <circle cx={cx} cy={cy} r={7} fill="#fef3c7" stroke="#facc15" strokeWidth={2} />
      ) : null}
      <circle cx={cx} cy={cy} r={4} fill={CATEGORY_COLORS.pain.saturated} stroke="#fff" strokeWidth={2} />
    </g>
  );
};

const CycleStartDrop = ({ cx, cy }: DotProps) => {
  if (typeof cx !== "number" || typeof cy !== "number") {
    return null;
  }

  const topY = cy - 4;
  const bottomY = cy + 6;

  return (
    <g>
      <path
        d={`M ${cx} ${topY} C ${cx + 4} ${topY + 2}, ${cx + 3.5} ${cy + 2}, ${cx} ${bottomY} C ${cx - 3.5} ${cy + 2}, ${cx - 4} ${topY + 2}, ${cx} ${topY} Z`}
        fill="#ef4444"
        stroke="#b91c1c"
        strokeWidth={1}
      />
      <circle cx={cx} cy={topY + 2} r={1.2} fill="#fca5a5" />
    </g>
  );
};

type PredictionDotProps = DotProps & { payload?: CycleOverviewChartPoint };

/**
 * Unified ovulation dot with 4 confidence levels:
 * - < 61%: Yellow dashed ring (empty)
 * - 61-90%: Yellow solid ring (empty)
 * - 90-99%: Yellow filled dot
 * - 100%: Yellow filled dot with red ring (LH+ confirmed)
 * Positioned in dedicated prediction row between dates and chart baseline
 */
const OvulationConfidenceDot = ({ cx, cy, payload }: PredictionDotProps) => {
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    (!payload?.isPredictedOvulationDay && !payload?.ovulationPositive)
  ) {
    return null;
  }

  const confidence = payload?.ovulationConfidence ?? 50;

  // 100% - LH+ confirmed: Yellow filled dot with red ring
  if (confidence === 100 || payload?.ovulationPositive) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={5} fill="none" stroke="#ef4444" strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={3.5} fill="#fef08a" stroke="#ca8a04" strokeWidth={1} />
        <circle cx={cx} cy={cy} r={1.5} fill="#fde047" />
      </g>
    );
  }

  // 90-99%: Yellow filled dot
  if (confidence >= 90) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={4} fill="#fef08a" stroke="#ca8a04" strokeWidth={1} />
        <circle cx={cx} cy={cy} r={1.5} fill="#fde047" />
      </g>
    );
  }

  // 61-90%: Yellow solid ring (empty)
  if (confidence >= 61) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={4} fill="#fefce8" stroke="#eab308" strokeWidth={1} />
      </g>
    );
  }

  // < 61%: Yellow dashed ring (empty)
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="#fefce8"
        stroke="#eab308"
        strokeWidth={1}
        strokeDasharray="2,1"
      />
    </g>
  );
};

/**
 * Get human-readable label for ovulation detection method
 */
const getOvulationMethodLabel = (method: OvulationResult["method"]): string => {
  switch (method) {
    case "mucus_pain": return "Zervixschleim + Mittelschmerz";
    case "mucus": return "Zervixschleim (Billings)";
    case "pain": return "Mittelschmerz";
    case "personal_luteal": return "Persönliche Lutealphase";
    case "standard": return "Standardberechnung";
  }
};

const FertileWindowDot = ({ cx, cy, payload }: PredictionDotProps) => {
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    !payload?.isInPredictedFertileWindow ||
    payload?.isPredictedOvulationDay ||
    payload?.ovulationPositive
  ) {
    return null;
  }

  // Solid dots for mucus-validated predictions with sufficient confidence (>= 70%)
  // Dashed dots for calculated predictions or low-confidence mucus
  const isMucusValidated =
    (payload.ovulationMethod === "mucus" || payload.ovulationMethod === "mucus_pain") &&
    (payload.ovulationConfidence ?? 0) >= 70;

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={3}
        fill={isMucusValidated ? "#fce7f3" : "#fdf2f8"}
        stroke="#f472b6"
        strokeWidth={1}
        strokeDasharray={isMucusValidated ? undefined : "2,1"}
      />
    </g>
  );
};

/**
 * Mucus fertility indicator dot - shows peak fertility mucus observations
 * Only shown when Billings method is enabled and score >= 3 (high fertility)
 * Uses dashed stroke when insufficient history (< 2 completed cycles with mucus)
 */
const MucusFertilityDot = ({ cx, cy, payload }: PredictionDotProps) => {
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    !payload?.mucusFertilityScore ||
    payload.mucusFertilityScore < 3
  ) {
    return null;
  }

  const isPeakFertility = payload.mucusFertilityScore === 4;
  // Check if we have enough mucus history (confidence >= 70% indicates sufficient data)
  const hasEnoughHistory =
    (payload.ovulationMethod === "mucus" || payload.ovulationMethod === "mucus_pain") &&
    (payload.ovulationConfidence ?? 0) >= 70;

  return (
    <g>
      {/* Outer glow for peak fertility - only when validated */}
      {isPeakFertility && hasEnoughHistory && (
        <circle
          cx={cx}
          cy={cy}
          r={5}
          fill="#dcfce7"
          stroke="#22c55e"
          strokeWidth={0.5}
          opacity={0.5}
        />
      )}
      {/* Main indicator */}
      <circle
        cx={cx}
        cy={cy}
        r={isPeakFertility ? 3.5 : 3}
        fill={hasEnoughHistory ? (isPeakFertility ? "#22c55e" : "#86efac") : "#f0fdf4"}
        stroke={isPeakFertility ? "#15803d" : "#22c55e"}
        strokeWidth={1}
        strokeDasharray={hasEnoughHistory ? undefined : "2,1"}
      />
    </g>
  );
};

const CycleOverviewMiniChart = ({ data }: { data: CycleOverviewData }) => {
  const bleedingGradientId = useId();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollToToday, setShowScrollToToday] = useState(false);
  const [activeTooltipData, setActiveTooltipData] = useState<CycleOverviewChartPoint | null>(null);
  const todayIso = useMemo(() => formatDate(new Date()), []);

  // Calculate chart dimensions
  const totalDays = data.points.length;
  const chartWidthMultiplier = totalDays / CYCLE_OVERVIEW_VISIBLE_DAYS;

  const chartPoints = useMemo<CycleOverviewChartPoint[]>(() => {
    // Find the first date with actual entry data
    const firstEntryDate = data.points.find(
      (p) => p.painNRS > 0 || p.isBleeding || p.impactNRS !== null || p.ovulationPositive
    )?.date ?? todayIso;

    return data.points.map((point) => {
      const isFutureDay = point.date > todayIso;
      const isBeforeFirstEntry = point.date < firstEntryDate;
      const shouldHideData = isFutureDay || isBeforeFirstEntry;

      const bleeding = describeBleedingLevel(point);
      const painValue = shouldHideData
        ? null
        : Number.isFinite(point.painNRS)
          ? Math.max(0, Math.min(10, Number(point.painNRS)))
          : 0;
      const impactValue = shouldHideData
        ? null
        : Number.isFinite(point.impactNRS)
          ? Math.max(0, Math.min(10, Number(point.impactNRS)))
          : 0;
      const bleedingValue = shouldHideData ? null : bleeding.value;

      // Compute simple mode uncertainty range
      const isSimpleModeDay = point.bleedingTrackingMethod === "simple" && point.simpleBleedingIntensity != null;
      let simpleBleedingMin: number | null = 0;
      let simpleBleedingMax: number | null = 0;
      if (shouldHideData) {
        simpleBleedingMin = null;
        simpleBleedingMax = null;
      } else if (isSimpleModeDay && point.simpleBleedingIntensity) {
        const intensityDef = getSimpleBleedingIntensityDefinition(point.simpleBleedingIntensity);
        if (intensityDef) {
          simpleBleedingMin = intensityDef.pbacEquivalentMin;
          simpleBleedingMax = intensityDef.pbacEquivalentMax;
        }
      }

      return {
        ...point,
        bleedingLabel: bleeding.label,
        bleedingValue,
        pbacEquivalent: bleeding.pbacEquivalent,
        simpleBleedingMin,
        simpleBleedingMax,
        isSimpleModeDay,
        dateLabel: formatShortGermanDate(point.date),
        painValue,
        impactValue,
        isCurrentDay: point.date === todayIso,
        painTimeline: point.painTimeline ?? null,
        isFutureDay,
        // Negative value positions dots below the baseline (y=0) in painImpact axis
        predictionDotY: -1.1,
      };
    });
  }, [data.points, todayIso]);

  // Handle tooltip data updates from chart
  const handleTooltipChange = useCallback(
    (props: TooltipContentProps<number, string>) => {
      if (!props.active || !props.payload?.length) {
        setActiveTooltipData(null);
        return null;
      }
      const payload = props.payload[0].payload as CycleOverviewChartPoint;
      setActiveTooltipData(payload);
      return null; // Return null - we render tooltip separately outside the chart container
    },
    []
  );

  // Scroll to today on mount - position today at ~80% from left (some future visible)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const scrollWidth = container.scrollWidth;
    const todayPosition = (data.todayIndex / totalDays) * scrollWidth;
    // Position today at 80% from the left (so ~6 future days visible on right)
    const scrollTarget = todayPosition - containerWidth * 0.8;

    container.scrollLeft = Math.max(0, scrollTarget);
  }, [data.todayIndex, totalDays]);

  // Handle scroll to show/hide "scroll to today" button
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const containerWidth = container.clientWidth;
      const scrollWidth = container.scrollWidth;
      const todayPosition = (data.todayIndex / totalDays) * scrollWidth;
      // Check if today is visible in the current viewport
      const viewStart = container.scrollLeft;
      const viewEnd = container.scrollLeft + containerWidth;
      const todayVisible = todayPosition >= viewStart && todayPosition <= viewEnd;
      setShowScrollToToday(!todayVisible);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [data.todayIndex, totalDays]);

  const scrollToToday = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const scrollWidth = container.scrollWidth;
    const todayPosition = (data.todayIndex / totalDays) * scrollWidth;
    // Position today at 80% from the left (matching initial position)
    const scrollTarget = todayPosition - containerWidth * 0.8;

    container.scrollTo({ left: Math.max(0, scrollTarget), behavior: "smooth" });
  }, [data.todayIndex, totalDays]);

  if (!chartPoints.length) {
    return null;
  }

  // Render tooltip content
  const tooltipContent = activeTooltipData ? (() => {
    const payload = activeTooltipData;
    const timeline = Array.isArray(payload.painTimeline) ? payload.painTimeline : null;
    const hasTimeline = timeline ? timeline.some((segment) => segment.eventCount > 0) : false;

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-lg">
        <p className="font-semibold text-gray-900 mb-2">{payload.dateLabel}</p>
        <div className="space-y-1">
          <p className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS.pain.saturated }} />
            <span>Schmerz: {payload.painNRS}/10</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-0.5 rounded-full bg-amber-400" />
            <span>Beeinträchtigung: {payload.impactNRS ?? "–"}/10</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS.bleeding.saturated }} />
            <span>Blutung: {payload.bleedingLabel}</span>
          </p>
        </div>
        {payload.isBleeding && payload.pbacEquivalent > 0 ? (
          <p className="mt-1 ml-4 text-gray-500">PBAC-Äquivalent: {payload.pbacEquivalent}</p>
        ) : null}
        {payload.bleedingTrackingMethod && payload.isBleeding ? (
          <p className="text-gray-400 text-[10px] ml-4">
            ({getTrackingMethodLabel(payload.bleedingTrackingMethod)})
          </p>
        ) : null}
        {(payload.ovulationPositive || payload.isPredictedOvulationDay) && (
          <div className={cn(
            "mt-2 px-2 py-1.5 rounded-md text-sm",
            payload.ovulationConfidence === 100 || payload.ovulationPositive
              ? "bg-yellow-100 border border-red-300"
              : payload.ovulationConfidence !== null && payload.ovulationConfidence >= 90
                ? "bg-yellow-100 border border-yellow-400"
                : payload.ovulationConfidence !== null && payload.ovulationConfidence >= 61
                  ? "bg-yellow-50 border border-yellow-300"
                  : "bg-gray-50 border border-yellow-200"
          )}>
            <p className="font-medium text-yellow-800">
              {payload.ovulationPositive ? "Eisprung bestätigt (LH+)" : "Eisprung"}
            </p>
            {!payload.ovulationPositive && payload.ovulationMethod && (
              <p className="text-xs text-yellow-700 mt-0.5">
                <span className="font-medium">Methode:</span> {getOvulationMethodLabel(payload.ovulationMethod)}
              </p>
            )}
            {payload.ovulationConfidence !== null && (
              <p className="text-xs text-yellow-700">
                <span className="font-medium">Konfidenz:</span> {payload.ovulationConfidence}%
              </p>
            )}
          </div>
        )}
        {payload.isInPredictedFertileWindow && !payload.isPredictedOvulationDay && !payload.ovulationPositive && (
          <div className="mt-2 px-2 py-1.5 rounded-md bg-pink-50 border border-pink-200 text-sm">
            <p className="font-medium text-pink-700">Fruchtbares Fenster</p>
            <p className="text-xs text-pink-600">5 Tage vor bis 1 Tag nach Eisprung</p>
          </div>
        )}
        {payload.mucusFertilityScore !== null && payload.mucusFertilityScore >= 3 ? (() => {
          const isMucusValidated =
            (payload.ovulationMethod === "mucus" || payload.ovulationMethod === "mucus_pain") &&
            (payload.ovulationConfidence ?? 0) >= 70;
          return (
            <div className={cn(
              "mt-2 px-2 py-1.5 rounded-md text-sm",
              isMucusValidated
                ? (payload.mucusFertilityScore === 4 ? "bg-green-100 border border-green-300" : "bg-green-50 border border-green-200")
                : "bg-gray-50 border border-green-200"
            )}>
              <p className={cn(
                "font-medium",
                isMucusValidated ? "text-green-700" : "text-green-600"
              )}>
                {payload.mucusFertilityScore === 4 ? "Cervixschleim: Peak" : "Cervixschleim: Fruchtbar"}
              </p>
              {!isMucusValidated && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Noch nicht validiert (min. 2 Zyklen nötig)
                </p>
              )}
            </div>
          );
        })() : null}
        {hasTimeline && timeline ? (
          <div className="mt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-purple-400">Schmerz-Tagesverlauf</p>
            <div className="mt-1 flex items-end gap-0.5">
              {timeline.map((segment, index) => {
                const height = 4 + (segment.maxIntensity / 10) * 14;
                const hasMultiple = segment.eventCount > 1;
                return (
                  <span
                    key={`pain-tooltip-bar-${payload.date}-${index}`}
                    className="w-1.5 rounded-full"
                    style={{
                      height,
                      backgroundColor: segment.eventCount > 0 ? CATEGORY_COLORS.pain.saturated : "#e5e7eb",
                      backgroundImage: hasMultiple
                        ? `repeating-linear-gradient(135deg, ${CATEGORY_COLORS.pain.saturated}, ${CATEGORY_COLORS.pain.saturated} 6px, #e9d5ff 6px, #e9d5ff 10px)`
                        : undefined,
                    }}
                    title={
                      segment.eventCount > 0
                        ? `${segment.eventCount} Ereignis${segment.eventCount > 1 ? "se" : ""}`
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  })() : null;

  return (
    <section aria-label="Zyklusübersicht" className="relative">
      {/* Tooltip rendered fixed at top of screen to avoid clipping */}
      {tooltipContent && (
        <div className="fixed top-0 left-1/2 -translate-x-1/2 z-50 pointer-events-none pt-2">
          {tooltipContent}
        </div>
      )}
      <div
        ref={scrollContainerRef}
        className="h-36 w-full overflow-x-auto sm:h-44 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
      >
        <div style={{ width: `${chartWidthMultiplier * 100}%`, minWidth: "100%", height: "100%" }}>
          <ResponsiveContainer>
            <ComposedChart data={chartPoints} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id={bleedingGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CATEGORY_COLORS.bleeding.saturated} stopOpacity={0.45} />
                <stop offset="100%" stopColor={CATEGORY_COLORS.bleeding.saturated} stopOpacity={0.08} />
              </linearGradient>
              {/* Gradient for simple mode uncertainty band */}
              <linearGradient id={`${bleedingGradientId}-simple`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CATEGORY_COLORS.bleeding.saturated} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CATEGORY_COLORS.bleeding.saturated} stopOpacity={0.05} />
              </linearGradient>
              {/* Blur filter for simple mode uncertainty visualization */}
              <filter id={`${bleedingGradientId}-blur`} x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
              </filter>
            </defs>
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#9ca3af", fontSize: 12, fontWeight: 600 }}
              tickFormatter={(value: string | number) =>
                typeof value === "string" ? formatShortGermanDate(value) : ""
              }
              minTickGap={6}
            />
            {/* Extended domains to include space below baseline for prediction dots */}
            <YAxis yAxisId="pbac" domain={[-18, 120]} hide />
            <YAxis yAxisId="painImpact" domain={[-1.5, 10]} hide />
            <Tooltip
              cursor={{ stroke: "#9ca3af", strokeOpacity: 0.2, strokeWidth: 1 }}
              content={handleTooltipChange}
            />
            {/* Simple mode uncertainty band - shows the range of possible values with blur */}
            <Area
              type="monotone"
              dataKey="simpleBleedingMax"
              yAxisId="pbac"
              fill={`url(#${bleedingGradientId}-simple)`}
              stroke={CATEGORY_COLORS.bleeding.saturated}
              strokeWidth={4}
              strokeOpacity={0.3}
              fillOpacity={1}
              name="Blutung (Bereich)"
              isAnimationActive={false}
              style={{ filter: `url(#${bleedingGradientId}-blur)` }}
            />
            <Area
              type="monotone"
              dataKey="bleedingValue"
              yAxisId="pbac"
              fill={`url(#${bleedingGradientId})`}
              stroke={CATEGORY_COLORS.bleeding.saturated}
              strokeWidth={1}
              fillOpacity={1}
              name="Blutung"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="impactValue"
              yAxisId="painImpact"
              stroke="#fcd34d"
              strokeWidth={2}
              dot={false}
              name="Beeinträchtigung"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="painValue"
              yAxisId="painImpact"
              stroke={CATEGORY_COLORS.pain.saturated}
              strokeWidth={2}
              dot={<PainDot />}
              activeDot={{ r: 5, stroke: CATEGORY_COLORS.pain.saturated, fill: "#fff", strokeWidth: 2 }}
              name="Schmerz"
              isAnimationActive={false}
            />
            {/* Prediction indicators - positioned below baseline using negative Y values */}
            <Line
              type="monotone"
              dataKey="predictionDotY"
              yAxisId="painImpact"
              stroke="none"
              dot={<FertileWindowDot />}
              activeDot={false}
              isAnimationActive={false}
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey="predictionDotY"
              yAxisId="painImpact"
              stroke="none"
              dot={<OvulationConfidenceDot />}
              activeDot={false}
              isAnimationActive={false}
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey="predictionDotY"
              yAxisId="painImpact"
              stroke="none"
              dot={<MucusFertilityDot />}
              activeDot={false}
              isAnimationActive={false}
              legendType="none"
            />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      {showScrollToToday && (
        <button
          type="button"
          onClick={scrollToToday}
          className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-md border border-gray-200 hover:bg-white hover:shadow-lg transition-all"
          aria-label="Zu heute scrollen"
        >
          <span>Heute</span>
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </section>
  );
};

const MenstruationComparisonTooltip = ({ active, payload }: TooltipContentProps<number, string>) => {
  if (!active || !payload?.length) {
    return null;
  }

  const data = payload[0].payload as MenstruationComparisonPoint;

  const formatCycleLine = (
    label: string,
    pbac: number | null,
    date?: string,
    pain?: number | null,
    impact?: number | null
  ) => {
    if (pbac === null) return null;
    return (
      <div className="space-y-0.5">
        <p className="font-semibold text-rose-900">{label}</p>
        <p>PBAC: {pbac}</p>
        {typeof pain === "number" ? <p>Schmerz: {pain}/10</p> : null}
        {typeof impact === "number" ? <p>Beeinträchtigung: {impact}/10</p> : null}
        {date ? <p>Datum: {formatShortGermanDate(date)}</p> : null}
      </div>
    );
  };

  return (
    <div className="space-y-2 rounded-lg border border-rose-100 bg-white p-3 text-xs text-rose-700 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">Zyklustag {data.cycleDay}</p>
      {formatCycleLine("Aktueller Zyklus", data.currentPBAC, data.currentDate, data.currentPain, data.currentImpact)}
      {formatCycleLine(
        "Letzter Zyklus",
        data.previousPBAC,
        data.previousDate,
        data.previousPain,
        data.previousImpact
      )}
    </div>
  );
};

const BRISTOL_TYPES = [
  { value: 1, label: "Typ 1" },
  { value: 2, label: "Typ 2" },
  { value: 3, label: "Typ 3" },
  { value: 4, label: "Typ 4" },
  { value: 5, label: "Typ 5" },
  { value: 6, label: "Typ 6" },
  { value: 7, label: "Typ 7" },
] as const;

const MS_PER_DAY = 86_400_000;

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const createEmptyDailyEntry = (date: string): DailyEntry => ({
  date,

  // Neu
  painRegions: [], // noch keine Regionen ausgewählt
  impactNRS: 0, // empfundene Gesamtbeeinträchtigung heute

  // Alt (wird weiter gepflegt, damit Charts usw. funktionieren)
  painNRS: 0,
  painQuality: [],
  painMapRegionIds: [],
  quickPainEvents: [],

  bleeding: { isBleeding: false },
  pbacCounts: createEmptyPbacCounts(),
  symptoms: {},
  rescueMeds: [],
  ovulation: {},
});

const createEmptyMonthlyEntry = (month: string): MonthlyEntry => ({
  month,
  qol: {},
  mental: {},
  promis: {},
});

function normalizeImportedDailyEntry(entry: DailyEntry & Record<string, unknown>): DailyEntry {
  const clone: DailyEntry = { ...entry };
  const extra = clone as unknown as Record<string, unknown>;

  clone.pbacCounts = normalizePbacCounts(entry.pbacCounts);

  const importedBowelPain = (() => {
    const giSource = entry.gi as (DailyEntry["gi"] & { bowelPain?: number }) | undefined;
    return typeof giSource?.bowelPain === "number" ? giSource.bowelPain : undefined;
  })();
  if (typeof importedBowelPain === "number") {
    const normalized = Math.max(0, Math.min(10, Math.round(importedBowelPain)));
    const nextSymptoms: DailyEntry["symptoms"] = { ...(clone.symptoms ?? {}) };
    const existing = nextSymptoms.dyschezia;
    if (!existing) {
      nextSymptoms.dyschezia = { present: true, score: normalized };
    } else if (existing.present && typeof existing.score !== "number") {
      nextSymptoms.dyschezia = { present: true, score: normalized };
    }
    clone.symptoms = nextSymptoms;
  }
  if (clone.gi) {
    const giRecord = { ...(clone.gi as Record<string, unknown>) };
    if ("bowelPain" in giRecord) {
      delete giRecord.bowelPain;
    }
    clone.gi = Object.keys(giRecord).length ? (giRecord as DailyEntry["gi"]) : undefined;
    if (!clone.gi) {
      delete (clone as { gi?: DailyEntry["gi"] }).gi;
    }
  }

  const importedUrinaryPain = (() => {
    const urinarySource = entry.urinary as (DailyEntry["urinary"] & { pain?: number }) | undefined;
    return typeof urinarySource?.pain === "number" ? urinarySource.pain : undefined;
  })();
  if (typeof importedUrinaryPain === "number") {
    const normalized = Math.max(0, Math.min(10, Math.round(importedUrinaryPain)));
    const nextSymptoms: DailyEntry["symptoms"] = { ...(clone.symptoms ?? {}) };
    const existing = nextSymptoms.dysuria;
    if (!existing) {
      nextSymptoms.dysuria = { present: true, score: normalized };
    } else if (existing.present && typeof existing.score !== "number") {
      nextSymptoms.dysuria = { present: true, score: normalized };
    }
    clone.symptoms = nextSymptoms;
  }
  if (clone.urinary) {
    const urinaryRecord = { ...(clone.urinary as Record<string, unknown>) };
    if ("pain" in urinaryRecord) {
      delete urinaryRecord.pain;
    }
    clone.urinary = Object.keys(urinaryRecord).length ? (urinaryRecord as DailyEntry["urinary"]) : undefined;
    if (!clone.urinary) {
      delete (clone as { urinary?: DailyEntry["urinary"] }).urinary;
    }
  }

  const urinaryOpt: NonNullable<DailyEntry["urinaryOpt"]> = { ...(entry.urinaryOpt ?? {}) };
  if (typeof extra["urinary_urgency"] === "number") {
    urinaryOpt.urgency = extra["urinary_urgency"] as number;
  }
  if (typeof extra["urinary_leaks"] === "number") {
    urinaryOpt.leaksCount = extra["urinary_leaks"] as number;
  }
  if (typeof extra["urinary_nocturia"] === "number") {
    urinaryOpt.nocturia = extra["urinary_nocturia"] as number;
  }
  if (Object.keys(urinaryOpt).length) {
    clone.urinaryOpt = urinaryOpt;
  }
  delete extra["urinary_urgency"];
  delete extra["urinary_leaks"];
  delete extra["urinary_nocturia"];

  const headacheOpt: NonNullable<DailyEntry["headacheOpt"]> = { ...(entry.headacheOpt ?? {}) };
  if (typeof extra["headache_present"] === "boolean") {
    headacheOpt.present = extra["headache_present"] as boolean;
  }
  if (typeof extra["headache_nrs"] === "number") {
    headacheOpt.nrs = extra["headache_nrs"] as number;
  }
  if (typeof extra["headache_aura"] === "boolean") {
    headacheOpt.aura = extra["headache_aura"] as boolean;
  }
  if (Object.keys(headacheOpt).length) {
    clone.headacheOpt = headacheOpt;
  }
  delete extra["headache_present"];
  delete extra["headache_nrs"];
  delete extra["headache_aura"];

  const dizzinessOpt: NonNullable<DailyEntry["dizzinessOpt"]> = { ...(entry.dizzinessOpt ?? {}) };
  if (typeof extra["dizziness_present"] === "boolean") {
    dizzinessOpt.present = extra["dizziness_present"] as boolean;
  }
  if (typeof extra["dizziness_nrs"] === "number") {
    dizzinessOpt.nrs = extra["dizziness_nrs"] as number;
  }
  if (typeof extra["dizziness_orthostatic"] === "boolean") {
    dizzinessOpt.orthostatic = extra["dizziness_orthostatic"] as boolean;
  }
  if (Object.keys(dizzinessOpt).length) {
    clone.dizzinessOpt = dizzinessOpt;
  }
  delete extra["dizziness_present"];
  delete extra["dizziness_nrs"];
  delete extra["dizziness_orthostatic"];

  const ovulationPain: NonNullable<DailyEntry["ovulationPain"]> = { ...(entry.ovulationPain ?? {}) };
  const side = extra["ovulation_pain_side"];
  if (typeof side === "string" && ["links", "rechts", "beidseitig", "unsicher"].includes(side)) {
    ovulationPain.side = side as NonNullable<DailyEntry["ovulationPain"]>["side"];
  }
  if (typeof extra["ovulation_pain_intensity"] === "number") {
    ovulationPain.intensity = extra["ovulation_pain_intensity"] as number;
  }
  if (Object.keys(ovulationPain).length) {
    clone.ovulationPain = ovulationPain;
  }
  delete extra["ovulation_pain_side"];
  delete extra["ovulation_pain_intensity"];

  if (Array.isArray(clone.painRegions) && clone.painRegions.length > 0) {
    const allowedQualities = new Set(ALL_PAIN_QUALITIES);
    clone.painRegions = clone.painRegions
      .filter(
        (region): region is NonNullable<DailyEntry["painRegions"]>[number] & Record<string, unknown> =>
          Boolean(region) && typeof region === "object" && typeof region.regionId === "string"
      )
      .map((region) => {
        const normalizedNrs =
          typeof region.nrs === "number" ? Math.max(0, Math.min(10, Math.round(region.nrs))) : 0;
        const normalizedQualities = Array.isArray(region.qualities)
          ? (region.qualities.filter((quality): quality is DailyEntry["painQuality"][number] =>
              allowedQualities.has(quality)
            ) as DailyEntry["painQuality"])
          : ([] as DailyEntry["painQuality"]);

        return {
          regionId: region.regionId,
          nrs: normalizedNrs,
          qualities: normalizedQualities,
        } satisfies NonNullable<DailyEntry["painRegions"]>[number];
      });
  } else {
    const regions = Array.isArray(clone.painMapRegionIds) ? clone.painMapRegionIds : [];
    const allowedQualities = new Set(ALL_PAIN_QUALITIES);
    const qualities = Array.isArray(clone.painQuality)
      ? (clone.painQuality.filter((quality): quality is DailyEntry["painQuality"][number] =>
          allowedQualities.has(quality)
        ) as DailyEntry["painQuality"])
      : ([] as DailyEntry["painQuality"]);
    const normalizedNrs =
      typeof clone.painNRS === "number" ? Math.max(0, Math.min(10, Math.round(clone.painNRS))) : 0;

    clone.painRegions = regions.map((regionId) => ({
      regionId,
      nrs: normalizedNrs,
      qualities: [...qualities],
    }));
  }

  const mergedPainRegions = mergeHeadacheOptIntoPainRegions(clone.painRegions, clone.headacheOpt);
  if (mergedPainRegions) {
    clone.painRegions = mergedPainRegions;
  }
  const derivedHeadache = deriveHeadacheFromPainRegions(clone.painRegions, clone.headacheOpt);
  if (derivedHeadache) {
    clone.headacheOpt = derivedHeadache;
  } else if (clone.headacheOpt) {
    delete (clone as { headacheOpt?: DailyEntry["headacheOpt"] }).headacheOpt;
  }

  // Normalize rescueMeds time field to HH:MM format
  if (Array.isArray(clone.rescueMeds)) {
    clone.rescueMeds = clone.rescueMeds.map((med) => {
      if (!med || typeof med !== "object") return med;
      if (typeof med.time !== "string" || !med.time) return med;

      // Already in HH:MM format
      if (/^\d{2}:\d{2}$/.test(med.time)) return med;

      // Try to extract HH:MM from various formats (e.g., "14:30:00", "2025-01-01T14:30:00Z", etc.)
      const timeMatch = med.time.match(/(\d{2}):(\d{2})/);
      if (timeMatch) {
        return { ...med, time: `${timeMatch[1]}:${timeMatch[2]}` };
      }

      // If we can't parse it, remove the invalid time
      const { time: _, ...rest } = med;
      return rest;
    });
  }

  return applyAutomatedPainSymptoms(normalizeDailyEntry(clone));
}

type RawWeeklyReport = Record<string, unknown> & { stats?: Record<string, unknown> };

function normalizeImportedWeeklyReport(entry: RawWeeklyReport): WeeklyReport | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const isoWeekKey = typeof entry.isoWeekKey === "string" ? entry.isoWeekKey : "";
  const submittedAtRaw = entry.submittedAt;
  const submittedAt =
    typeof submittedAtRaw === "number" && Number.isFinite(submittedAtRaw) ? submittedAtRaw : Date.now();

  const statsSource = entry.stats;
  if (!statsSource || typeof statsSource !== "object") {
    return null;
  }

  const startISO = typeof statsSource.startISO === "string" ? statsSource.startISO : "";
  const endISO = typeof statsSource.endISO === "string" ? statsSource.endISO : "";
  if (!startISO || !endISO) {
    return null;
  }

  const sparkline = Array.isArray(statsSource.sparkline)
    ? statsSource.sparkline
        .map((point) => {
          if (!point || typeof point !== "object") return null;
          const dateISO = typeof (point as { dateISO?: unknown }).dateISO === "string" ? point.dateISO : "";
          if (!dateISO) return null;
          const painValue = (point as { pain?: unknown }).pain;
          const pain = typeof painValue === "number" && Number.isFinite(painValue) ? painValue : null;
          return { dateISO, pain };
        })
        .filter((point): point is { dateISO: string; pain: number | null } => point !== null)
    : [];

  const notesSource = statsSource.notes;
  const notes =
    notesSource && typeof notesSource === "object"
      ? {
          medicationChange: Boolean((notesSource as { medicationChange?: unknown }).medicationChange),
          sleepBelowUsual: Boolean((notesSource as { sleepBelowUsual?: unknown }).sleepBelowUsual),
        }
      : { medicationChange: false, sleepBelowUsual: false };

  const stats: WeeklyReport["stats"] = {
    isoWeekKey:
      typeof statsSource.isoWeekKey === "string" && statsSource.isoWeekKey
        ? statsSource.isoWeekKey
        : isoWeekKey,
    startISO,
    endISO,
    avgPain:
      typeof statsSource.avgPain === "number" && Number.isFinite(statsSource.avgPain)
        ? statsSource.avgPain
        : null,
    maxPain:
      typeof statsSource.maxPain === "number" && Number.isFinite(statsSource.maxPain)
        ? statsSource.maxPain
        : null,
    badDaysCount:
      typeof statsSource.badDaysCount === "number" && Number.isFinite(statsSource.badDaysCount)
        ? Math.max(0, Math.trunc(statsSource.badDaysCount))
        : 0,
    bleedingDaysCount:
      typeof statsSource.bleedingDaysCount === "number" && Number.isFinite(statsSource.bleedingDaysCount)
        ? Math.max(0, Math.trunc(statsSource.bleedingDaysCount))
        : 0,
    sparkline,
    notes,
  };

  const answersSource = entry.answers;
  const answers: PromptAnswers = (() => {
    if (answersSource && typeof answersSource === "object") {
      const wpaiSource = (answersSource as { wpai?: unknown }).wpai;
      return {
        helped: Array.isArray((answersSource as { helped?: unknown }).helped)
          ? ((answersSource as { helped?: unknown }).helped as unknown[]).filter(
              (item): item is string => typeof item === "string"
            )
          : [],
        worsened: Array.isArray((answersSource as { worsened?: unknown }).worsened)
          ? ((answersSource as { worsened?: unknown }).worsened as unknown[]).filter(
              (item): item is string => typeof item === "string"
            )
          : [],
        nextWeekTry: Array.isArray((answersSource as { nextWeekTry?: unknown }).nextWeekTry)
          ? ((answersSource as { nextWeekTry?: unknown }).nextWeekTry as unknown[]).filter(
              (item): item is string => typeof item === "string"
            )
          : [],
        freeText:
          typeof (answersSource as { freeText?: unknown }).freeText === "string"
            ? ((answersSource as { freeText?: unknown }).freeText as string)
            : "",
        wpai: normalizeWpai(
          wpaiSource && typeof wpaiSource === "object"
            ? (wpaiSource as Partial<WeeklyWpai>)
            : undefined
        ),
      };
    }
    return { helped: [], worsened: [], nextWeekTry: [], freeText: "", wpai: normalizeWpai() };
  })();

  const resolvedIsoWeek = stats.isoWeekKey || isoWeekKey;
  if (!resolvedIsoWeek) {
    return null;
  }

  return {
    isoWeekKey: resolvedIsoWeek,
    stats,
    answers,
    submittedAt,
  };
}

function normalizeImportedMonthlyEntry(entry: MonthlyEntry & Record<string, unknown>): MonthlyEntry {
  const normalized: MonthlyEntry = {
    month: typeof entry.month === "string" ? entry.month : "",
  };
  if (entry.qol && typeof entry.qol === "object") {
    const qol = entry.qol as Record<string, unknown>;
    normalized.qol = {
      ehp5Items: Array.isArray(qol.ehp5Items)
        ? (qol.ehp5Items as Array<number | undefined>).map((value) =>
            typeof value === "number" ? value : undefined
          )
        : undefined,
      ehp5Total: typeof qol.ehp5Total === "number" ? (qol.ehp5Total as number) : undefined,
      ehp5Transformed:
        typeof qol.ehp5Transformed === "number" ? (qol.ehp5Transformed as number) : undefined,
    };
  }
  if (entry.mental && typeof entry.mental === "object") {
    const mental = entry.mental as Record<string, unknown>;
    normalized.mental = {
      phq9Items: Array.isArray(mental.phq9Items)
        ? (mental.phq9Items as Array<number | undefined>).map((value) =>
            typeof value === "number" ? value : undefined
          )
        : undefined,
      phq9: typeof mental.phq9 === "number" ? (mental.phq9 as number) : undefined,
      phq9Severity: typeof mental.phq9Severity === "string" ? (mental.phq9Severity as SeverityLevel) : undefined,
      gad7Items: Array.isArray(mental.gad7Items)
        ? (mental.gad7Items as Array<number | undefined>).map((value) =>
            typeof value === "number" ? value : undefined
          )
        : undefined,
      gad7: typeof mental.gad7 === "number" ? (mental.gad7 as number) : undefined,
      gad7Severity: typeof mental.gad7Severity === "string" ? (mental.gad7Severity as SeverityLevel) : undefined,
    };
  }
  if (entry.promis && typeof entry.promis === "object") {
    const promis = entry.promis as Record<string, unknown>;
    normalized.promis = {
      fatigueT: typeof promis.fatigueT === "number" ? (promis.fatigueT as number) : undefined,
      painInterferenceT:
        typeof promis.painInterferenceT === "number" ? (promis.painInterferenceT as number) : undefined,
    };
  }
  return normalized;
}

function computePbacScore(counts: PbacCounts, flooding: boolean) {
  const base = PBAC_ITEMS.reduce((total, item) => total + counts[item.id] * item.score, 0);
  return base + (flooding ? PBAC_FLOODING_SCORE : 0);
}

type SeverityLevel = "mild" | "moderat" | "hoch";

function mapPhqSeverity(score?: number): SeverityLevel | undefined {
  if (typeof score !== "number") return undefined;
  if (score >= 15) return "hoch";
  if (score >= 5) return "moderat";
  return "mild";
}

function mapGadSeverity(score?: number): SeverityLevel | undefined {
  if (typeof score !== "number") return undefined;
  if (score >= 15) return "hoch";
  if (score >= 5) return "moderat";
  return "mild";
}

function severityBadgeClass(level: SeverityLevel) {
  if (level === "hoch") return "bg-rose-200 text-rose-800";
  if (level === "moderat") return "bg-amber-200 text-amber-800";
  return "bg-emerald-200 text-emerald-800";
}

function severityLabel(level: SeverityLevel) {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function AnalyticsTrendTooltip({ active, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as {
    date: string;
    cycleDay: number | null;
    pain: number | null;
    impact: number | null;
    symptomAverage: number | null;
    sleepQuality: number | null;
    steps: number | null;
  };
  return (
    <div className="rounded-lg border border-rose-200 bg-white p-3 text-xs text-rose-700 shadow-sm">
      <p className="font-semibold text-rose-800">{formatShortGermanDate(data.date)}</p>
      <p>Zyklustag: {data.cycleDay ?? "–"}</p>
      <p>Schmerz (NRS): {typeof data.pain === "number" ? data.pain.toFixed(1) : "–"}</p>
      <p>Beeinträchtigung: {typeof data.impact === "number" ? data.impact.toFixed(1) : "–"}</p>
      <p>Symptom-Schnitt: {typeof data.symptomAverage === "number" ? data.symptomAverage.toFixed(1) : "–"}</p>
      <p>{TERMS.sleep_quality.label}: {typeof data.sleepQuality === "number" ? data.sleepQuality.toFixed(1) : "–"}</p>
      <p>Schritte: {typeof data.steps === "number" ? data.steps.toLocaleString("de-DE") : "–"}</p>
    </div>
  );
}

function CheckInHistoryTooltip({ active, payload }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as {
    date: string;
    checkIn: number;
    pain: number | null;
    sleepQuality: number | null;
  };
  return (
    <div className="rounded-lg border border-rose-200 bg-white p-3 text-xs text-rose-700 shadow-sm">
      <p className="font-semibold text-rose-800">{formatShortGermanDate(data.date)}</p>
      <p>Check-in: {data.checkIn ? "erledigt" : "ausgelassen"}</p>
      <p>Schmerz (NRS): {typeof data.pain === "number" ? data.pain.toFixed(1) : "–"}</p>
      <p>{TERMS.sleep_quality.label}: {typeof data.sleepQuality === "number" ? data.sleepQuality.toFixed(1) : "–"}</p>
    </div>
  );
}

function downloadFile(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(",")];
  rows.forEach((row) => {
    const values = headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) return "";
      if (Array.isArray(value)) {
        return `"${value.join(";")}"`;
      }
      return typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : String(value);
    });
    csv.push(values.join(","));
  });
  return csv.join("\n");
}

function escapePdfText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createPdfDocument(title: string, lines: string[]) {
  const contentLines = [title, "", ...lines];
  const textContent = contentLines
    .map((line, index) => `${index === 0 ? "" : "T* "}(${escapePdfText(line || " ")}) Tj`)
    .join("\n");
  const streamBody = `BT\n/F1 12 Tf\n14 TL\n1 0 0 1 50 780 Tm\n${textContent}\nET`;
  const header = "%PDF-1.3\n";
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${streamBody.length} >> stream\n${streamBody}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  let offset = header.length;
  const offsets: number[] = [];
  const body = objects
    .map((obj) => {
      offsets.push(offset);
      const chunk = `${obj}\n`;
      offset += chunk.length;
      return chunk;
    })
    .join("");
  const xrefStart = offset;
  const xrefEntries = offsets
    .map((value) => `${value.toString().padStart(10, "0")} 00000 n `)
    .join("\n");
  const xref = `xref\n0 6\n0000000000 65535 f \n${xrefEntries}\n`;
  const trailer = `trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return `${header}${body}${xref}${trailer}`;
}

export default function HomePage() {
  const today = formatDate(new Date());
  const defaultDailyDraft = useMemo(() => createEmptyDailyEntry(today), [today]);
  const defaultMonthlyDraft = useMemo(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return createEmptyMonthlyEntry(month);
  }, []);
  const [dailyEntries, setDailyEntries, dailyStorage] = usePersistentState<DailyEntry[]>("endo.daily.v2", []);
  const [monthlyEntries, setMonthlyEntries, monthlyStorage] = usePersistentState<MonthlyEntry[]>("endo.monthly.v2", []);
  const [featureFlags, setFeatureFlags, featureStorage] = usePersistentState<FeatureFlags>("endo.flags.v1", {});
  const [dismissedCheckIns, setDismissedCheckIns, dismissedCheckInsStorage] =
    usePersistentState<string[]>("endo.dismissedCheckIns.v1", []);
  const [customRescueMeds, setCustomRescueMeds, _customRescueMedsStorage] =
    usePersistentState<string[]>("endo.rescueMeds.v1", []);
  const [dailyDraft, setDailyDraft, dailyDraftStorage] =
    usePersistentState<DailyEntry>("endo.draft.daily.v1", defaultDailyDraft);
  const [lastSavedDailySnapshot, setLastSavedDailySnapshot] = useState<DailyEntry>(() => createEmptyDailyEntry(today));
  const [pbacCounts, setPbacCountsState] = useState<PbacCounts>(() =>
    normalizePbacCounts(defaultDailyDraft.pbacCounts)
  );
  const derivedDailyEntries = useMemo(
    () => dailyEntries.map((entry) => applyAutomatedPainSymptoms(normalizeDailyEntry(entry))),
    [dailyEntries]
  );
  const dailyEntriesForGraphs = useMemo(() => {
    if (dailyDraft.date !== today) {
      return derivedDailyEntries;
    }

    const normalizedDraft = applyAutomatedPainSymptoms(normalizeDailyEntry(dailyDraft));
    const existingIndex = derivedDailyEntries.findIndex((entry) => entry.date === today);

    if (existingIndex === -1) {
      return [...derivedDailyEntries, normalizedDraft];
    }

    const next = [...derivedDailyEntries];
    next[existingIndex] = normalizedDraft;
    return next;
  }, [dailyDraft, derivedDailyEntries, today]);
  const [sectionCompletionState, setSectionCompletionState, sectionCompletionStorage] =
    usePersistentState<SectionCompletionState>("endo.sectionCompletion.v1", {});
  const [sectionRegistry, setSectionRegistry] = useState<SectionRegistryState>({});
  const setPbacCounts = useCallback(
    (next: PbacCounts | ((prev: PbacCounts) => PbacCounts)) => {
      setPbacCountsState((prev) => {
        const resolved = typeof next === "function" ? (next as (prev: PbacCounts) => PbacCounts)(prev) : next;
        const normalized = normalizePbacCounts(resolved);
        const nextState = arePbacCountsEqual(prev, normalized) ? prev : normalized;
        setDailyDraft((draft) => {
          const draftCounts = normalizePbacCounts(draft.pbacCounts);
          if (arePbacCountsEqual(draftCounts, normalized)) {
            return draft;
          }
          // Check if we're adding counts (not just clearing)
          const hasAnyCounts = Object.values(normalized).some((v) => v > 0);
          // If adding counts, tag with classic PBAC tracking method
          const extendedPbacData = hasAnyCounts
            ? {
                ...(draft.extendedPbacData ?? {}),
                trackingMethod: "pbac_classic" as const,
                extendedEntries: draft.extendedPbacData?.extendedEntries ?? [],
                freeBleedingEntries: draft.extendedPbacData?.freeBleedingEntries ?? [],
              }
            : draft.extendedPbacData;
          return { ...draft, pbacCounts: normalized, extendedPbacData };
        });
        return nextState;
      });
    },
    [setDailyDraft]
  );
  useEffect(() => {
    const normalized = normalizePbacCounts(dailyDraft.pbacCounts);
    setPbacCountsState((prev) => (arePbacCountsEqual(prev, normalized) ? prev : normalized));
    setDailyDraft((draft) => {
      const draftCounts = normalizePbacCounts(draft.pbacCounts);
      if (arePbacCountsEqual(draftCounts, normalized)) {
        return draft;
      }
      return { ...draft, pbacCounts: normalized };
    });
  }, [dailyDraft.pbacCounts, setDailyDraft]);

  // Warn user about unsaved changes when leaving the page
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dailyDraftStorage.isSaving || dailyStorage.isSaving || monthlyStorage.isSaving) {
        event.preventDefault();
        // Modern browsers require returnValue to be set
        event.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dailyDraftStorage.isSaving, dailyStorage.isSaving, monthlyStorage.isSaving]);
  const draftHasBleeding = useMemo(
    () => hasBleedingForEntry({ ...dailyDraft, pbacCounts }),
    [dailyDraft, pbacCounts]
  );
  const bleedingActive = hasBleedingForEntry(dailyDraft);

  // Comprehensive check: does today have any bleeding data (any mode)?
  const todayHasAnyBleedingData = useMemo(() => {
    if (draftHasBleeding) return true;
    // Check simple mode intensity
    if (dailyDraft.simpleBleedingIntensity && dailyDraft.simpleBleedingIntensity !== "none") return true;
    // Check extended PBAC entries
    const extData = dailyDraft.extendedPbacData;
    if (extData) {
      if (extData.extendedEntries && extData.extendedEntries.length > 0) return true;
      if (extData.freeBleedingEntries && extData.freeBleedingEntries.length > 0) return true;
    }
    return false;
  }, [draftHasBleeding, dailyDraft.simpleBleedingIntensity, dailyDraft.extendedPbacData]);

  // Handler to reset today's bleeding data (called when mode changes)
  const handleResetTodayBleedingData = useCallback(() => {
    setPbacCountsState(createEmptyPbacCounts());
    setDailyDraft((prev) => ({
      ...prev,
      bleeding: { isBleeding: false },
      pbacCounts: createEmptyPbacCounts(),
      simpleBleedingIntensity: undefined,
      extendedPbacData: undefined,
    }));
  }, [setDailyDraft]);

  const [activePbacCategory, setActivePbacCategory] = useState<PbacEntryCategory>("pad");
  const [bleedingQuickAddOpen, setBleedingQuickAddOpen] = useState(false);
  const [pendingBleedingQuickAdd, setPendingBleedingQuickAdd] = useState<PbacProductItemId | null>(null);
  const [bleedingQuickAddNotice, setBleedingQuickAddNotice] = useState<BleedingQuickAddNotice | null>(null);
  const [painQuickAddOpen, setPainQuickAddOpen] = useState(false);
  const [painQuickContext, setPainQuickContext] = useState<"shortcut" | "module">("shortcut");
  const [painQuickStep, setPainQuickStep] = useState<1 | 2 | 3>(1);
  const [painQuickRegion, setPainQuickRegion] = useState<string | null>(null);
  const [painQuickQualities, setPainQuickQualities] = useState<DailyEntry["painQuality"]>([]);
  const [painQuickIntensity, setPainQuickIntensity] = useState(5);
  const [painQuickTimesOfDay, setPainQuickTimesOfDay] = useState<PainTimeOfDay[]>([]);
  const [pendingPainQuickAdd, setPendingPainQuickAdd] = useState<PendingQuickPainAdd | null>(null);
  const updateQuickPainEventsForDate = useCallback(
    (date: string, updater: (events: QuickPainEvent[]) => QuickPainEvent[]) => {
      const normalizeEvents = (events: QuickPainEvent[]) =>
        sortQuickPainEvents(events.map((event) => normalizeQuickPainEvent(event)));

      setDailyEntries((entries) => {
        const nextEntries = [...entries];
        const existingIndex = nextEntries.findIndex((entry) => entry.date === date);
        const baseEntry = existingIndex === -1 ? createEmptyDailyEntry(date) : nextEntries[existingIndex];
        const nextEvents = normalizeEvents(updater(baseEntry.quickPainEvents ?? []));
        const updatedEntry = normalizeDailyEntry({ ...baseEntry, quickPainEvents: nextEvents });
        if (existingIndex === -1) {
          nextEntries.push(updatedEntry);
        } else {
          nextEntries[existingIndex] = updatedEntry;
        }
        return nextEntries;
      });

      setDailyDraft((draft) => {
        if (draft.date !== date) {
          return draft;
        }
        const nextEvents = normalizeEvents(updater(draft.quickPainEvents ?? []));
        return normalizeDailyEntry({ ...draft, quickPainEvents: nextEvents });
      });
    },
    [setDailyDraft, setDailyEntries]
  );
  const quickPainEvents = useMemo(
    () => derivedDailyEntries.flatMap((entry) => entry.quickPainEvents ?? []),
    [derivedDailyEntries]
  );
  const quickPainEventsByDate = useMemo(() => {
    const grouped = new Map<string, QuickPainEvent[]>();
    quickPainEvents.forEach((event) => {
      const list = grouped.get(event.date) ?? [];
      list.push(event);
      grouped.set(event.date, sortQuickPainEvents(list));
    });
    return grouped;
  }, [quickPainEvents]);
  const [rescueWizard, setRescueWizard] = useState<
    | { step: 1 | 2 | 3; name?: string; doseMg?: number; time?: string }
    | null
  >(null);
  const [customRescueName, setCustomRescueName] = useState("");
  const rescueMedOptions = useMemo(
    () => Array.from(new Set<string>([...STANDARD_RESCUE_MEDS, ...customRescueMeds])).sort(),
    [customRescueMeds]
  );
  const bleedingQuickAddNoticeTimeoutRef = useRef<number | null>(null);
  const updatePbacCount = useCallback(
    (itemId: (typeof PBAC_ITEMS)[number]["id"], nextValue: number, max = PBAC_MAX_PRODUCT_COUNT) => {
      setPbacCounts((prev) => {
        const clampedValue = Math.min(max, Math.max(0, nextValue));
        if (prev[itemId] === clampedValue) {
          return prev;
        }
        return { ...prev, [itemId]: clampedValue };
      });
    },
    [setPbacCounts]
  );

  // Handler for adding extended bleeding entries
  const handleAddExtendedBleedingEntry = useCallback(
    (entry: ExtendedBleedingEntry | FreeBleedingEntry) => {
      setDailyDraft((prev) => {
        const currentExtendedData: ExtendedPbacData = prev.extendedPbacData ?? {
          trackingMethod: "pbac_extended",
          extendedEntries: [],
          freeBleedingEntries: [],
        };

        let updatedData: ExtendedPbacData;
        if ("intensity" in entry) {
          // FreeBleedingEntry
          updatedData = {
            ...currentExtendedData,
            trackingMethod: "pbac_extended",
            freeBleedingEntries: [...(currentExtendedData.freeBleedingEntries ?? []), entry],
          };
        } else {
          // ExtendedBleedingEntry
          updatedData = {
            ...currentExtendedData,
            trackingMethod: "pbac_extended",
            extendedEntries: [...(currentExtendedData.extendedEntries ?? []), entry],
          };
        }

        // Recalculate totals
        const { totalVolumeMl, totalPbacEquivalent } = aggregateExtendedPbacData(updatedData, prev.pbacCounts);
        updatedData.totalEstimatedVolumeMl = totalVolumeMl;
        updatedData.totalPbacEquivalentScore = totalPbacEquivalent;

        return {
          ...prev,
          extendedPbacData: updatedData,
          bleeding: {
            ...prev.bleeding,
            isBleeding: true,
            pbacScore: totalPbacEquivalent,
          },
        };
      });
    },
    [setDailyDraft]
  );

  // Handler for removing extended bleeding entries
  const handleRemoveExtendedBleedingEntry = useCallback(
    (entryId: string) => {
      setDailyDraft((prev) => {
        if (!prev.extendedPbacData) return prev;

        const updatedData: ExtendedPbacData = {
          ...prev.extendedPbacData,
          extendedEntries: (prev.extendedPbacData.extendedEntries ?? []).filter((e) => e.id !== entryId),
          freeBleedingEntries: (prev.extendedPbacData.freeBleedingEntries ?? []).filter((e) => e.id !== entryId),
        };

        // Recalculate totals
        const { totalVolumeMl, totalPbacEquivalent } = aggregateExtendedPbacData(updatedData, prev.pbacCounts);
        updatedData.totalEstimatedVolumeMl = totalVolumeMl;
        updatedData.totalPbacEquivalentScore = totalPbacEquivalent;

        const hasEntries =
          (updatedData.extendedEntries?.length ?? 0) > 0 ||
          (updatedData.freeBleedingEntries?.length ?? 0) > 0;

        return {
          ...prev,
          extendedPbacData: updatedData,
          bleeding: {
            ...prev.bleeding,
            isBleeding: hasEntries || (prev.bleeding?.isBleeding ?? false),
            pbacScore: totalPbacEquivalent,
          },
        };
      });
    },
    [setDailyDraft]
  );

  useEffect(() => {
    if (!draftHasBleeding) {
      setActivePbacCategory("pad");
    }
  }, [draftHasBleeding]);

  useEffect(() => {
    const updateNow = () => setCurrentTime(new Date());
    updateNow();
    const interval = window.setInterval(updateNow, 60_000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const todaysPainShortcutEvents = useMemo(
    () => quickPainEventsByDate.get(today) ?? [],
    [quickPainEventsByDate, today]
  );

  const painShortcutTimelineByDate = useMemo<
    Partial<Record<string, PainShortcutTimelineSegment[]>>
  >(() => {
    const timelines: Partial<Record<string, PainShortcutTimelineSegment[]>> = {};
    quickPainEventsByDate.forEach((events, date) => {
      timelines[date] = computePainShortcutTimeline(events);
    });
    return timelines;
  }, [quickPainEventsByDate]);

  const painShortcutTimeline = useMemo(
    () => computePainShortcutTimeline(todaysPainShortcutEvents),
    [todaysPainShortcutEvents]
  );

  const painShortcutEventsForDraftDate = useMemo(
    () => quickPainEventsByDate.get(dailyDraft.date) ?? [],
    [dailyDraft.date, quickPainEventsByDate]
  );

  const sortedPainShortcutEvents = useMemo(
    () => sortQuickPainEvents(painShortcutEventsForDraftDate),
    [painShortcutEventsForDraftDate]
  );

  const latestPainShortcutEvent = todaysPainShortcutEvents.length
    ? todaysPainShortcutEvents[todaysPainShortcutEvents.length - 1]
    : null;
  const quickPainQualityOptions = useMemo(
    () => (painQuickRegion === HEAD_REGION_ID ? ALL_PAIN_QUALITIES : PAIN_QUALITIES),
    [painQuickRegion]
  );
  const quickPainRegionLabel = useMemo(
    () => (painQuickRegion ? getRegionLabel(painQuickRegion) : null),
    [painQuickRegion]
  );
  const quickPainQualityLabel = useMemo(
    () => (painQuickQualities.length ? formatList(painQuickQualities, 3) : null),
    [painQuickQualities]
  );
  const painQuickTimeLabel = useMemo(
    () => formatPainTimeOfDayList(painQuickTimesOfDay),
    [painQuickTimesOfDay]
  );
  useEffect(() => {
    return () => {
      if (bleedingQuickAddNoticeTimeoutRef.current) {
        window.clearTimeout(bleedingQuickAddNoticeTimeoutRef.current);
      }
    };
  }, []);
  const [dailyCategorySnapshots, setDailyCategorySnapshots] = useState<
    Partial<Record<TrackableDailyCategoryId, string>>
  >({});
  const [dailyCategoryDirtyState, setDailyCategoryDirtyState] = useState<
    Partial<Record<TrackableDailyCategoryId, boolean>>
  >({});
  const [sensorsVisible, setSensorsVisible] = useState(false);
  const [exploratoryVisible, setExploratoryVisible] = useState(false);
  const [notesTagDraft, setNotesTagDraft] = useState("");
  const [painQualityOther, setPainQualityOther] = useState("");
  const analyticsRangeOptions = [30, 60, 90] as const;
  type AnalyticsRangeOption = (typeof analyticsRangeOptions)[number];

  const [analyticsRangeDays, setAnalyticsRangeDays] = useState<AnalyticsRangeOption>(30);
  const [visibleTrendMetrics, setVisibleTrendMetrics] = useState<TrendMetricKey[]>([
    "pain",
    "impact",
    "symptomAverage",
    "sleepQuality",
    "steps",
  ]);
  const toggleTrendMetric = useCallback((metric: TrendMetricKey) => {
    setVisibleTrendMetrics((previous) => {
      const isActive = previous.includes(metric);
      if (isActive) {
        if (previous.length === 1) {
          return previous;
        }
        return previous.filter((item) => item !== metric);
      }
      return [...previous, metric];
    });
  }, []);
  const [dailySaveNotice, setDailySaveNotice] = useState<string | null>(null);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [weeklyReportsReady, setWeeklyReportsReady] = useState(false);
  const [weeklyReportsError, setWeeklyReportsError] = useState<string | null>(null);
  const [weeklyReportsRevision, setWeeklyReportsRevision] = useState(0);
  const [weeklyIsoWeek, setWeeklyIsoWeek] = useState<string | null>(null);

  const [monthlyDraft, setMonthlyDraft, monthlyDraftStorage] =
    usePersistentState<MonthlyEntry>("endo.draft.monthly.v1", defaultMonthlyDraft);

  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const draftStatusTimeoutRef = useRef<number | null>(null);
  const draftRestoredRef = useRef(false);
  const lastDraftSavedAtRef = useRef<number | null>(null);
  const manualDailySelectionRef = useRef(false);
  const detailToolbarRef = useRef<HTMLElement | null>(null);
  const dailyDateInputRef = useRef<HTMLInputElement | null>(null);
  const previousDailyDateRef = useRef(dailyDraft.date);
  const previousDailyScopeRef = useRef<string | null>(null);
  const previousDailyCategoryCompletionRef = useRef<Record<TrackableDailyCategoryId, boolean>>(
    createEmptyCategoryCompletion()
  );

  const isBirthdayGreetingDay = () => {
    const now = new Date();
    return now.getFullYear() === 2025 && now.getMonth() === 10 && now.getDate() === 10;
  };
  const [showBirthdayGreeting, setShowBirthdayGreeting] = useState(isBirthdayGreetingDay);
  const [pendingCategoryConfirm, setPendingCategoryConfirm] =
    useState<TrackableDailyCategoryId | null>(null);
  const [pendingOverviewConfirm, setPendingOverviewConfirm] =
    useState<PendingOverviewConfirm | null>(null);
  const heartGradientReactId = useId();
  const heartGradientId = useMemo(
    () => `heart-gradient-${heartGradientReactId.replace(/:/g, "")}`,
    [heartGradientReactId]
  );

  const storageMetas = [
    dailyStorage,
    monthlyStorage,
    featureStorage,
    sectionCompletionStorage,
    dailyDraftStorage,
    monthlyDraftStorage,
    dismissedCheckInsStorage,
  ];
  const storageReady = storageMetas.every((meta) => meta.ready);
  const storageErrors = storageMetas.map((meta) => meta.error).filter(Boolean) as string[];
  const storageDrivers = Array.from(new Set(storageMetas.map((meta) => meta.driverLabel)));
  const usesIndexedDb = storageMetas.every((meta) => meta.driver === "indexeddb");
  const hasMemoryFallback = storageMetas.some((meta) => meta.driver === "memory");
  const storageUnavailable = storageMetas.some((meta) => meta.driver === "unavailable");

  useEffect(() => {
    if (!dailyDraftStorage.ready) return;
    setDailyDraft((draft) => {
      const normalized = normalizeDailyEntry(draft);
      return normalized === draft ? draft : normalized;
    });
  }, [dailyDraftStorage.ready, setDailyDraft]);

  useEffect(() => {
    if (!dailyDraftStorage.ready) return;
    if (dailyDraftStorage.restored && !draftRestoredRef.current) {
      draftRestoredRef.current = true;
      setDraftStatus("Wiederhergestellt");
    }
  }, [dailyDraftStorage.ready, dailyDraftStorage.restored]);

  useEffect(() => {
    if (!dailyDraftStorage.ready) return;
    if (!dailyDraftStorage.lastSavedAt) return;
    if (lastDraftSavedAtRef.current && dailyDraftStorage.lastSavedAt <= lastDraftSavedAtRef.current) {
      return;
    }
    lastDraftSavedAtRef.current = dailyDraftStorage.lastSavedAt;
    setDraftStatus("Entwurf gespeichert");
  }, [dailyDraftStorage.lastSavedAt, dailyDraftStorage.ready]);

  useEffect(() => {
    if (!draftStatus) return;
    if (typeof window === "undefined") return;
    if (draftStatusTimeoutRef.current) {
      window.clearTimeout(draftStatusTimeoutRef.current);
    }
    draftStatusTimeoutRef.current = window.setTimeout(() => setDraftStatus(null), 2500);
    return () => {
      if (draftStatusTimeoutRef.current) {
        window.clearTimeout(draftStatusTimeoutRef.current);
        draftStatusTimeoutRef.current = null;
      }
    };
  }, [draftStatus]);

  useEffect(() => {
    let cancelled = false;
    setWeeklyReportsReady(false);
    setWeeklyReportsError(null);
    listWeeklyReports()
      .then((reports) => {
        if (cancelled) return;
        setWeeklyReports(reports);
        setWeeklyReportsReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Wöchentliche Berichte konnten nicht geladen werden", error);
        setWeeklyReportsReady(true);
        setWeeklyReportsError("Wöchentliche Berichte konnten nicht geladen werden.");
      });
    return () => {
      cancelled = true;
    };
  }, [weeklyReportsRevision]);

  const refreshWeeklyReports = useCallback(() => {
    setWeeklyReportsRevision((prev) => prev + 1);
  }, []);

  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [detailToolbarHeight, setDetailToolbarHeight] = useState<number>(DETAIL_TOOLBAR_FALLBACK_HEIGHT);
  const [activeView, setActiveView] = useState<"home" | "daily" | "weekly" | "monthly" | "analytics">("home");
  const [analyticsActiveSection, setAnalyticsActiveSection] = useState<AnalyticsSectionKey>("progress");
  const [timeCorrelationAlignment, setTimeCorrelationAlignment] = useState<CycleAlignmentMode>("period");
  const [timeCorrelationView, setTimeCorrelationView] = useState<CycleViewMode>("last");
  const [expandedLocationGroups, setExpandedLocationGroups] = useState<Set<string>>(new Set());
  const [bleedingCyclesExpanded, setBleedingCyclesExpanded] = useState(false);
  const [symptomCyclesExpanded, setSymptomCyclesExpanded] = useState<Record<string, boolean>>({});
  const [gesamtCyclesExpanded, setGesamtCyclesExpanded] = useState(false);
  const [correlationTooltip, setCorrelationTooltip] = useState<{ day: number; label: string; value: string; details?: string } | null>(null);
  const [dailyActiveCategory, setDailyActiveCategory] = useState<DailyCategoryId>("overview");
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [persistWarning, setPersistWarning] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
  const [showCheckInPopup, setShowCheckInPopup] = useState(false);
  const [pendingDismissCheckIn, setPendingDismissCheckIn] = useState<PendingCheckIn | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPage, setSettingsPage] = useState<"main" | "ovulation" | "bleeding" | "colorScheme" | "products">("main");
  const [productSettings, setProductSettings] = useState<ProductSettings>(DEFAULT_PRODUCT_SETTINGS);
  const [colorScheme, setColorScheme, colorSchemeMeta] = usePersistentState<ColorScheme>(
    "endo-color-scheme",
    "neutral"
  );

  // Load product settings on mount
  useEffect(() => {
    loadProductSettings().then(setProductSettings);
  }, []);

  // Apply color scheme to document
  useEffect(() => {
    if (!colorSchemeMeta.ready) return;
    if (colorScheme === "neutral") {
      document.documentElement.setAttribute("data-theme", "neutral");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [colorScheme, colorSchemeMeta.ready]);

  const isDailyDirty = useMemo(
    () =>
      !equalWithNullUndefined(
        normalizeDailyEntry(dailyDraft),
        normalizeDailyEntry(lastSavedDailySnapshot)
      ),
    [dailyDraft, lastSavedDailySnapshot]
  );

  const hasEntryForSelectedDate = useMemo(
    () => dailyEntries.some((entry) => entry.date === dailyDraft.date),
    [dailyEntries, dailyDraft.date]
  );

  const hasDailyEntryForToday = useMemo(
    () => dailyEntries.some((entry) => entry.date === today),
    [dailyEntries, today]
  );

  const dailyScopeKey = dailyDraft.date ? `daily:${dailyDraft.date}` : null;

  const { dailySectionCompletion, resolvedDailyScopeKey } = useDailySectionCompletion({
    dailyScopeKey,
    sectionCompletionState,
    sectionCompletionStorage,
  });

  const sectionCompletionContextValue = useMemo<SectionCompletionContextValue>(
    () => ({
      getCompletion: (scope, key) => {
        if (scope === null || scope === undefined) return false;
        const scopeKey = String(scope);
        if (scopeKey === resolvedDailyScopeKey) {
          return Boolean(dailySectionCompletion[key]);
        }
        return Boolean(sectionCompletionState[scopeKey]?.[key]);
      },
      setCompletion: (scope, key, completed) => {
        if (scope === null || scope === undefined) return;
        setSectionCompletionState((prev) => {
          const scopeKey = String(scope);
          const prevForScope = prev[scopeKey] ?? {};
          if (completed) {
            return {
              ...prev,
              [scopeKey]: { ...prevForScope, [key]: true },
            };
          }
          const { [key]: _removed, ...restForScope } = prevForScope;
          if (Object.keys(restForScope).length === 0) {
            const { [scopeKey]: _scopeRemoved, ...rest } = prev;
            return rest;
          }
          return {
            ...prev,
            [scopeKey]: restForScope,
          };
        });
      },
      registerSection: (scope, key) => {
        if (scope === null || scope === undefined) return;
        const scopeKey = String(scope);
        setSectionRegistry((prev) => {
          const prevForScope = prev[scopeKey] ?? {};
          if (prevForScope[key]) {
            return prev;
          }
          return {
            ...prev,
            [scopeKey]: { ...prevForScope, [key]: true },
          };
        });
      },
      unregisterSection: (scope, key) => {
        if (scope === null || scope === undefined) return;
        const scopeKey = String(scope);
        setSectionRegistry((prev) => {
          const prevForScope = prev[scopeKey];
          if (!prevForScope || !prevForScope[key]) {
            return prev;
          }
          const { [key]: _removed, ...restForScope } = prevForScope;
          if (Object.keys(restForScope).length === 0) {
            const { [scopeKey]: _scopeRemoved, ...restScopes } = prev;
            return restScopes;
          }
          return {
            ...prev,
            [scopeKey]: restForScope,
          };
        });
      },
    }),
    [
      dailySectionCompletion,
      resolvedDailyScopeKey,
      sectionCompletionState,
      setSectionCompletionState,
      setSectionRegistry,
    ]
  );

  const selectDailyDate = useCallback(
    (targetDate: string, options?: { manual?: boolean }) => {
      if (options?.manual) {
        manualDailySelectionRef.current = true;
      }
      const existingEntry = derivedDailyEntries.find((entry) => entry.date === targetDate);
      let baseEntry = existingEntry ?? createEmptyDailyEntry(targetDate);
      const clonedEntry =
        typeof structuredClone === "function"
          ? structuredClone(baseEntry)
          : (JSON.parse(JSON.stringify(baseEntry)) as DailyEntry);
      const normalizedPbacCounts = normalizePbacCounts(clonedEntry.pbacCounts);
      setPbacCountsState((prev) =>
        arePbacCountsEqual(prev, normalizedPbacCounts) ? prev : normalizedPbacCounts
      );
      const nextDraft = { ...clonedEntry, pbacCounts: normalizedPbacCounts };
      setDailyDraft(nextDraft);
      setLastSavedDailySnapshot(nextDraft);
    },
    [derivedDailyEntries, setDailyDraft, setLastSavedDailySnapshot, setPbacCountsState]
  );

  useEffect(() => {
    if (!storageReady) return;
    if (manualDailySelectionRef.current) return;
    if (isDailyDirty) return;
    if (dailyDraft.date >= today) return;
    const hasDraftEntry = derivedDailyEntries.some((entry) => entry.date === dailyDraft.date);
    if (hasDraftEntry) return;
    selectDailyDate(today);
  }, [storageReady, isDailyDirty, dailyDraft.date, derivedDailyEntries, today, selectDailyDate]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("storage" in navigator) || !navigator.storage) {
      setPersisted(null);
      setPersistWarning("Persistent Storage API nicht verfügbar.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const alreadyPersisted = await navigator.storage.persisted();
        if (cancelled) return;
        setPersisted(alreadyPersisted);
        if (alreadyPersisted) {
          setPersistWarning(null);
          return;
        }
        if (typeof navigator.storage.persist === "function") {
          const granted = await navigator.storage.persist();
          if (cancelled) return;
          setPersisted(granted);
          setPersistWarning(granted ? null : "Persistente Speicherung konnte nicht aktiviert werden.");
        } else {
          setPersistWarning("Persistent Storage API unterstützt kein persist().");
        }
      } catch (error) {
        if (cancelled) return;
        setPersisted(false);
        setPersistWarning((error as Error).message ?? "Persistente Speicherung nicht möglich.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!window.isSecureContext && window.location.hostname !== "localhost") return;
    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => console.warn("Service Worker Registrierung fehlgeschlagen", error));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = window.navigator as Navigator & { standalone?: boolean };

    const updateStandalone = () => {
      const standalone = Boolean(window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone);
      setIsStandalone(standalone);
      if (!standalone) {
        setShowInstallHint(true);
      }
    };

    updateStandalone();

    const media = window.matchMedia?.("(display-mode: standalone)");
    const handleMediaChange = () => updateStandalone();
    if (media) {
      if (typeof media.addEventListener === "function") {
        media.addEventListener("change", handleMediaChange);
      } else if (typeof media.addListener === "function") {
        media.addListener(handleMediaChange);
      }
    }

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      setInstallPrompt(promptEvent);
      setShowInstallHint(true);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setShowInstallHint(false);
      updateStandalone();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      if (media) {
        if (typeof media.removeEventListener === "function") {
          media.removeEventListener("change", handleMediaChange);
        } else if (typeof media.removeListener === "function") {
          media.removeListener(handleMediaChange);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let lastWrite = 0;
    const performTouch = () => {
      const now = Date.now();
      if (now - lastWrite < 60000) return;
      lastWrite = now;
      touchLastActive(now).catch((error) => console.warn("Keepalive fehlgeschlagen", error));
    };
    const pointerHandler = () => performTouch();
    const keyHandler = () => performTouch();
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        performTouch();
      }
    };
    document.addEventListener("pointerdown", pointerHandler, { passive: true });
    document.addEventListener("keydown", keyHandler);
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => {
      document.removeEventListener("pointerdown", pointerHandler);
      document.removeEventListener("keydown", keyHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--endo-bg", hasEntryForSelectedDate ? SAVED_PAGE_BG : DEFAULT_PAGE_BG);
    return () => {
      root.style.setProperty("--endo-bg", DEFAULT_PAGE_BG);
    };
  }, [hasEntryForSelectedDate]);

  const selectedDateLabel = useMemo(() => {
    const parsed = parseIsoDate(dailyDraft.date);
    if (!parsed) return null;
    return parsed.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [dailyDraft.date]);

  const annotatedDailyEntries = useMemo(() => {
    const entriesWithPain = dailyEntriesForGraphs.map((entry) => {
      const maxPain = computeMaxPainIntensity(entry);
      if (maxPain === null || entry.painNRS === maxPain) {
        return entry;
      }
      return { ...entry, painNRS: maxPain };
    });
    const sorted = entriesWithPain.slice().sort((a, b) => a.date.localeCompare(b.date));
    let cycleState = createInitialCycleComputationState();
    return sorted.map((entry) => {
      const bleedingActive = hasBleedingForEntry(entry);
      const bleeding = entry.bleeding ?? { isBleeding: false };
      const normalizedEntry =
        bleeding.isBleeding === bleedingActive ? entry : { ...entry, bleeding: { ...bleeding, isBleeding: bleedingActive } };
      const currentDate = new Date(entry.date);
      const computation = computeCycleDayForEntry(cycleState, normalizedEntry);
      cycleState = computation.state;
      const assignedCycleDay = computation.cycleDay;
      const weekday = currentDate.toLocaleDateString("de-DE", { weekday: "short" });
      const symptomScores = Object.values(entry.symptoms ?? {}).flatMap((symptom) => {
        if (!symptom || !symptom.present) return [] as number[];
        return typeof symptom.score === "number" ? [symptom.score] : [];
      });
      const symptomAverage = symptomScores.length
        ? symptomScores.reduce((sum, value) => sum + value, 0) / symptomScores.length
        : null;
      return {
        entry: normalizedEntry,
        cycleDay: assignedCycleDay,
        weekday,
        symptomAverage,
      };
    });
  }, [dailyEntriesForGraphs]);

  // Cycle start dates - extracted early for use in prediction calculations
  const cycleStartDates = useMemo(() => {
    return annotatedDailyEntries
      .filter(({ cycleDay, entry }) => cycleDay === 1 && entry.date <= today)
      .map(({ entry }) => entry.date);
  }, [annotatedDailyEntries, today]);

  // Completed cycle lengths - for prediction calculations
  const completedCycleLengths = useMemo(() => {
    const lengths: number[] = [];
    for (let index = 0; index < cycleStartDates.length - 1; index += 1) {
      const current = parseIsoDate(cycleStartDates[index]);
      const next = parseIsoDate(cycleStartDates[index + 1]);
      if (!current || !next) {
        continue;
      }
      const diffDays = Math.round((next.getTime() - current.getTime()) / MS_PER_DAY);
      if (diffDays > 0) {
        lengths.push(diffDays);
      }
    }
    return lengths;
  }, [cycleStartDates]);

  // Shared cycle ovulation data - single source of truth for all ovulation calculations
  // Computed once and consumed by cycleAnalysis, cycleOverview, and timeCorrelationData
  const cycleOvulationData = useMemo((): CycleOvulationData | null => {
    if (cycleStartDates.length === 0) return null;

    // Build raw cycle data with entries
    const rawCycles: Array<{
      startDate: string;
      endDate: string | null;
      length: number;
      isCompleted: boolean;
      entries: Array<{ cycleDay: number; entry: DailyEntry }>;
    }> = [];

    for (let i = 0; i < cycleStartDates.length; i += 1) {
      const cycleStart = cycleStartDates[i];
      const cycleEnd = cycleStartDates[i + 1] ?? null;
      const isCompleted = cycleEnd !== null;

      const length = isCompleted
        ? Math.round((new Date(cycleEnd).getTime() - new Date(cycleStart).getTime()) / MS_PER_DAY)
        : annotatedDailyEntries.filter(({ entry }) => entry.date >= cycleStart).length || 14;

      const entries = annotatedDailyEntries
        .filter(({ entry, cycleDay }) => {
          if (!cycleDay) return false;
          if (entry.date < cycleStart) return false;
          if (cycleEnd && entry.date >= cycleEnd) return false;
          return true;
        })
        .map(({ entry, cycleDay }) => ({ cycleDay: cycleDay!, entry }));

      rawCycles.push({
        startDate: cycleStart,
        endDate: cycleEnd,
        length,
        isCompleted,
        entries,
      });
    }

    // Count completed cycles with mucus data for confidence calculation
    // Billings method requires >= 2 completed cycles with mucus for full confidence
    const completedCyclesWithMucus = rawCycles.filter(cycle => {
      if (!cycle.isCompleted) return false;
      return cycle.entries.some(({ entry }) =>
        entry.cervixMucus?.observation || entry.cervixMucus?.appearance
      );
    }).length;

    // First pass: calculate ovulation for completed cycles without personal luteal phase
    // This is needed to bootstrap the personal luteal phase calculation
    const firstPassResults: Array<{
      cycleLength: number;
      ovulationDay: number;
      confidence: number;
      method: OvulationResult["method"];
    }> = [];

    for (const cycle of rawCycles) {
      if (cycle.isCompleted) {
        const result = calculateOvulationForCycle(
          cycle.entries,
          cycle.startDate,
          cycle.length,
          {
            useBillingsMethod: featureFlags.billingMethod ?? false,
            isCompletedCycle: true,
            personalLutealPhase: null,
            completedCyclesWithMucus,
          }
        );
        firstPassResults.push({
          cycleLength: cycle.length,
          ovulationDay: result.ovulationDay,
          confidence: result.confidence,
          method: result.method,
        });
      }
    }

    // Calculate personal luteal phase from high-confidence detections
    const personalLutealPhase = calculatePersonalLutealPhase(firstPassResults);

    // Second pass: build final cycle data with personal luteal phase
    const cycles: CycleOvulationData["cycles"] = [];
    const cycleOvulationMap = new Map<string, { ovulationDay: number; cycleStart: string; cycleEnd: string | null; confidence: number; method: OvulationResult["method"] }>();
    const completedCycleResults: CycleOvulationData["completedCycleResults"] = [];

    for (const cycle of rawCycles) {
      const result = calculateOvulationForCycle(
        cycle.entries,
        cycle.startDate,
        cycle.length,
        {
          useBillingsMethod: featureFlags.billingMethod ?? false,
          isCompletedCycle: cycle.isCompleted,
          personalLutealPhase,
          completedCyclesWithMucus,
        }
      );

      cycles.push({
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        length: cycle.length,
        isCompleted: cycle.isCompleted,
        ovulationDay: result.ovulationDay,
        ovulationConfidence: result.confidence,
        ovulationMethod: result.method,
        entries: cycle.entries,
      });

      cycleOvulationMap.set(cycle.startDate, {
        ovulationDay: result.ovulationDay,
        cycleStart: cycle.startDate,
        cycleEnd: cycle.endDate,
        confidence: result.confidence,
        method: result.method,
      });

      if (cycle.isCompleted) {
        completedCycleResults.push({
          cycleLength: cycle.length,
          ovulationDay: result.ovulationDay,
          confidence: result.confidence,
          method: result.method,
        });
      }
    }

    return {
      cycles,
      personalLutealPhase,
      cycleOvulationMap,
      completedCycleResults,
    };
  }, [annotatedDailyEntries, cycleStartDates, featureFlags.billingMethod]);

  // Consolidated cycle analysis - uses shared cycleOvulationData
  const cycleAnalysis = useMemo(() => {
    const todayDate = parseIsoDate(today);
    if (!cycleOvulationData || completedCycleLengths.length === 0 || !todayDate) {
      return null;
    }

    const recentLengths = completedCycleLengths.slice(-3);
    const averageCycleLength = Math.round(
      recentLengths.reduce((sum, v) => sum + v, 0) / recentLengths.length
    );

    if (!Number.isFinite(averageCycleLength) || averageCycleLength <= 14) {
      return null;
    }

    // Use shared completed cycle results from cycleOvulationData
    const { completedCycleResults, personalLutealPhase } = cycleOvulationData;

    // Calculate predicted ovulation day using confidence-weighted average
    // from recent cycles (last 3-6)
    const recentResults = completedCycleResults.slice(-6);
    let predictedOvulationDay: number;
    let usingAdvancedMethod = false;

    if (recentResults.length > 0) {
      const totalWeight = recentResults.reduce((sum, r) => sum + r.confidence, 0);
      const weightedSum = recentResults.reduce(
        (sum, r) => sum + r.ovulationDay * r.confidence, 0
      );
      predictedOvulationDay = Math.round(weightedSum / totalWeight);

      // Check if we're using advanced methods (mucus, pain, or personal luteal)
      usingAdvancedMethod = recentResults.some(r =>
        r.method === "mucus" || r.method === "mucus_pain" ||
        r.method === "pain" || r.method === "personal_luteal"
      );
    } else {
      // Fallback to standard calculation
      predictedOvulationDay = averageCycleLength - 14;
    }

    const { fertileStart, fertileEnd } = calculateFertileWindow(predictedOvulationDay);
    const lastCycleStartDate = cycleStartDates[cycleStartDates.length - 1];

    // Current cycle position
    const lastStart = parseIsoDate(lastCycleStartDate);
    const currentCycleDay = lastStart
      ? Math.floor((todayDate.getTime() - lastStart.getTime()) / MS_PER_DAY) + 1
      : null;

    const daysUntilOvulation = currentCycleDay !== null
      ? predictedOvulationDay - currentCycleDay
      : null;

    return {
      predictedOvulationDay,
      fertileStart,
      fertileEnd,
      lastCycleStartDate,
      averageCycleLength,
      cycleCount: recentLengths.length,
      currentCycleDay,
      daysUntilOvulation,
      isOvulationDay: currentCycleDay === predictedOvulationDay,
      isInFertileWindow: currentCycleDay !== null &&
        currentCycleDay >= fertileStart &&
        currentCycleDay <= fertileEnd,
      usingBillingsMethod: usingAdvancedMethod,
      billingMethodEnabled: featureFlags.billingMethod ?? false,
      personalLutealPhase,
    };
  }, [cycleOvulationData, cycleStartDates, completedCycleLengths, featureFlags.billingMethod, today]);

  // Billings method progress tracking - shows user how much data is needed for confident predictions
  const billingsProgress = useMemo(() => {
    if (!featureFlags.billingMethod || !cycleOvulationData) {
      return null;
    }

    // Count completed cycles that have cervix mucus data
    const completedCyclesWithMucus = cycleOvulationData.cycles.filter(cycle => {
      if (!cycle.isCompleted) return false;
      return cycle.entries.some(({ entry }) =>
        entry.cervixMucus?.observation || entry.cervixMucus?.appearance
      );
    }).length;

    // Count days with mucus observations in current cycle
    const currentCycle = cycleOvulationData.cycles.find(c => !c.isCompleted);
    const daysWithMucusInCurrentCycle = currentCycle
      ? currentCycle.entries.filter(({ entry }) =>
          entry.cervixMucus?.observation || entry.cervixMucus?.appearance
        ).length
      : 0;

    // Need 2 completed cycles with mucus data for improved predictions
    const cyclesNeeded = 2;
    const hasEnoughData = completedCyclesWithMucus >= cyclesNeeded;

    return {
      completedCyclesWithMucus,
      cyclesNeeded,
      daysWithMucusInCurrentCycle,
      hasEnoughData,
    };
  }, [featureFlags.billingMethod, cycleOvulationData]);

  const selectedCycleDay = useMemo(() => {
    if (!dailyDraft.date) return null;
    const entries = derivedDailyEntries.slice();
    const draftIndex = entries.findIndex((entry) => entry.date === dailyDraft.date);
    if (draftIndex >= 0) {
      if (isDailyDirty) {
        entries[draftIndex] = dailyDraft;
      }
    } else {
      entries.push(dailyDraft);
    }
    const sorted = entries.slice().sort((a, b) => a.date.localeCompare(b.date));
    let cycleState = createInitialCycleComputationState();
    let lastCycleDay: number | null = null;
    for (const entry of sorted) {
      const computation = computeCycleDayForEntry(cycleState, entry);
      cycleState = computation.state;
      lastCycleDay = computation.cycleDay;
      if (entry.date === dailyDraft.date) {
        return computation.cycleDay;
      }
    }
    return lastCycleDay;
  }, [derivedDailyEntries, dailyDraft, isDailyDirty]);

  const cycleOverview = useMemo((): CycleOverviewData | null => {
    const todayDate = parseIsoDate(today);
    if (!todayDate) {
      return null;
    }

    // Start from PAST_DAYS ago
    const startDate = new Date(todayDate);
    startDate.setDate(startDate.getDate() - CYCLE_OVERVIEW_PAST_DAYS);

    // Use shared cycle ovulation map - create a local copy to handle ongoing cycle override
    const localOvulationMap = new Map(cycleOvulationData?.cycleOvulationMap ?? []);

    // For ongoing cycle, override with cycleAnalysis prediction (weighted average)
    // This ensures the current cycle uses the best prediction based on historical data
    if (cycleStartDates.length > 0 && cycleOvulationData) {
      const lastCycleStart = cycleStartDates[cycleStartDates.length - 1];
      const lastCycleData = cycleOvulationData.cycles.find(c => c.startDate === lastCycleStart);

      if (lastCycleData && !lastCycleData.isCompleted && cycleAnalysis?.predictedOvulationDay) {
        localOvulationMap.set(lastCycleStart, {
          ovulationDay: cycleAnalysis.predictedOvulationDay,
          cycleStart: lastCycleStart,
          cycleEnd: null,
          confidence: lastCycleData.ovulationConfidence,
          method: lastCycleData.ovulationMethod,
        });
      }
    }

    // Helper to get ovulation data for a specific date
    const getOvulationDataForDate = (dateStr: string): { ovulationDay: number; confidence: number; method: OvulationResult["method"] } | null => {
      // Find which cycle this date belongs to
      for (let i = cycleStartDates.length - 1; i >= 0; i -= 1) {
        const cycleStart = cycleStartDates[i];
        const cycleEnd = cycleStartDates[i + 1] ?? null;

        if (dateStr >= cycleStart && (cycleEnd === null || dateStr < cycleEnd)) {
          const cycleData = localOvulationMap.get(cycleStart);
          if (cycleData) {
            return {
              ovulationDay: cycleData.ovulationDay,
              confidence: cycleData.confidence,
              method: cycleData.method,
            };
          }
          return null;
        }
      }
      return null;
    };

    // Build prediction function using per-cycle ovulation
    const getPredictionForDate = (dateStr: string, cycleDay: number | null) => {
      if (cycleDay === null) {
        return { isPredictedOvulationDay: false, isInPredictedFertileWindow: false, ovulationMethod: null as OvulationResult["method"] | null, ovulationConfidence: null as number | null };
      }

      const ovulationData = getOvulationDataForDate(dateStr);
      if (ovulationData === null) {
        return { isPredictedOvulationDay: false, isInPredictedFertileWindow: false, ovulationMethod: null as OvulationResult["method"] | null, ovulationConfidence: null as number | null };
      }

      return {
        isPredictedOvulationDay: cycleDay === ovulationData.ovulationDay,
        isInPredictedFertileWindow: isFertileDay(cycleDay, ovulationData.ovulationDay),
        ovulationMethod: ovulationData.method,
        ovulationConfidence: ovulationData.confidence,
      };
    };

    const pointsByDate = new Map<string, CycleOverviewPoint>();
    annotatedDailyEntries.forEach(({ entry, cycleDay }) => {
      const { isPredictedOvulationDay, isInPredictedFertileWindow, ovulationMethod, ovulationConfidence } =
        getPredictionForDate(entry.date, cycleDay);
      const mucusScore = featureFlags.billingMethod
        ? scoreCervixMucusFertility(entry.cervixMucus)
        : null;
      // If LH+ confirmed, set confidence to 100%
      const isLhConfirmed = Boolean(entry.ovulation?.lhPositive);
      pointsByDate.set(entry.date, {
        date: entry.date,
        cycleDay: cycleDay ?? null,
        painNRS: entry.painNRS ?? 0,
        impactNRS: entry.impactNRS ?? null,
        pbacScore: entry.extendedPbacData?.trackingMethod === "pbac_extended"
          ? entry.extendedPbacData?.totalPbacEquivalentScore ?? null
          : entry.bleeding?.pbacScore ?? null,
        isBleeding: hasBleedingForEntry(entry),
        bleedingTrackingMethod: entry.extendedPbacData?.trackingMethod ?? null,
        simpleBleedingIntensity: entry.simpleBleedingIntensity ?? null,
        ovulationPositive: Boolean(entry.ovulation?.lhPositive),
        ovulationPainIntensity: entry.ovulationPain?.intensity ?? null,
        painTimeline: null,
        isPredictedOvulationDay,
        isInPredictedFertileWindow,
        mucusFertilityScore: mucusScore,
        ovulationMethod: isLhConfirmed ? null : ovulationMethod,
        ovulationConfidence: isLhConfirmed ? 100 : ovulationConfidence,
      });
    });

    const points: CycleOverviewPoint[] = [];
    const totalDays = CYCLE_OVERVIEW_PAST_DAYS + CYCLE_OVERVIEW_FUTURE_DAYS + 1; // +1 for today
    for (let dayOffset = 0; dayOffset < totalDays; dayOffset += 1) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + dayOffset);
      const iso = formatDate(currentDate);
      const existing = pointsByDate.get(iso);
      const timeline = painShortcutTimelineByDate[iso] ?? null;
      if (existing) {
        points.push({ ...existing, painTimeline: timeline });
      } else {
        // For dates without entries, calculate prediction from date position
        let isPredictedOvulationDay = false;
        let isInPredictedFertileWindow = false;
        let ovulationMethod: OvulationResult["method"] | null = null;
        let ovulationConfidence: number | null = null;

        // Find which cycle this date belongs to and get its ovulation data
        const ovulationData = getOvulationDataForDate(iso);
        if (ovulationData !== null) {
          // Calculate cycle day for this date
          for (let i = cycleStartDates.length - 1; i >= 0; i -= 1) {
            const cycleStart = cycleStartDates[i];
            const cycleEnd = cycleStartDates[i + 1] ?? null;

            if (iso >= cycleStart && (cycleEnd === null || iso < cycleEnd)) {
              const cycleStartDate = parseIsoDate(cycleStart);
              if (cycleStartDate) {
                const diffMs = currentDate.getTime() - cycleStartDate.getTime();
                if (diffMs >= 0) {
                  const cycleDay = Math.floor(diffMs / MS_PER_DAY) + 1;
                  isPredictedOvulationDay = cycleDay === ovulationData.ovulationDay;
                  isInPredictedFertileWindow = isFertileDay(cycleDay, ovulationData.ovulationDay);
                  ovulationMethod = ovulationData.method;
                  ovulationConfidence = ovulationData.confidence;
                }
              }
              break;
            }
          }
        }

        points.push({
          date: iso,
          cycleDay: null,
          painNRS: 0,
          impactNRS: null,
          pbacScore: null,
          isBleeding: false,
          bleedingTrackingMethod: null,
          simpleBleedingIntensity: null,
          ovulationPositive: false,
          ovulationPainIntensity: null,
          painTimeline: timeline,
          isPredictedOvulationDay,
          isInPredictedFertileWindow,
          mucusFertilityScore: null,
          ovulationMethod,
          ovulationConfidence,
        });
      }
    }

    return {
      startDate: formatDate(startDate),
      points,
      todayIndex: CYCLE_OVERVIEW_PAST_DAYS, // Today is at this index (0-based)
    };
  }, [annotatedDailyEntries, cycleAnalysis, cycleOvulationData, cycleStartDates, featureFlags.billingMethod, painShortcutTimelineByDate, today]);

  const canGoToNextDay = useMemo(() => dailyDraft.date < today, [dailyDraft.date, today]);

  const currentIsoWeek = useMemo(() => {
    const parsedToday = parseIsoDate(today);
    return parsedToday ? dateToIsoWeek(parsedToday) : dateToIsoWeek(new Date());
  }, [today]);

  const currentMonth = useMemo(() => today.slice(0, 7), [today]);
  const todayDate = useMemo(() => parseIsoDate(today), [today]);
  const todayLabel = useMemo(() => {
    if (!todayDate) return null;
    return todayDate.toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [todayDate]);

  const isSunday = useMemo(() => {
    if (!todayDate) return false;
    return todayDate.getDay() === 0;
  }, [todayDate]);

  const pendingCheckInDates = useMemo(() => {
    if (!todayDate) return [] as { iso: string; date: Date }[];
    const dates: { iso: string; date: Date }[] = [];
    for (let offset = 0; offset < 5; offset += 1) {
      const date = new Date(todayDate);
      date.setDate(todayDate.getDate() - offset);
      dates.push({ iso: formatDate(date), date });
    }
    return dates;
  }, [todayDate]);

  const formatPendingDateLabel = useCallback((date: Date) => {
    return date.toLocaleDateString("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
  }, []);

  const selectedMonthLabel = useMemo(() => {
    const monthDate = monthToDate(monthlyDraft.month);
    if (!monthDate) return null;
    return monthDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  }, [monthlyDraft.month]);

  const dailyToolbarDateLabel = useMemo(() => {
    const parsed = parseIsoDate(dailyDraft.date);
    return parsed
      ? parsed.toLocaleDateString("de-DE", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
        })
      : null;
  }, [dailyDraft.date]);

  const isSelectedDateToday = useMemo(() => dailyDraft.date === today, [dailyDraft.date, today]);

  // Determine effective tracking method for the bleeding section
  // For historical entries with data, use the mode they were entered in
  // Otherwise use the current productSettings
  const effectiveBleedingTrackingMethod = useMemo(() => {
    // If entry has extendedPbacData with a trackingMethod, use it
    const entryMethod = dailyDraft.extendedPbacData?.trackingMethod;
    if (entryMethod) {
      return entryMethod;
    }
    // For entries without extendedPbacData (legacy or new), use current setting
    return productSettings.trackingMethod;
  }, [dailyDraft.extendedPbacData?.trackingMethod, productSettings.trackingMethod]);

  // Check if we're viewing data entered with a different mode than current setting
  const isViewingDifferentBleedingMode = useMemo(() => {
    const entryMethod = dailyDraft.extendedPbacData?.trackingMethod;
    // Only show badge if entry has data AND the mode differs from current setting
    if (!entryMethod) return false;
    return entryMethod !== productSettings.trackingMethod && todayHasAnyBleedingData;
  }, [dailyDraft.extendedPbacData?.trackingMethod, productSettings.trackingMethod, todayHasAnyBleedingData]);

  const dailyToolbarLabel = useMemo(() => {
    const categoryLabels: Record<DailyCategoryId, string> = {
      overview: "Check-in Übersicht",
      cervixMucus: "Cervixschleim",
      pain: "Schmerzen",
      symptoms: "Symptome",
      bleeding: "Blutung",
      medication: "Medikation",
      sleep: "Schlaf",
      bowelBladder: "Darm & Blase",
      notes: "Notizen",
      optional: "Optionale Werte",
    };
    const baseLabel = categoryLabels[dailyActiveCategory] ?? null;
    if (baseLabel && dailyToolbarDateLabel) {
      return `${baseLabel} · ${dailyToolbarDateLabel}`;
    }
    return baseLabel ?? dailyToolbarDateLabel;
  }, [dailyActiveCategory, dailyToolbarDateLabel]);

  const weeklyScopeIsoWeek = weeklyIsoWeek ?? currentIsoWeek;

  const weeklyToolbarLabel = useMemo(
    () => formatIsoWeekCompactLabel(weeklyScopeIsoWeek),
    [weeklyScopeIsoWeek]
  );

  const monthlyToolbarLabel = useMemo(() => {
    const monthDate = monthToDate(monthlyDraft.month || currentMonth);
    if (!monthDate) return null;
    return monthDate.toLocaleDateString("de-DE", { month: "short", year: "numeric" });
  }, [monthlyDraft.month, currentMonth]);

  const toolbarLabel = useMemo(() => {
    if (activeView === "daily") return dailyToolbarLabel;
    if (activeView === "weekly") return weeklyToolbarLabel;
    if (activeView === "monthly") return monthlyToolbarLabel;
    if (activeView === "analytics") return "Auswertungen";
    return null;
  }, [activeView, dailyToolbarLabel, monthlyToolbarLabel, weeklyToolbarLabel]);

  const isDailyOverview = activeView === "daily" && dailyActiveCategory === "overview";
  const dailyOverviewDateLabel = useMemo(
    () => (isDailyOverview ? dailyToolbarDateLabel : null),
    [dailyToolbarDateLabel, isDailyOverview]
  );
  const cycleDayBadgeLabel =
    selectedCycleDay !== null ? `Zyklustag ${selectedCycleDay}` : "Zyklustag –";

  const activeScopeKey = useMemo(() => {
    if (activeView === "daily") {
      return resolvedDailyScopeKey;
    }
    if (activeView === "weekly") {
      return `weekly:${weeklyScopeIsoWeek}`;
    }
    if (activeView === "monthly") {
      const monthKey = monthlyDraft.month || currentMonth;
      return monthKey ? `monthly:${monthKey}` : null;
    }
    if (activeView === "analytics") {
      return "analytics";
    }
    return null;
  }, [activeView, currentMonth, monthlyDraft.month, resolvedDailyScopeKey, weeklyScopeIsoWeek]);

  const activeScopeProgress = useMemo(() => {
    if (!activeScopeKey) {
      return { completed: 0, total: 0 };
    }
    const registry = sectionRegistry[activeScopeKey];
    const total = registry ? Object.keys(registry).length : 0;
    if (!registry || total === 0) {
      return { completed: 0, total: 0 };
    }
    const completions = sectionCompletionState[activeScopeKey] ?? {};
    const completed = Object.keys(registry).filter((key) => Boolean(completions[key])).length;
    return { completed, total };
  }, [activeScopeKey, sectionCompletionState, sectionRegistry]);

  const canGoToNextMonth = useMemo(() => {
    const baseMonth = monthlyDraft.month || currentMonth;
    return baseMonth < currentMonth;
  }, [monthlyDraft.month, currentMonth]);

  const hasWeeklyReportForCurrentWeek = useMemo(
    () => weeklyReports.some((report) => report.isoWeekKey === currentIsoWeek),
    [weeklyReports, currentIsoWeek]
  );

  const hasMonthlyEntryForCurrentMonth = useMemo(
    () => monthlyEntries.some((entry) => entry.month === currentMonth),
    [monthlyEntries, currentMonth]
  );

  const latestWeeklyReport = useMemo(
    () =>
      weeklyReports.reduce<WeeklyReport | null>((latest, report) => {
        if (!latest || report.submittedAt > latest.submittedAt) {
          return report;
        }
        return latest;
      }, null),
    [weeklyReports]
  );

  const daysUntilWeeklySuggested = useMemo(() => {
    if (!todayDate) return null;
    const startOfToday = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    if (!latestWeeklyReport) {
      const daysUntilSunday = (7 - startOfToday.getDay()) % 7;
      return daysUntilSunday;
    }
    const lastCompleted = new Date(latestWeeklyReport.submittedAt);
    const startOfLast = new Date(
      lastCompleted.getFullYear(),
      lastCompleted.getMonth(),
      lastCompleted.getDate()
    );
    const nextDue = new Date(startOfLast);
    nextDue.setDate(nextDue.getDate() + 7);
    const diffMs = nextDue.getTime() - startOfToday.getTime();
    const diffDays = Math.ceil(diffMs / MS_PER_DAY);
    return diffDays > 0 ? diffDays : 0;
  }, [todayDate, latestWeeklyReport]);

  const weeklyInfoText = useMemo(() => {
    if (daysUntilWeeklySuggested === null) {
      return "Starte, wann immer du bereit bist";
    }
    if (daysUntilWeeklySuggested <= 0) {
      return "Heute wieder ausfüllen";
    }
    if (daysUntilWeeklySuggested === 1) {
      return "In 1 Tag wieder ausfüllen";
    }
    return `In ${daysUntilWeeklySuggested} Tagen wieder ausfüllen`;
  }, [daysUntilWeeklySuggested]);

  const attemptSelectDailyDate = useCallback(
    (targetDate: string, options?: { manual?: boolean }) => {
      if (targetDate === dailyDraft.date) {
        return;
      }
      if (
        activeView === "daily" &&
        dailyActiveCategory === "overview" &&
        isDailyDirty
      ) {
        setPendingOverviewConfirm({ action: "change-date", targetDate, options });
        return;
      }
      selectDailyDate(targetDate, options);
    },
    [
      activeView,
      dailyActiveCategory,
      dailyDraft.date,
      isDailyDirty,
      selectDailyDate,
      setPendingOverviewConfirm,
    ]
  );

  const goToPreviousDay = useCallback(() => {
    const base = parseIsoDate(dailyDraft.date || today);
    if (!base) return;
    base.setDate(base.getDate() - 1);
    attemptSelectDailyDate(formatDate(base), { manual: true });
  }, [attemptSelectDailyDate, dailyDraft.date, today]);

  const goToNextDay = useCallback(() => {
    const currentDate = dailyDraft.date || today;
    if (currentDate >= today) {
      return;
    }
    const base = parseIsoDate(currentDate);
    if (!base) return;
    base.setDate(base.getDate() + 1);
    const nextDate = formatDate(base);
    if (nextDate > today) return;
    attemptSelectDailyDate(nextDate, { manual: true });
  }, [attemptSelectDailyDate, dailyDraft.date, today]);

  const openDailyDatePicker = useCallback(() => {
    const input = dailyDateInputRef.current;
    if (!input) return;
    const picker = (input as HTMLInputElement & { showPicker?: () => void }).showPicker;
    if (typeof picker === "function") {
      picker.call(input);
      return;
    }
    input.focus();
    input.click();
  }, []);

  const goToPreviousMonth = useCallback(() => {
    setMonthlyDraft((prev) => {
      const baseMonth = prev.month || currentMonth;
      const baseDate = monthToDate(baseMonth);
      if (!baseDate) return prev;
      baseDate.setUTCMonth(baseDate.getUTCMonth() - 1);
      const nextMonth = `${baseDate.getUTCFullYear()}-${String(baseDate.getUTCMonth() + 1).padStart(2, "0")}`;
      return { ...prev, month: nextMonth };
    });
  }, [currentMonth, setMonthlyDraft]);

  const goToNextMonth = useCallback(() => {
    setMonthlyDraft((prev) => {
      const baseMonth = prev.month || currentMonth;
      if (baseMonth >= currentMonth) {
        return prev;
      }
      const baseDate = monthToDate(baseMonth);
      if (!baseDate) return prev;
      baseDate.setUTCMonth(baseDate.getUTCMonth() + 1);
      const nextMonth = `${baseDate.getUTCFullYear()}-${String(baseDate.getUTCMonth() + 1).padStart(2, "0")}`;
      if (nextMonth > currentMonth) {
        return prev;
      }
      return { ...prev, month: nextMonth };
    });
  }, [currentMonth, setMonthlyDraft]);

  const hasEntryForSelectedMonth = useMemo(
    () => monthlyEntries.some((entry) => entry.month === monthlyDraft.month),
    [monthlyEntries, monthlyDraft.month]
  );

  const activeUrinary = Boolean(featureFlags.moduleUrinary);
  const activeHeadache = Boolean(featureFlags.moduleHeadache);
  const activeDizziness = Boolean(featureFlags.moduleDizziness);
  const dyscheziaSymptom = dailyDraft.symptoms.dyschezia;
  const dysuriaSymptom = dailyDraft.symptoms.dysuria;
  const deepDyspareuniaSymptom = dailyDraft.symptoms.deepDyspareunia ?? { present: false };
  const ovulationPainDraft = dailyDraft.ovulationPain ?? {};
  const [deepDyspareuniaCardOpen, setDeepDyspareuniaCardOpen] = useState(
    () => deepDyspareuniaSymptom.present
  );
  const [ovulationPainCardOpen, setOvulationPainCardOpen] = useState(
    () => Boolean(dailyDraft.ovulationPain)
  );
  const deepDyspareuniaSummary = deepDyspareuniaSymptom.present
    ? `Stärke ${Math.max(0, Math.min(10, Math.round(deepDyspareuniaSymptom.score ?? 0)))}/10`
    : "Auswählen";
  const ovulationPainSummary = ovulationPainDraft.side
    ? `${OVULATION_PAIN_SIDE_LABELS[ovulationPainDraft.side]}${
        typeof ovulationPainDraft.intensity === "number"
          ? ` · Intensität ${Math.max(0, Math.min(10, Math.round(ovulationPainDraft.intensity)))}/10`
          : ""
      }`
    : "Auswählen";

  useEffect(() => {
    if (previousDailyDateRef.current !== dailyDraft.date) {
      previousDailyDateRef.current = dailyDraft.date;
      setDeepDyspareuniaCardOpen(deepDyspareuniaSymptom.present);
      setOvulationPainCardOpen(Boolean(dailyDraft.ovulationPain));
    }
  }, [dailyDraft.date, deepDyspareuniaSymptom.present, dailyDraft.ovulationPain]);

  useEffect(() => {
    if (deepDyspareuniaSymptom.present) {
      setDeepDyspareuniaCardOpen(true);
    }
  }, [deepDyspareuniaSymptom.present]);

  useEffect(() => {
    if (dailyDraft.ovulationPain) {
      setOvulationPainCardOpen(true);
    }
  }, [dailyDraft.ovulationPain]);

  const pbacFloodingToggleId = useId();
  const pbacFlooding = dailyDraft.bleeding.flooding ?? false;
  const pbacScore = useMemo(() => computePbacScore(pbacCounts, pbacFlooding), [pbacCounts, pbacFlooding]);
  const pbacProductSummary = useMemo(
    () =>
      PBAC_PRODUCT_ITEMS.map((item) => ({
        ...item,
        count: pbacCounts[item.id] ?? 0,
      })),
    [pbacCounts]
  );
  const pbacClotSummary = useMemo(
    () =>
      PBAC_CLOT_ITEMS.map((item) => ({
        ...item,
        count: pbacCounts[item.id] ?? 0,
      })),
    [pbacCounts]
  );
  const hasPbacSummaryData =
    pbacProductSummary.some((item) => item.count > 0) ||
    pbacClotSummary.some((item) => item.count > 0) ||
    pbacFlooding;
  const hasExtendedPbacEntries =
    (dailyDraft.extendedPbacData?.extendedEntries?.length ?? 0) > 0 ||
    (dailyDraft.extendedPbacData?.freeBleedingEntries?.length ?? 0) > 0;
  const hasSimpleBleedingData =
    dailyDraft.simpleBleedingIntensity && dailyDraft.simpleBleedingIntensity !== "none";
  const showPbacSummaryInToolbar =
    activeView === "daily" &&
    dailyActiveCategory === "bleeding" &&
    (draftHasBleeding || hasExtendedPbacEntries || hasSimpleBleedingData);

  const renderPbacSummaryPanel = () => {
    const isExtendedMode = effectiveBleedingTrackingMethod === "pbac_extended";
    const isSimpleMode = effectiveBleedingTrackingMethod === "simple";
    const displayScore = isExtendedMode
      ? dailyDraft.extendedPbacData?.totalPbacEquivalentScore ?? 0
      : isSimpleMode
        ? getSimpleBleedingPbacEquivalent(dailyDraft.simpleBleedingIntensity ?? "none")
        : pbacScore;
    const displayVolume = dailyDraft.extendedPbacData?.totalEstimatedVolumeMl ?? 0;

    // Get simple mode intensity label
    const simpleIntensityDef = isSimpleMode && dailyDraft.simpleBleedingIntensity
      ? SIMPLE_BLEEDING_INTENSITIES.find((i) => i.id === dailyDraft.simpleBleedingIntensity)
      : null;

    // Determine title based on mode
    const panelTitle = isSimpleMode
      ? "Blutungsübersicht"
      : isExtendedMode
        ? "Blutungsübersicht"
        : "PBAC-Assistent";

    return (
      <div className="rounded-xl border border-rose-100 bg-white/80 p-3 text-[11px] text-rose-700 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-rose-500">
          <span>{panelTitle}</span>
          {isExtendedMode && displayVolume > 0 && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] text-rose-700">
              ~{displayVolume} ml
            </span>
          )}
          {isSimpleMode && simpleIntensityDef && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] text-rose-700">
              {simpleIntensityDef.label}
            </span>
          )}
          {displayScore > 0 && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] text-rose-700">
              {isSimpleMode ? "PBAC-Äquiv." : isExtendedMode ? "PBAC-Äquiv." : "Score"}: {displayScore}
            </span>
          )}
        </div>

        {/* Extended PBAC entries */}
        {isExtendedMode && hasExtendedPbacEntries ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              {dailyDraft.extendedPbacData?.extendedEntries?.map((entry) => {
                const product = getProductById(productSettings, entry.productId);
                const productName = product?.nameShort || product?.name || entry.productId;
                const fillLabel = FILL_LEVEL_LABELS[entry.fillLevelPercent] || `${entry.fillLevelPercent}%`;
                return (
                  <span
                    key={entry.id}
                    className="inline-flex items-center gap-2 rounded-full bg-rose-50/80 px-3 py-1 text-[11px] font-medium text-rose-800"
                  >
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                      {fillLabel}
                    </span>
                    <span className="text-rose-700">{productName}</span>
                    <span className="text-rose-500">~{entry.estimatedVolumeMl}ml</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveExtendedBleedingEntry(entry.id)}
                      className="rounded-full p-1 text-rose-400 transition hover:bg-rose-100 hover:text-rose-700"
                      aria-label="Eintrag entfernen"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </span>
                );
              })}
              {dailyDraft.extendedPbacData?.freeBleedingEntries?.map((entry) => {
                const intensityLabel = FREE_BLEEDING_INTENSITY_LABELS[entry.intensity as keyof typeof FREE_BLEEDING_INTENSITY_LABELS]?.label || entry.intensity;
                return (
                  <span
                    key={entry.id}
                    className="inline-flex items-center gap-2 rounded-full bg-rose-50/80 px-3 py-1 text-[11px] font-medium text-rose-800"
                  >
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                      {intensityLabel}
                    </span>
                    <span className="text-rose-700">Freies Bluten</span>
                    <span className="text-rose-500">~{entry.estimatedVolumeMl}ml</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveExtendedBleedingEntry(entry.id)}
                      className="rounded-full p-1 text-rose-400 transition hover:bg-rose-100 hover:text-rose-700"
                      aria-label="Eintrag entfernen"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Classic PBAC entries */}
        {!isExtendedMode && hasPbacSummaryData ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {pbacProductSummary
              .filter((item) => item.count > 0)
              .map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-2 rounded-full bg-rose-50/80 px-3 py-1 text-[11px] font-medium text-rose-800"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-500">
                    <item.Icon className="h-3 w-3" aria-hidden />
                  </span>
                  <span>{item.count}× {item.label}</span>
                  <span className="text-rose-500">+{item.count * item.score}</span>
                </span>
              ))}
            {pbacClotSummary
              .filter((item) => item.count > 0)
              .map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-2 rounded-full bg-rose-50/80 px-3 py-1 text-[11px] font-medium text-rose-800"
                >
                  <span>{item.count}× {item.label}</span>
                  <span className="text-rose-500">+{item.count * item.score}</span>
                </span>
              ))}
            {pbacFlooding ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-50/80 px-3 py-1 text-[11px] font-semibold text-rose-800">
                <span>Flooding</span>
                <span className="text-rose-500">+{PBAC_FLOODING_SCORE}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Empty state - only show for PBAC modes, not for simple mode */}
        {!isSimpleMode && !isExtendedMode && !hasPbacSummaryData && (
          <p className="mt-2 text-xs text-rose-600">Füge unten Produkte hinzu, um deinen Score zu berechnen.</p>
        )}
        {!isSimpleMode && isExtendedMode && !hasExtendedPbacEntries && (
          <p className="mt-2 text-xs text-rose-600">Füge unten Produkte hinzu, um deine Blutung zu erfassen.</p>
        )}
      </div>
    );
  };
  const painSummaryRegions = useMemo(
    () =>
      (dailyDraft.painRegions ?? []).map((region) => ({
        id: region.regionId,
        label: getRegionLabel(region.regionId),
        intensity:
          typeof region.nrs === "number" ? Math.max(0, Math.min(10, Math.round(region.nrs))) : null,
        qualities: (region.qualities ?? []).filter(Boolean),
      })),
    [dailyDraft.painRegions]
  );
  const painSummaryMaxIntensity = useMemo(() => {
    const intensities = painSummaryRegions
      .map((region) => region.intensity)
      .filter((value): value is number => typeof value === "number");
    if (!intensities.length) {
      return null;
    }
    return Math.max(...intensities);
  }, [painSummaryRegions]);
  const hasPainSummaryData = painSummaryRegions.length > 0;
  const hasAcutePainEvents = sortedPainShortcutEvents.length > 0;
  const hasAnyPainSummaryData = hasPainSummaryData || hasAcutePainEvents;
  const showPainSummaryInToolbar =
    activeView === "daily" && dailyActiveCategory === "pain" && hasAnyPainSummaryData;
  const renderPainSummaryToolbar = () => {
    if (!hasAnyPainSummaryData) {
      return null;
    }

    return (
      <div className="rounded-xl border border-rose-100 bg-white/80 p-3 text-[11px] text-rose-700 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-rose-500">
          <span>Schmerzübersicht</span>
          {typeof painSummaryMaxIntensity === "number" ? (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] text-rose-700">
              Max. {painSummaryMaxIntensity}/10
            </span>
          ) : null}
          {hasAcutePainEvents ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
              {sortedPainShortcutEvents.length} Akut-Einträge
            </span>
          ) : null}
        </div>
        <div className="mt-3 space-y-2 text-xs text-rose-900">
          {hasAcutePainEvents ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-rose-600">
                <Flame className="h-3.5 w-3.5" aria-hidden />
                <span>Akut-Schmerzen</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sortedPainShortcutEvents.map((event) => {
                  const timeLabel =
                    formatPainTimeOfDayList(event.timeOfDay) ??
                    formatShortTimeLabel(event.timestamp) ??
                    (event.granularity === "tag" ? "Ganzer Tag" : null);
                  const qualityLabel = event.qualities?.length
                    ? formatList(event.qualities, 2)
                    : event.quality;
                  return (
                    <span
                      key={event.id}
                      className="inline-flex items-center gap-2 rounded-full bg-rose-50/80 px-3 py-1 text-[11px] font-medium text-rose-800"
                    >
                      {timeLabel ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                          {timeLabel}
                        </span>
                      ) : null}
                      <span className="text-rose-700">{getRegionLabel(event.regionId)}</span>
                      <span className="text-rose-500">{event.intensity}/10</span>
                      {qualityLabel ? <span className="text-rose-500">{qualityLabel}</span> : null}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}
          {hasPainSummaryData ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-rose-600">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                <span>Dokumentierte Schmerzen</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-rose-900">
                {painSummaryRegions.map((region) => {
                  const details: string[] = [];
                  if (typeof region.intensity === "number") {
                    details.push(`${region.intensity}/10`);
                  }
                  if (region.qualities.length) {
                    details.push(formatList(region.qualities, 2));
                  }
                  return (
                    <span
                      key={region.id}
                      className="inline-flex items-center gap-1 rounded-full bg-rose-50/80 px-3 py-1 text-xs font-medium text-rose-800"
                    >
                      <span className="font-semibold text-rose-900">{region.label}</span>
                      {details.length ? <span className="text-rose-500">· {details.join(" · ")}</span> : null}
                      <button
                        type="button"
                        onClick={() => removePainRegion(region.id)}
                        className="rounded-full p-1 text-rose-400 transition hover:bg-rose-100 hover:text-rose-700"
                        aria-label={`${region.label} entfernen`}
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };
  const currentPbacForNotice = draftHasBleeding ? pbacScore : dailyDraft.bleeding.pbacScore ?? 0;
  const showDizzinessNotice =
    activeDizziness && dailyDraft.dizzinessOpt?.present && currentPbacForNotice >= HEAVY_BLEED_PBAC;
  const phqSeverity = monthlyDraft.mental?.phq9Severity ?? mapPhqSeverity(monthlyDraft.mental?.phq9);
  const gadSeverity = monthlyDraft.mental?.gad7Severity ?? mapGadSeverity(monthlyDraft.mental?.gad7);

  useEffect(() => {
    if (!dailySaveNotice) return;
    const timeout = window.setTimeout(() => setDailySaveNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [dailySaveNotice]);

  useEffect(() => {
    if (!draftHasBleeding) {
      return;
    }

    setDailyDraft((prev) => ({
      ...prev,
      bleeding: {
        ...prev.bleeding,
        pbacScore,
        clots: prev.bleeding.clots ?? false,
        flooding: prev.bleeding.flooding ?? false,
      },
    }));
  }, [draftHasBleeding, pbacScore, setDailyDraft]);

  useEffect(() => {
    if (!bleedingQuickAddOpen) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setBleedingQuickAddOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [bleedingQuickAddOpen]);

  useEffect(() => {
    const existingEntry = derivedDailyEntries.find((entry) => entry.date === dailyDraft.date);
    if (!existingEntry) return;
    const normalizedExisting = normalizeDailyEntry(existingEntry);
    if (equalWithNullUndefined(normalizedExisting, normalizeDailyEntry(lastSavedDailySnapshot))) {
      return;
    }
    if (equalWithNullUndefined(normalizedExisting, normalizeDailyEntry(dailyDraft))) {
      setLastSavedDailySnapshot(existingEntry);
    }
  }, [dailyDraft, derivedDailyEntries, lastSavedDailySnapshot]);

  useEffect(() => {
    if (activeUrinary) {
      setDailyDraft((prev) => {
        const urgency = prev.urinary?.urgency;
        if (urgency === undefined || prev.urinaryOpt?.urgency !== undefined) {
          return prev;
        }
        const nextUrinary = { ...(prev.urinary ?? {}) };
        delete nextUrinary.urgency;
        const cleanedUrinary = Object.keys(nextUrinary).length ? nextUrinary : undefined;
        return {
          ...prev,
          urinary: cleanedUrinary,
          urinaryOpt: { ...(prev.urinaryOpt ?? {}), urgency },
        };
      });
      return;
    }

    setDailyDraft((prev) => {
      if (!prev.urinaryOpt) return prev;
      const nextUrinaryOpt = { ...prev.urinaryOpt };
      const urgency = nextUrinaryOpt.urgency;
      delete nextUrinaryOpt.urgency;
      const cleanedOpt = Object.keys(nextUrinaryOpt).length ? nextUrinaryOpt : undefined;
      const nextUrinary =
        urgency !== undefined ? { ...(prev.urinary ?? {}), urgency } : prev.urinary;
      return {
        ...prev,
        urinary: nextUrinary,
        urinaryOpt: cleanedOpt,
      };
    });
  }, [activeUrinary, setDailyDraft]);

  useEffect(() => {
    if (!activeHeadache) {
      setDailyDraft((prev) => {
        if (!prev.headacheOpt) {
          return prev;
        }
        return { ...prev, headacheOpt: undefined };
      });
    }
  }, [activeHeadache, setDailyDraft]);

  useEffect(() => {
    if (!activeDizziness) {
      setDailyDraft((prev) => {
        if (!prev.dizzinessOpt) return prev;
        return { ...prev, dizzinessOpt: undefined };
      });
    }
  }, [activeDizziness, setDailyDraft]);

  const handleFeatureToggle = (key: keyof FeatureFlags, value: boolean) => {
    setFeatureFlags((prev) => ({ ...prev, [key]: value }));
    if (value) return;
    setDailyDraft((prev) => {
      if (key === "moduleUrinary") {
        return prev;
      }
      if (key === "moduleHeadache") {
        if (!prev.headacheOpt) {
          return prev;
        }
        return { ...prev, headacheOpt: undefined };
      }
      if (key === "moduleDizziness" && prev.dizzinessOpt) {
        return { ...prev, dizzinessOpt: undefined };
      }
      return prev;
    });
  };

  const handleAddTag = () => {
    if (!notesTagDraft.trim()) return;
    const tag = notesTagDraft.trim();
    setDailyDraft((prev) => ({
      ...prev,
      notesTags: Array.from(new Set([...(prev.notesTags ?? []), tag])),
    }));
    setNotesTagDraft("");
  };

  const handleRemoveTag = (tag: string) => {
    setDailyDraft((prev) => ({
      ...prev,
      notesTags: (prev.notesTags ?? []).filter((entry) => entry !== tag),
    }));
  };

  const buildDailyExportRow = useCallback(
    (entry: DailyEntry) => {
      const normalizedEntry = applyAutomatedPainSymptoms(entry);
      const symptomScores = Object.entries(normalizedEntry.symptoms ?? {})
        .map(([key, value]) => (value?.present && typeof value.score === "number" ? `${key}:${value.score}` : null))
        .filter(Boolean)
        .join(";");
      const row: Record<string, unknown> = {
        Datum: normalizedEntry.date,
        [`${TERMS.nrs.label} (NRS)`]: normalizedEntry.painNRS,
        Schmerzarten: normalizedEntry.painQuality.join(";"),
        "Schmerzorte (IDs)": normalizedEntry.painMapRegionIds.join(";"),
        [`${TERMS.ovulationPain.label} – Seite`]: normalizedEntry.ovulationPain?.side ?? "",
        [`${TERMS.ovulationPain.label} – Intensität`]:
          typeof normalizedEntry.ovulationPain?.intensity === "number"
            ? normalizedEntry.ovulationPain.intensity
            : "",
        [`${TERMS.pbac.label}`]: normalizedEntry.bleeding.pbacScore ?? "",
        "Symptom-Scores": symptomScores,
        [`${TERMS.sleep_quality.label}`]: normalizedEntry.sleep?.quality ?? "",
        [`${TERMS.urinary_pain.label}`]:
          normalizedEntry.symptoms?.dysuria?.present && typeof normalizedEntry.symptoms.dysuria?.score === "number"
            ? normalizedEntry.symptoms.dysuria.score
            : "",
      };
      if (activeUrinary) {
        row.urinary_urgency = normalizedEntry.urinaryOpt?.urgency ?? "";
        row.urinary_leaks = normalizedEntry.urinaryOpt?.leaksCount ?? "";
        row.urinary_nocturia = normalizedEntry.urinaryOpt?.nocturia ?? "";
      }
      if (activeHeadache) {
        row.headache_present = normalizedEntry.headacheOpt?.present ?? false;
        row.headache_nrs = normalizedEntry.headacheOpt?.nrs ?? "";
        row.headache_aura = normalizedEntry.headacheOpt?.aura ?? false;
      }
      if (activeDizziness) {
        row.dizziness_present = normalizedEntry.dizzinessOpt?.present ?? false;
        row.dizziness_nrs = normalizedEntry.dizzinessOpt?.nrs ?? "";
        row.dizziness_orthostatic = normalizedEntry.dizzinessOpt?.orthostatic ?? false;
      }
      return row;
    },
    [activeUrinary, activeHeadache, activeDizziness]
  );

  const handleEhp5ItemChange = (index: number, value: number | undefined) => {
    setMonthlyDraft((prev) => {
      const currentItems = prev.qol?.ehp5Items ?? Array(EHP5_ITEMS.length).fill(undefined);
      const nextItems = [...currentItems];
      nextItems[index] = value;
      const total = nextItems.reduce((sum, entry) => (typeof entry === "number" ? sum + entry : sum), 0);
      const allAnswered = nextItems.every((entry) => typeof entry === "number");
      const transformed = allAnswered ? Math.round((total / (EHP5_ITEMS.length * 4)) * 100) : undefined;
      return {
        ...prev,
        qol: {
          ...(prev.qol ?? {}),
          ehp5Items: nextItems,
          ehp5Total: allAnswered ? total : undefined,
          ehp5Transformed: transformed,
        },
      };
    });
  };

  const handlePhqItemChange = (index: number, value: number | undefined) => {
    setMonthlyDraft((prev) => {
      const currentMental = prev.mental ?? {};
      const currentItems = currentMental.phq9Items ?? Array(PHQ9_ITEMS.length).fill(undefined);
      const nextItems = [...currentItems];
      nextItems[index] = value;
      const total = nextItems.reduce((sum, entry) => (typeof entry === "number" ? sum + entry : sum), 0);
      const allAnswered = nextItems.every((entry) => typeof entry === "number");
      const computedTotal = allAnswered ? total : undefined;
      return {
        ...prev,
        mental: {
          ...currentMental,
          phq9Items: nextItems,
          phq9: computedTotal,
          phq9Severity: mapPhqSeverity(computedTotal),
        },
      };
    });
  };

  const handleGadItemChange = (index: number, value: number | undefined) => {
    setMonthlyDraft((prev) => {
      const currentMental = prev.mental ?? {};
      const currentItems = currentMental.gad7Items ?? Array(GAD7_ITEMS.length).fill(undefined);
      const nextItems = [...currentItems];
      nextItems[index] = value;
      const total = nextItems.reduce((sum, entry) => (typeof entry === "number" ? sum + entry : sum), 0);
      const allAnswered = nextItems.every((entry) => typeof entry === "number");
      const computedTotal = allAnswered ? total : undefined;
      return {
        ...prev,
        mental: {
          ...currentMental,
          gad7Items: nextItems,
          gad7: computedTotal,
          gad7Severity: mapGadSeverity(computedTotal),
        },
      };
    });
  };

  const removePainRegion = useCallback(
    (regionId: string) => {
      setDailyDraft((prev) => {
        const current = prev.painRegions ?? [];
        if (!current.some((region) => region.regionId === regionId)) {
          return prev;
        }
        const nextRegions = current
          .filter((region) => region.regionId !== regionId) as NonNullable<DailyEntry["painRegions"]>;
        return buildDailyDraftWithPainRegions(prev, nextRegions);
      });
    },
    [setDailyDraft]
  );

  const handleDailySubmit = (options?: { goToHome?: boolean }): boolean => {
    const normalizedPbacCounts = normalizePbacCounts(pbacCounts);
    const bleedingActive = hasBleedingForEntry({ ...dailyDraft, pbacCounts: normalizedPbacCounts });
    const payload: DailyEntry = {
      ...dailyDraft,
      painQuality: dailyDraft.painQuality,
      bleeding: bleedingActive
          ? {
              isBleeding: true,
              pbacScore,
              clots: dailyDraft.bleeding.clots ?? false,
              flooding: dailyDraft.bleeding.flooding ?? false,
            }
        : { isBleeding: false },
      pbacCounts: normalizedPbacCounts,
      rescueMeds: (dailyDraft.rescueMeds ?? [])
        .filter((med) => med.name.trim().length > 0)
        .map((med) => ({
          name: med.name.trim(),
          doseMg: typeof med.doseMg === "number" ? Math.max(0, Math.round(med.doseMg)) : undefined,
          time: med.time?.trim(),
        })),
      notesTags: painQualityOther
        ? Array.from(
            new Set([...(dailyDraft.notesTags ?? []), `Schmerz anders: ${painQualityOther.trim()}`])
          )
        : dailyDraft.notesTags,
    };

    if (payload.ovulationPain) {
      const { side, intensity } = payload.ovulationPain;
      if (!side) {
        delete (payload as { ovulationPain?: DailyEntry["ovulationPain"] }).ovulationPain;
      } else {
        const normalized: NonNullable<DailyEntry["ovulationPain"]> = { side };
        if (typeof intensity === "number") {
          normalized.intensity = Math.max(0, Math.min(10, Math.round(intensity)));
        }
        payload.ovulationPain = normalized;
      }
    }

    if (!activeUrinary) {
      delete (payload as { urinaryOpt?: DailyEntry["urinaryOpt"] }).urinaryOpt;
    } else if (payload.urinaryOpt) {
      const normalized: NonNullable<DailyEntry["urinaryOpt"]> = {};
      if (typeof payload.urinaryOpt.present === "boolean") {
        normalized.present = payload.urinaryOpt.present;
      }
      if (typeof payload.urinaryOpt.urgency === "number") {
        normalized.urgency = Math.max(0, Math.min(10, Math.round(payload.urinaryOpt.urgency)));
      }
      if (typeof payload.urinaryOpt.leaksCount === "number") {
        normalized.leaksCount = Math.max(0, Math.round(payload.urinaryOpt.leaksCount));
      }
      if (typeof payload.urinaryOpt.nocturia === "number") {
        normalized.nocturia = Math.max(0, Math.round(payload.urinaryOpt.nocturia));
      }
      if (typeof payload.urinaryOpt.padsCount === "number") {
        normalized.padsCount = Math.max(0, Math.round(payload.urinaryOpt.padsCount));
      }
      payload.urinaryOpt = Object.keys(normalized).length ? normalized : undefined;
      if (!payload.urinaryOpt) {
        delete (payload as { urinaryOpt?: DailyEntry["urinaryOpt"] }).urinaryOpt;
      }
    }

    if (!activeHeadache) {
      delete (payload as { headacheOpt?: DailyEntry["headacheOpt"] }).headacheOpt;
    } else if (payload.headacheOpt) {
      const normalized: NonNullable<DailyEntry["headacheOpt"]> = {
        present: Boolean(payload.headacheOpt.present),
      };
      if (normalized.present && typeof payload.headacheOpt.nrs === "number") {
        normalized.nrs = Math.max(0, Math.min(10, Math.round(payload.headacheOpt.nrs)));
      }
      if (typeof payload.headacheOpt.aura === "boolean") {
        normalized.aura = payload.headacheOpt.aura;
      }
      const meds = (payload.headacheOpt.meds ?? [])
        .filter((med) => med.name.trim().length > 0)
        .map((med) => ({
          name: med.name.trim(),
          doseMg: typeof med.doseMg === "number" ? Math.max(0, Math.round(med.doseMg)) : undefined,
          time: med.time,
        }));
      if (meds.length) {
        normalized.meds = meds;
      }
      payload.headacheOpt = normalized;
    }

    if (!activeDizziness) {
      delete (payload as { dizzinessOpt?: DailyEntry["dizzinessOpt"] }).dizzinessOpt;
    } else if (payload.dizzinessOpt) {
      const normalized: NonNullable<DailyEntry["dizzinessOpt"]> = {
        present: Boolean(payload.dizzinessOpt.present),
      };
      if (normalized.present && typeof payload.dizzinessOpt.nrs === "number") {
        normalized.nrs = Math.max(0, Math.min(10, Math.round(payload.dizzinessOpt.nrs)));
      }
      if (typeof payload.dizzinessOpt.orthostatic === "boolean") {
        normalized.orthostatic = payload.dizzinessOpt.orthostatic;
      }
      payload.dizzinessOpt = normalized;
    }

    const syncedDraft: DailyEntry = { ...payload };

    if (Array.isArray(syncedDraft.painRegions)) {
      syncedDraft.painMapRegionIds = syncedDraft.painRegions.map((region) => region.regionId);

      const qualitiesSet = new Set<string>();
      syncedDraft.painRegions.forEach((region) => {
        (region.qualities ?? []).forEach((quality) => qualitiesSet.add(quality));
      });
      syncedDraft.painQuality = Array.from(qualitiesSet) as DailyEntry["painQuality"];
    }

    const automatedDraft = applyAutomatedPainSymptoms(syncedDraft);

    const validationIssues = validateDailyEntry(automatedDraft);
    setIssues(validationIssues);
    if (validationIssues.length) {
      setInfoMessage("Bitte prüfe die markierten Felder.");
      return false;
    }

    setDailyEntries((prev) => {
      const filtered = prev.filter((entry) => entry.date !== automatedDraft.date);
      return [...filtered, automatedDraft].sort((a, b) => a.date.localeCompare(b.date));
    });

    setInfoMessage(null);
    setDailySaveNotice("Tagesdaten gespeichert.");
    const nextDraft = automatedDraft;
    setDailyDraft(nextDraft);
    setLastSavedDailySnapshot(nextDraft);
    setPainQualityOther("");
    setNotesTagDraft("");
    setSensorsVisible(false);
    setExploratoryVisible(false);
    setIssues([]);
    if (options?.goToHome ?? true) {
      setActiveView("home");
    }
    return true;
  };

  const handleMonthlySubmit = () => {
    const payload: MonthlyEntry = { ...monthlyDraft };
    if (payload.qol) {
      const items = payload.qol.ehp5Items ?? Array(EHP5_ITEMS.length).fill(undefined);
      const total = items.reduce((sum, entry) => (typeof entry === "number" ? sum + entry : sum), 0);
      const allAnswered = items.every((entry) => typeof entry === "number");
      payload.qol = {
        ...payload.qol,
        ehp5Items: items,
        ehp5Total: allAnswered ? total : undefined,
        ehp5Transformed: allAnswered ? Math.round((total / (EHP5_ITEMS.length * 4)) * 100) : undefined,
      };
    }
    if (payload.mental) {
      const phqItems = payload.mental.phq9Items ?? Array(PHQ9_ITEMS.length).fill(undefined);
      const phqAllAnswered = phqItems.every((entry) => typeof entry === "number");
      const phqTotal = phqItems.reduce((sum, entry) => (typeof entry === "number" ? sum + entry : sum), 0);
      const gadItems = payload.mental.gad7Items ?? Array(GAD7_ITEMS.length).fill(undefined);
      const gadAllAnswered = gadItems.every((entry) => typeof entry === "number");
      const gadTotal = gadItems.reduce((sum, entry) => (typeof entry === "number" ? sum + entry : sum), 0);
      payload.mental = {
        ...payload.mental,
        phq9Items: phqItems,
        phq9: phqAllAnswered ? phqTotal : undefined,
        phq9Severity: mapPhqSeverity(phqAllAnswered ? phqTotal : undefined),
        gad7Items: gadItems,
        gad7: gadAllAnswered ? gadTotal : undefined,
        gad7Severity: mapGadSeverity(gadAllAnswered ? gadTotal : undefined),
      };
    }
    const validationIssues = validateMonthlyEntry(payload);
    setIssues(validationIssues);
    if (validationIssues.length) {
      setInfoMessage("Monatliche Fragebögen prüfen.");
      return;
    }

    setMonthlyEntries((prev) => {
      const filtered = prev.filter((entry) => entry.month !== payload.month);
      return [...filtered, payload].sort((a, b) => a.month.localeCompare(b.month));
    });
    setInfoMessage("Monatsdaten gespeichert.");
    setIssues([]);
  };

  const handleBackupExport = () => {
    downloadFile(
      `endo-backup-${today}.json`,
      JSON.stringify(backupPayload, null, 2),
      "application/json"
    );
  };

  const handleBackupImport = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) {
      input.value = "";
      return;
    }
    file
      .text()
      .then(async (text) => {
        try {
          const parsed = JSON.parse(text) as Partial<BackupPayload>;
          if (!parsed || typeof parsed !== "object") throw new Error("invalid");
          if (!Array.isArray(parsed.dailyEntries) || !Array.isArray(parsed.monthlyEntries)) {
            throw new Error("invalid");
          }
          const normalizedDaily = parsed.dailyEntries
            .filter((item): item is DailyEntry & Record<string, unknown> => typeof item === "object" && item !== null)
            .map((item) => normalizeImportedDailyEntry(item));
          const dailyValidationIssues = normalizedDaily
            .map((entry, idx) => ({ idx, date: entry.date, issues: validateDailyEntry(entry) }))
            .filter((item) => item.issues.length > 0);
          if (dailyValidationIssues.length > 0) {
            console.error("Daily validation issues:", dailyValidationIssues);
            throw new Error("invalid daily entries");
          }
          const normalizedMonthly = parsed.monthlyEntries
            .filter((item): item is MonthlyEntry & Record<string, unknown> => typeof item === "object" && item !== null)
            .map((item) => normalizeImportedMonthlyEntry(item));
          if (normalizedMonthly.some((entry) => validateMonthlyEntry(entry).length > 0)) {
            throw new Error("invalid");
          }
          const weeklyReportsSource = Array.isArray(parsed.weeklyReports) ? parsed.weeklyReports : [];
          const normalizedWeeklyReports = weeklyReportsSource
            .map((item) => (item && typeof item === "object" ? normalizeImportedWeeklyReport(item as RawWeeklyReport) : null))
            .filter((report): report is WeeklyReport => report !== null);

          const flagsSource = parsed.featureFlags ?? {};
          const normalizedFlags: FeatureFlags = {};
          if (flagsSource && typeof flagsSource === "object") {
            if (typeof (flagsSource as FeatureFlags).moduleUrinary === "boolean") {
              normalizedFlags.moduleUrinary = (flagsSource as FeatureFlags).moduleUrinary;
            }
            if (typeof (flagsSource as FeatureFlags).moduleHeadache === "boolean") {
              normalizedFlags.moduleHeadache = (flagsSource as FeatureFlags).moduleHeadache;
            }
            if (typeof (flagsSource as FeatureFlags).moduleDizziness === "boolean") {
              normalizedFlags.moduleDizziness = (flagsSource as FeatureFlags).moduleDizziness;
            }
          }

          setDailyEntries(normalizedDaily);
          setMonthlyEntries(normalizedMonthly);
          setFeatureFlags(normalizedFlags);
          await replaceWeeklyReports(normalizedWeeklyReports);
          refreshWeeklyReports();
          setInfoMessage("Backup importiert.");
        } catch (err) {
          console.error("Backup import failed:", err);
          setInfoMessage("Backup-Import fehlgeschlagen.");
        }
      })
      .finally(() => {
        input.value = "";
      });
  };

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt
      .prompt()
      .catch(() => undefined)
      .then(() => installPrompt.userChoice.catch(() => undefined))
      .finally(() => {
        setInstallPrompt(null);
      });
  };

  const handleReportDownload = (months: number) => {
    const threshold = new Date();
    threshold.setHours(0, 0, 0, 0);
    threshold.setMonth(threshold.getMonth() - months);
    const thresholdIso = formatDate(threshold);
    const thresholdMonth = thresholdIso.slice(0, 7);
    const dailyFiltered = derivedDailyEntries.filter((entry) => entry.date >= thresholdIso);
    const weeklyFiltered = weeklyReports
      .filter((report) => report.stats.endISO >= thresholdIso)
      .sort((a, b) => a.stats.startISO.localeCompare(b.stats.startISO));
    const monthlyFiltered = monthlyEntries.filter((entry) => entry.month >= thresholdMonth);

    const lines: string[] = [];
    lines.push(`Zeitraum: ${thresholdIso} bis ${today}`);
    lines.push(`Tagesdatensätze: ${dailyFiltered.length}`);
    if (dailyFiltered.length) {
      const avgPain = dailyFiltered.reduce((sum, entry) => sum + entry.painNRS, 0) / dailyFiltered.length;
      const maxPbac = dailyFiltered.reduce((max, entry) => {
        const bleeding = entry.bleeding ?? { isBleeding: false };
        return Math.max(max, bleeding.pbacScore ?? 0);
      }, 0);
      const sleepValues = dailyFiltered
        .map((entry) => entry.sleep?.quality)
        .filter((value): value is number => typeof value === "number");
      const avgSleep = sleepValues.length
        ? sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length
        : null;
      const symptomCounts = new Map<string, number>();
      dailyFiltered.forEach((entry) => {
        Object.entries(entry.symptoms ?? {}).forEach(([key, value]) => {
          if (value?.present) {
            symptomCounts.set(key, (symptomCounts.get(key) ?? 0) + 1);
          }
        });
      });
      const commonSymptoms = Array.from(symptomCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key, count]) => `${key}: ${count} Tage`)
        .join(", ");
      lines.push(`Ø ${TERMS.nrs.label}: ${avgPain.toFixed(1)}`);
      lines.push(`Max ${TERMS.pbac.label}: ${maxPbac}`);
      if (avgSleep !== null) {
        lines.push(`Ø ${TERMS.sleep_quality.label}: ${avgSleep.toFixed(1)}`);
      }
      if (commonSymptoms) {
        lines.push(`Häufige Symptome: ${commonSymptoms}`);
      }
      if (activeUrinary && urinaryStats) {
        if (urinaryStats.leakRate !== null) {
          lines.push(`Blase/Drang – Tage mit Leckage: ${urinaryStats.leakRate.toFixed(1)}%`);
        }
        if (urinaryStats.avgUrgency !== null) {
          lines.push(`Blase/Drang – Ø Harndrang: ${urinaryStats.avgUrgency.toFixed(1)}`);
        }
        if (urinaryStats.avgNocturia !== null) {
          lines.push(`Blase/Drang – Ø Nocturia: ${urinaryStats.avgNocturia.toFixed(1)}`);
        }
      }
      if (activeHeadache && headacheStats) {
        if (headacheStats.avgPerMonth !== null) {
          lines.push(`Kopfschmerz-/Migränetage pro Monat: ${headacheStats.avgPerMonth.toFixed(1)}`);
        }
        if (headacheStats.avgNrs !== null) {
          lines.push(`Ø Kopfschmerz (0–10): ${headacheStats.avgNrs.toFixed(1)}`);
        }
      }
      if (activeDizziness && dizzinessStats) {
        if (dizzinessStats.avgPerMonth !== null) {
          lines.push(`Schwindeltage pro Monat: ${dizzinessStats.avgPerMonth.toFixed(1)}`);
        }
        if (dizzinessStats.avgNrs !== null) {
          lines.push(`Ø Schwindel (0–10): ${dizzinessStats.avgNrs.toFixed(1)}`);
        }
        lines.push(
          `Schwindel an starken Blutungstagen: ${dizzinessStats.heavyDays}/${dizzinessStats.presentDays || 0}`
        );
      }

      // Impact score
      const impactValues = dailyFiltered
        .map((entry) => entry.impactNRS)
        .filter((v): v is number => typeof v === "number");
      if (impactValues.length) {
        const avgImpact = impactValues.reduce((sum, v) => sum + v, 0) / impactValues.length;
        lines.push(`Ø Beeinträchtigung (0–10): ${avgImpact.toFixed(1)}`);
      }

      // Rescue medications
      const medCounts = new Map<string, number>();
      dailyFiltered.forEach((entry) => {
        entry.rescueMeds?.forEach((med) => {
          if (med.name) {
            medCounts.set(med.name, (medCounts.get(med.name) ?? 0) + 1);
          }
        });
      });
      if (medCounts.size > 0) {
        const topMeds = Array.from(medCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => `${name}: ${count}x`)
          .join(", ");
        lines.push(`Bedarfsmedikation: ${topMeds}`);
      }

      // Activity data
      const stepsValues = dailyFiltered
        .map((entry) => entry.activity?.steps)
        .filter((v): v is number => typeof v === "number" && v > 0);
      if (stepsValues.length) {
        const avgSteps = Math.round(stepsValues.reduce((sum, v) => sum + v, 0) / stepsValues.length);
        lines.push(`Ø Schritte/Tag: ${avgSteps.toLocaleString("de-DE")}`);
      }

      // GI/Bristol stool type
      const bristolValues: number[] = [];
      dailyFiltered.forEach((entry) => {
        const bt = entry.gi?.bristolType;
        if (typeof bt === "number") bristolValues.push(bt);
      });
      if (bristolValues.length) {
        const avgBristol = bristolValues.reduce((sum, v) => sum + v, 0) / bristolValues.length;
        lines.push(`Ø Bristol-Stuhlskala: ${avgBristol.toFixed(1)}`);
      }

      // Ovulation data
      const lhPositiveDays = dailyFiltered.filter((entry) => entry.ovulation?.lhPositive).length;
      const lhTestDays = dailyFiltered.filter((entry) => entry.ovulation?.lhTestDone).length;
      const bbtValues = dailyFiltered
        .map((entry) => entry.ovulation?.bbtCelsius)
        .filter((v): v is number => typeof v === "number");
      const ovulationPainDays = dailyFiltered.filter((entry) => entry.ovulationPain?.intensity).length;

      if (lhTestDays > 0 || bbtValues.length > 0 || ovulationPainDays > 0) {
        lines.push("");
        lines.push("-- Eisprung-Tracking --");
        if (lhTestDays > 0) {
          lines.push(`LH-Tests durchgeführt: ${lhTestDays} Tage (${lhPositiveDays} positiv)`);
        }
        if (bbtValues.length > 0) {
          const avgBbt = bbtValues.reduce((sum, v) => sum + v, 0) / bbtValues.length;
          const minBbt = Math.min(...bbtValues);
          const maxBbt = Math.max(...bbtValues);
          lines.push(`Basaltemperatur: Ø ${avgBbt.toFixed(2)}°C (${minBbt.toFixed(2)}–${maxBbt.toFixed(2)}°C)`);
        }
        if (ovulationPainDays > 0) {
          lines.push(`Mittelschmerz dokumentiert: ${ovulationPainDays} Tage`);
        }
      }

      // Cervix mucus / Billings data (only if Billings method is enabled)
      if (featureFlags.billingMethod) {
        const mucusEntries = dailyFiltered.filter((entry) => entry.cervixMucus?.observation || entry.cervixMucus?.appearance);
        if (mucusEntries.length > 0) {
          lines.push("");
          lines.push("-- Cervixschleim (Billings) --");
          lines.push(`Erfasste Tage: ${mucusEntries.length}`);

          const observationCounts = new Map<string, number>();
          const appearanceCounts = new Map<string, number>();
          mucusEntries.forEach((entry) => {
            if (entry.cervixMucus?.observation) {
              observationCounts.set(entry.cervixMucus.observation, (observationCounts.get(entry.cervixMucus.observation) ?? 0) + 1);
            }
            if (entry.cervixMucus?.appearance) {
              appearanceCounts.set(entry.cervixMucus.appearance, (appearanceCounts.get(entry.cervixMucus.appearance) ?? 0) + 1);
            }
          });

          const observationLabels: Record<string, string> = {
            dry: "Trocken", moist: "Feucht", wet: "Nass", slippery: "Glitschig"
          };
          const appearanceLabels: Record<string, string> = {
            none: "Nichts", sticky: "Klebrig", creamy: "Cremig", eggWhite: "Spinnbar"
          };

          const observationSummary = Array.from(observationCounts.entries())
            .map(([key, count]) => `${observationLabels[key] ?? key}: ${count}`)
            .join(", ");
          const appearanceSummary = Array.from(appearanceCounts.entries())
            .map(([key, count]) => `${appearanceLabels[key] ?? key}: ${count}`)
            .join(", ");

          if (observationSummary) lines.push(`Empfindung: ${observationSummary}`);
          if (appearanceSummary) lines.push(`Aussehen: ${appearanceSummary}`);

          // Peak mucus days (score >= 3)
          const peakDays = mucusEntries.filter((entry) => scoreCervixMucusFertility(entry.cervixMucus) >= 3).length;
          if (peakDays > 0) {
            lines.push(`Tage mit hoher Fruchtbarkeit (Peak): ${peakDays}`);
          }
        }
      }

      // Cycle length statistics
      const cycleStartsInPeriod = annotatedDailyEntries
        .filter(({ cycleDay, entry }) => cycleDay === 1 && entry.date >= thresholdIso && entry.date <= today)
        .map(({ entry }) => entry.date)
        .sort();
      if (cycleStartsInPeriod.length >= 2) {
        const cycleLengthsInPeriod: number[] = [];
        for (let i = 0; i < cycleStartsInPeriod.length - 1; i += 1) {
          const start = parseIsoDate(cycleStartsInPeriod[i]);
          const end = parseIsoDate(cycleStartsInPeriod[i + 1]);
          if (start && end) {
            const diff = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
            if (diff > 0) cycleLengthsInPeriod.push(diff);
          }
        }
        if (cycleLengthsInPeriod.length > 0) {
          lines.push("");
          lines.push("-- Zyklusdaten --");
          lines.push(`Anzahl Zyklen: ${cycleLengthsInPeriod.length}`);
          const avgCycleLength = cycleLengthsInPeriod.reduce((sum, v) => sum + v, 0) / cycleLengthsInPeriod.length;
          const minCycle = Math.min(...cycleLengthsInPeriod);
          const maxCycle = Math.max(...cycleLengthsInPeriod);
          lines.push(`Ø Zykluslänge: ${avgCycleLength.toFixed(1)} Tage (${minCycle}–${maxCycle} Tage)`);
        }
      }
    } else {
      lines.push("Keine Tagesdaten im Zeitraum.");
    }

    if (weeklyFiltered.length) {
      const latest = weeklyFiltered[weeklyFiltered.length - 1];
      lines.push(
        `Letzte Wochenübersicht (${latest.stats.startISO} – ${latest.stats.endISO}): Ø Schmerz ${
          typeof latest.stats.avgPain === "number" ? latest.stats.avgPain.toFixed(1) : "–"
        } | Max Schmerz ${
          typeof latest.stats.maxPain === "number" ? latest.stats.maxPain.toFixed(1) : "–"
        } | Schwere Tage ${latest.stats.badDaysCount} | Blutungstage ${latest.stats.bleedingDaysCount}`
      );
    } else {
      lines.push("Keine wöchentlichen Berichte im Zeitraum.");
    }

    if (monthlyFiltered.length) {
      const latest = monthlyFiltered[monthlyFiltered.length - 1];
      lines.push(`${TERMS.ehp5.label}: ${latest.qol?.ehp5Total ?? "–"}`);
      lines.push(`${TERMS.phq9.label}: ${latest.mental?.phq9 ?? "–"}`);
      lines.push(`${TERMS.gad7.label}: ${latest.mental?.gad7 ?? "–"}`);
      if (latest.promis?.fatigueT !== undefined) {
        lines.push(`${TERMS.promis_fatigue.label}: ${latest.promis.fatigueT}`);
      }
      if (latest.promis?.painInterferenceT !== undefined) {
        lines.push(`${TERMS.promis_painInt.label}: ${latest.promis.painInterferenceT}`);
      }
    } else {
      lines.push("Keine monatlichen Fragebögen im Zeitraum.");
    }

    lines.push("", "Glossar:");
    const glossaryKeys: TermKey[] = ["nrs", "pbac", "ehp5", "phq9", "gad7", "promis_fatigue", "promis_painInt"];
    glossaryKeys.forEach((key) => {
      const term = TERMS[key];
      lines.push(`- ${term.label}: ${term.help}`);
    });

    if (activeUrinary) {
      lines.push(
        `- ${MODULE_TERMS.urinaryOpt.urgency.label}: ${MODULE_TERMS.urinaryOpt.urgency.help}`,
        `- ${MODULE_TERMS.urinaryOpt.leaksCount.label}: ${MODULE_TERMS.urinaryOpt.leaksCount.help}`,
        `- ${MODULE_TERMS.urinaryOpt.nocturia.label}: ${MODULE_TERMS.urinaryOpt.nocturia.help}`
      );
    }
    if (activeHeadache) {
      lines.push(
        `- ${MODULE_TERMS.headacheOpt.present.label}: ${MODULE_TERMS.headacheOpt.present.help}`,
        `- ${MODULE_TERMS.headacheOpt.nrs.label}: ${MODULE_TERMS.headacheOpt.nrs.help}`,
        `- ${MODULE_TERMS.headacheOpt.aura.label}: ${MODULE_TERMS.headacheOpt.aura.help}`
      );
    }
    if (activeDizziness) {
      lines.push(
        `- ${MODULE_TERMS.dizzinessOpt.present.label}: ${MODULE_TERMS.dizzinessOpt.present.help}`,
        `- ${MODULE_TERMS.dizzinessOpt.nrs.label}: ${MODULE_TERMS.dizzinessOpt.nrs.help}`,
        `- ${MODULE_TERMS.dizzinessOpt.orthostatic.label}: ${MODULE_TERMS.dizzinessOpt.orthostatic.help}`
      );
    }

    // Additional glossary entries for new fields
    lines.push(
      "- Beeintraechtigung: Wie stark der Schmerz den Alltag beeinflusst (0-10)",
      "- Bristol-Stuhlskala: Klassifikation der Stuhlkonsistenz (1=hart, 7=fluessig)",
      "- LH-Test: Ovulationstest zur Bestimmung des luteinisierenden Hormons",
      "- BBT/Basaltemperatur: Koerpertemperatur direkt nach dem Aufwachen",
      "- Mittelschmerz: Schmerz um den Eisprung herum"
    );
    if (featureFlags.billingMethod) {
      lines.push(
        "- Cervixschleim: Zervikaler Schleim zur Fruchtbarkeitsbestimmung (Billings-Methode)",
        "- Peak-Tage: Tage mit hoher Fruchtbarkeit (glitschiger/spinnbarer Schleim)"
      );
    }

    const pdf = createPdfDocument(`Endo-Report ${months} Monate`, lines);
    downloadFile(`endo-report-${months}m.pdf`, pdf, "application/pdf");
  };

  const latestCycleStartDate = useMemo(() => {
    for (let index = annotatedDailyEntries.length - 1; index >= 0; index -= 1) {
      const item = annotatedDailyEntries[index];
      if (item.cycleDay === 1) {
        return parseIsoDate(item.entry.date);
      }
    }
    return null;
  }, [annotatedDailyEntries]);

  const monthlyReminderStartDate = useMemo(() => {
    if (!latestCycleStartDate) return null;
    const start = new Date(latestCycleStartDate);
    start.setDate(start.getDate() + 28);
    start.setHours(0, 0, 0, 0);
    return start;
  }, [latestCycleStartDate]);

  const isMonthlyReminderDue = useMemo(() => {
    if (!latestCycleStartDate || !todayDate) return false;
    const diffMs = todayDate.getTime() - latestCycleStartDate.getTime();
    if (diffMs < 0) return false;
    const diffDays = Math.floor(diffMs / MS_PER_DAY);
    return diffDays >= 28;
  }, [latestCycleStartDate, todayDate]);

  const daysUntilMonthlySuggested = useMemo(() => {
    if (!todayDate || !latestCycleStartDate) return null;
    const startOfToday = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    const cycleStart = new Date(
      latestCycleStartDate.getFullYear(),
      latestCycleStartDate.getMonth(),
      latestCycleStartDate.getDate()
    );
    const diffMs = startOfToday.getTime() - cycleStart.getTime();
    if (diffMs <= 0) {
      return 0;
    }
    const diffDays = Math.floor(diffMs / MS_PER_DAY);
    const remaining = 28 - diffDays;
    return remaining > 0 ? remaining : 0;
  }, [todayDate, latestCycleStartDate]);

  const monthlyInfoText = useMemo(() => {
    if (daysUntilMonthlySuggested === null) {
      return "Trage deine Periode ein, um Erinnerungen zu erhalten";
    }
    if (daysUntilMonthlySuggested <= 0) {
      return "Heute wieder ausfüllen";
    }
    if (daysUntilMonthlySuggested === 1) {
      return "In 1 Tag wieder ausfüllen";
    }
    return `In ${daysUntilMonthlySuggested} Tagen wieder ausfüllen`;
  }, [daysUntilMonthlySuggested]);

  const weeklyBannerText = isSunday
    ? "Es ist Sonntag. Zeit für deinen wöchentlichen Check In."
    : "Fülle diese Fragen möglichst jeden Sonntag aus.";

  const rawPendingCheckIns = useMemo<PendingCheckIn[]>(() => {
    const items: PendingCheckIn[] = [];
    if (!storageReady || !todayDate) {
      return items;
    }

    pendingCheckInDates.forEach(({ iso, date }) => {
      const hasEntry = dailyEntries.some((entry) => entry.date === iso);
      if (hasEntry) return;

      const dueTime = new Date(date);
      dueTime.setHours(18, 0, 0, 0);
      if (currentTime.getTime() < dueTime.getTime()) return;

      items.push({
        key: `daily:${iso}`,
        type: "daily",
        label: `Täglicher Check-in (${formatPendingDateLabel(date)})`,
        description: iso === today ? "Heute ab 18:00 Uhr fällig" : "Überfällig",
      });
    });

    if (weeklyReportsReady) {
      pendingCheckInDates.forEach(({ date }) => {
        if (date.getDay() !== 0) return;
        const isoWeekKey = dateToIsoWeek(date);
        const hasReport = weeklyReports.some((report) => report.isoWeekKey === isoWeekKey);
        if (hasReport) return;
        const startOfDue = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        if (currentTime < startOfDue) return;

        items.push({
          key: `weekly:${isoWeekKey}`,
          type: "weekly",
          label: "Wöchentlicher Check-in",
          description: `Fällig seit ${formatPendingDateLabel(date)}`,
        });
      });
    }

    if (monthlyReminderStartDate && monthlyReminderStartDate <= todayDate && !hasMonthlyEntryForCurrentMonth) {
      const diffDays = Math.floor(
        (todayDate.getTime() - monthlyReminderStartDate.getTime()) / MS_PER_DAY
      );
      if (diffDays >= 0 && diffDays < 5) {
        const dueLabel = formatPendingDateLabel(monthlyReminderStartDate);
        items.push({
          key: `monthly:${currentMonth}`,
          type: "monthly",
          label: "Monatlicher Check-in",
          description: `Fällig seit ${dueLabel}`,
        });
      }
    }

    return items;
  }, [
    currentMonth,
    currentTime,
    dailyEntries,
    hasMonthlyEntryForCurrentMonth,
    monthlyReminderStartDate,
    pendingCheckInDates,
    storageReady,
    formatPendingDateLabel,
    today,
    todayDate,
    weeklyReports,
    weeklyReportsReady,
  ]);

  const pendingCheckIns = useMemo(
    () => rawPendingCheckIns.filter((item) => !dismissedCheckIns.includes(item.key)),
    [dismissedCheckIns, rawPendingCheckIns]
  );

  const showWeeklyReminderBadge = pendingCheckIns.some((item) => item.type === "weekly");
  const showMonthlyReminderBadge = pendingCheckIns.some((item) => item.type === "monthly");

  useEffect(() => {
    setDismissedCheckIns((previous) =>
      previous.filter((key) => rawPendingCheckIns.some((item) => item.key === key))
    );
  }, [rawPendingCheckIns, setDismissedCheckIns]);

  useEffect(() => {
    if (!pendingCheckIns.length) {
      setShowCheckInPopup(false);
      setPendingDismissCheckIn(null);
    }
  }, [pendingCheckIns.length]);

  const handleFillCheckIn = useCallback(
    (type: PendingCheckInType) => {
      setShowCheckInPopup(false);
      setPendingDismissCheckIn(null);

      if (type === "daily") {
        manualDailySelectionRef.current = false;
        if (dailyDraft.date !== today) {
          selectDailyDate(today);
        }
        setDailyActiveCategory("overview");
        setActiveView("daily");
        return;
      }

      if (type === "weekly") {
        setActiveView("weekly");
        return;
      }

      setActiveView("monthly");
    },
    [dailyDraft.date, selectDailyDate, setActiveView, setDailyActiveCategory, today]
  );

  const dismissCheckIn = useCallback(
    (key: string) => {
      setDismissedCheckIns((previous) => (previous.includes(key) ? previous : [...previous, key]));
      setPendingDismissCheckIn(null);
    },
    [setDismissedCheckIns]
  );

  const analyticsRangeStartIso = useMemo(() => {
    if (!todayDate) {
      return null;
    }
    const start = new Date(todayDate);
    start.setDate(start.getDate() - (analyticsRangeDays - 1));
    return formatDate(start);
  }, [todayDate, analyticsRangeDays]);

  type AnalyticsTrendDatum = {
    date: string;
    cycleDay: number | null;
    weekday: string;
    pain: number | null;
    impact: number | null;
    symptomAverage: number | null;
    sleepQuality: number | null;
    steps: number | null;
  };

  const analyticsTrendData = useMemo<AnalyticsTrendDatum[]>(() => {
    const thresholdIso = analyticsRangeStartIso;
    const filtered = thresholdIso
      ? annotatedDailyEntries.filter(({ entry }) => entry.date >= thresholdIso)
      : annotatedDailyEntries;
    const effective = filtered.length ? filtered : annotatedDailyEntries;
    return effective.map(({ entry, cycleDay, weekday, symptomAverage }) => ({
      date: entry.date,
      cycleDay: cycleDay ?? null,
      weekday,
      pain: typeof entry.painNRS === "number" ? entry.painNRS : null,
      impact: typeof entry.impactNRS === "number" ? entry.impactNRS : null,
      symptomAverage,
      sleepQuality: typeof entry.sleep?.quality === "number" ? entry.sleep.quality : null,
      steps: typeof entry.activity?.steps === "number" ? entry.activity.steps : null,
    }));
  }, [annotatedDailyEntries, analyticsRangeStartIso]);

  const analyticsTrendMaxSteps = useMemo(() => {
    if (!analyticsTrendData.length) {
      return 5000;
    }
    const max = analyticsTrendData.reduce((currentMax, item) => {
      if (typeof item.steps === "number" && item.steps > currentMax) {
        return item.steps;
      }
      return currentMax;
    }, 0);
    if (max <= 0) {
      return 5000;
    }
    const rounded = Math.ceil(max / 1000) * 1000;
    return Math.max(rounded, 5000);
  }, [analyticsTrendData]);

  const trendMetricOptions = useMemo(
    () =>
      [
        {
          key: "pain" as const,
          label: TERMS.nrs.label,
          color: "#f43f5e",
          type: "line" as const,
          yAxisId: "left" as const,
        },
        {
          key: "impact" as const,
          label: "Beeinträchtigung",
          color: "#f97316",
          type: "line" as const,
          yAxisId: "left" as const,
        },
        {
          key: "symptomAverage" as const,
          label: "Symptom-Schnitt",
          color: "#8b5cf6",
          type: "line" as const,
          yAxisId: "left" as const,
        },
        {
          key: "sleepQuality" as const,
          label: TERMS.sleep_quality.label,
          color: "#10b981",
          type: "line" as const,
          yAxisId: "left" as const,
        },
        {
          key: "steps" as const,
          label: "Schritte",
          color: "#0ea5e9",
          type: "area" as const,
          yAxisId: "right" as const,
        },
      ],
    []
  );

  const {
    checkInHistory,
    checkInCount,
    completionRate,
    currentStreak,
    longestStreak,
    painImprovement,
    painRecentAvg,
  } = useMemo(() => {
    if (!todayDate) {
      return {
        checkInHistory: [] as Array<{
          date: string;
          checkIn: number;
          pain: number | null;
          sleepQuality: number | null;
        }>,
        checkInCount: 0,
        completionRate: 0,
        currentStreak: 0,
        longestStreak: 0,
        painImprovement: null as number | null,
        painRecentAvg: null as number | null,
      };
    }

    const entryByDate = new Map(derivedDailyEntries.map((entry) => [entry.date, entry]));
    const allDates = Array.from(entryByDate.keys()).sort((a, b) => a.localeCompare(b));

    let longest = 0;
    let running = 0;
    let previous: Date | null = null;
    allDates.forEach((iso) => {
      const parsed = parseIsoDate(iso);
      if (!parsed) return;
      if (previous) {
        const diff = Math.round((parsed.getTime() - previous.getTime()) / MS_PER_DAY);
        running = diff === 1 ? running + 1 : 1;
      } else {
        running = 1;
      }
      if (running > longest) {
        longest = running;
      }
      previous = parsed;
    });

    let current = 0;
    let lastDate: Date | null = null;
    const allDatesDesc = allDates.slice().sort((a, b) => b.localeCompare(a));
    for (const iso of allDatesDesc) {
      const parsed = parseIsoDate(iso);
      if (!parsed) continue;
      if (!lastDate) {
        current = 1;
        lastDate = parsed;
        continue;
      }
      const diff = Math.round((lastDate.getTime() - parsed.getTime()) / MS_PER_DAY);
      if (diff === 1) {
        current += 1;
        lastDate = parsed;
      } else {
        break;
      }
    }

    const rangeStart = new Date(todayDate);
    rangeStart.setDate(rangeStart.getDate() - (analyticsRangeDays - 1));
    const totalDays = Math.max(
      1,
      Math.floor((todayDate.getTime() - rangeStart.getTime()) / MS_PER_DAY) + 1
    );
    const history: Array<{
      date: string;
      checkIn: number;
      pain: number | null;
      sleepQuality: number | null;
    }> = [];
    let completed = 0;
    for (let offset = 0; offset < totalDays; offset += 1) {
      const currentDate = new Date(rangeStart);
      currentDate.setDate(rangeStart.getDate() + offset);
      if (currentDate.getTime() > todayDate.getTime()) {
        break;
      }
      const iso = formatDate(currentDate);
      const entry = entryByDate.get(iso);
      const checkIn = entry ? 1 : 0;
      if (checkIn) {
        completed += 1;
      }
      history.push({
        date: iso,
        checkIn,
        pain: typeof entry?.painNRS === "number" ? entry!.painNRS : null,
        sleepQuality: typeof entry?.sleep?.quality === "number" ? entry!.sleep!.quality : null,
      });
    }

    const completion = history.length ? Number(((completed / history.length) * 100).toFixed(1)) : 0;
    const chunkSize = Math.max(1, Math.floor(history.length / 3));
    const painValues = history.map((item) => item.pain);
    const firstChunkValues = painValues.slice(0, chunkSize).filter((value): value is number => typeof value === "number");
    const lastChunkValues = painValues
      .slice(Math.max(0, painValues.length - chunkSize))
      .filter((value): value is number => typeof value === "number");
    const average = (values: number[]) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const startAvg = average(firstChunkValues);
    const recentAvg = average(lastChunkValues);
    const improvement =
      startAvg !== null && recentAvg !== null ? Number((startAvg - recentAvg).toFixed(2)) : null;

    return {
      checkInHistory: history,
      checkInCount: completed,
      completionRate: completion,
      currentStreak: current,
      longestStreak: longest,
      painImprovement: improvement,
      painRecentAvg: recentAvg,
    };
  }, [
    derivedDailyEntries,
    todayDate,
    analyticsRangeDays,
  ]);

  const medicationLast7Days = useMemo(() => {
    if (!todayDate) {
      return [] as Array<{
        date: string;
        label: string;
        rescueCount: number;
        tooltip: string;
      }>;
    }

    const entryByDate = new Map(derivedDailyEntries.map((entry) => [entry.date, entry]));
    const days: Array<{
      date: string;
      label: string;
      rescueCount: number;
      tooltip: string;
    }> = [];

    for (let offset = 6; offset >= 0; offset -= 1) {
      const current = new Date(todayDate);
      current.setDate(todayDate.getDate() - offset);
      const iso = formatDate(current);
      const entry = entryByDate.get(iso);
      const rescueMeds = (entry?.rescueMeds ?? []).filter((med) => med.name.trim().length > 0);
      const rescueCount = rescueMeds.length;
      const medsDetails = rescueMeds.map((med) => {
        const medParts = [med.name.trim()];
        if (typeof med.doseMg === "number") {
          medParts.push(`${med.doseMg} mg`);
        }
        if (med.time) {
          medParts.push(med.time);
        }
        return medParts.join(" • ");
      });
      const tooltipLines = medsDetails.length
        ? medsDetails
        : ["Keine Rescue-Medikation eingetragen."];

      days.push({
        date: iso,
        label: current.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit" }),
        rescueCount,
        tooltip: tooltipLines.length
          ? `${current.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" })}\n${tooltipLines.join(
              "\n"
            )}`
          : `${current.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" })}\nKeine Medikamente eingetragen`,
      });
    }

    return days;
  }, [derivedDailyEntries, todayDate]);

  const totalMedicationsLast7Days = useMemo(() => {
    return medicationLast7Days.reduce((sum, day) => sum + day.rescueCount, 0);
  }, [medicationLast7Days]);

  const painTrendText = useMemo(() => {
    if (typeof painImprovement === "number") {
      if (painImprovement > 0.2) {
        return `Deine Schmerzen sind im Vergleich zum Start dieses Zeitraums um ${painImprovement.toFixed(1)} Punkte gesunken.`;
      }
      if (painImprovement < -0.2) {
        return `Die Schmerzen sind zuletzt um ${Math.abs(painImprovement).toFixed(1)} Punkte gestiegen – nutze deine Einträge, um mögliche Auslöser zu erkennen.`;
      }
      return "Deine Schmerzwerte bleiben stabil – großartig, dass du so konsequent dokumentierst!";
    }
    return "Sammle noch ein paar Einträge, um Veränderungen bei deinen Schmerzen sichtbar zu machen.";
  }, [painImprovement]);

  const renderIssuesForPath = (path: string) =>
    issues.filter((issue) => issue.path === path).map((issue) => (
      <p key={issue.message} className="text-xs text-rose-600">
        {issue.message}
      </p>
    ));

  const optionalSensorsLabel = sensorsVisible ? "Optional (Hilfsmittel) ausblenden" : "Optional (Hilfsmittel) einblenden";

  const cycleOverlay = useMemo(() => {
    const bucket = new Map<
      number,
      {
        painSum: number;
        symptomSum: number;
        count: number;
        sleepSum: number;
        pbacSum: number;
        pbacCount: number;
        urgencySum: number;
        urgencyCount: number;
        headacheSum: number;
        headacheCount: number;
        dizzinessSum: number;
        dizzinessCount: number;
      }
    >();
    annotatedDailyEntries.forEach(({ entry, cycleDay, symptomAverage }) => {
      if (!cycleDay) return;
      const bleeding = entry.bleeding ?? { isBleeding: false };
      const current =
        bucket.get(cycleDay) ??
        {
          painSum: 0,
          symptomSum: 0,
          count: 0,
          sleepSum: 0,
          pbacSum: 0,
          pbacCount: 0,
          urgencySum: 0,
          urgencyCount: 0,
          headacheSum: 0,
          headacheCount: 0,
          dizzinessSum: 0,
          dizzinessCount: 0,
        };
      current.painSum += entry.painNRS;
      current.count += 1;
      if (typeof symptomAverage === "number") {
        current.symptomSum += symptomAverage;
      }
      if (typeof entry.sleep?.quality === "number") {
        current.sleepSum += entry.sleep.quality;
      }
      if (typeof bleeding.pbacScore === "number") {
        current.pbacSum += bleeding.pbacScore;
        current.pbacCount += 1;
      }
      if (typeof entry.urinaryOpt?.urgency === "number") {
        current.urgencySum += entry.urinaryOpt.urgency;
        current.urgencyCount += 1;
      }
      if (entry.headacheOpt?.present && typeof entry.headacheOpt.nrs === "number") {
        current.headacheSum += entry.headacheOpt.nrs;
        current.headacheCount += 1;
      }
      if (entry.dizzinessOpt?.present && typeof entry.dizzinessOpt.nrs === "number") {
        current.dizzinessSum += entry.dizzinessOpt.nrs;
        current.dizzinessCount += 1;
      }
      bucket.set(cycleDay, current);
    });
    return Array.from(bucket.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([cycleDay, stats]) => ({
        cycleDay,
        painAvg: Number((stats.painSum / stats.count).toFixed(1)),
        symptomAvg: stats.symptomSum ? Number((stats.symptomSum / stats.count).toFixed(1)) : null,
        sleepAvg: stats.sleepSum ? Number((stats.sleepSum / stats.count).toFixed(1)) : null,
        pbacAvg: stats.pbacCount ? Number((stats.pbacSum / stats.pbacCount).toFixed(1)) : null,
        urgencyAvg: stats.urgencyCount ? Number((stats.urgencySum / stats.urgencyCount).toFixed(1)) : null,
        headacheAvg: stats.headacheCount ? Number((stats.headacheSum / stats.headacheCount).toFixed(1)) : null,
        dizzinessAvg: stats.dizzinessCount ? Number((stats.dizzinessSum / stats.dizzinessCount).toFixed(1)) : null,
      }));
  }, [annotatedDailyEntries]);

  const todayCycleDay = useMemo(() => {
    const todayDateValue = parseIsoDate(today);
    if (!todayDateValue) {
      return null;
    }

    for (let index = annotatedDailyEntries.length - 1; index >= 0; index -= 1) {
      const item = annotatedDailyEntries[index];
      if (item.entry.date > today || typeof item.cycleDay !== "number") {
        continue;
      }

      const latestDate = parseIsoDate(item.entry.date);
      if (!latestDate) {
        return item.cycleDay;
      }

      const diffMs = todayDateValue.getTime() - latestDate.getTime();
      if (diffMs <= 0) {
        return item.cycleDay;
      }

      const diffDays = Math.round(diffMs / MS_PER_DAY);
      return item.cycleDay + diffDays;
    }

    return null;
  }, [annotatedDailyEntries, today]);

  const menstruationComparison = useMemo(() => {
    if (!cycleStartDates.length) {
      return null;
    }

    const starts = [...cycleStartDates].sort();
    const currentStart = starts[starts.length - 1];
    const previousStart = starts.length > 1 ? starts[starts.length - 2] : null;

    const buildSeries = (start: string, nextStart?: string) => {
      const entries = annotatedDailyEntries.filter(({ entry, cycleDay }) => {
        if (!cycleDay) return false;
        if (entry.date < start) return false;
        if (nextStart && entry.date >= nextStart) return false;
        return true;
      });

      const byDay = new Map<
        number,
        {
          pbac: number | null;
          pain: number | null;
          impact: number | null;
          date: string;
        }
      >();

      entries.forEach(({ entry, cycleDay }) => {
        if (cycleDay == null) return;

        const bleedingActive = hasBleedingForEntry(entry);
        const pbacValue =
          typeof entry.bleeding?.pbacScore === "number"
            ? entry.bleeding.pbacScore
            : bleedingActive
              ? 5
              : null;

        const existing = byDay.get(cycleDay);
        if (!existing || (pbacValue ?? -1) > (existing.pbac ?? -1)) {
          byDay.set(cycleDay, {
            pbac: pbacValue,
            pain: typeof entry.painNRS === "number" ? entry.painNRS : null,
            impact: typeof entry.impactNRS === "number" ? entry.impactNRS : null,
            date: entry.date,
          });
        }
      });

      return Array.from(byDay.entries())
        .map(([cycleDay, values]) => ({ cycleDay, ...values }))
        .sort((a, b) => a.cycleDay - b.cycleDay);
    };

    const currentSeries = buildSeries(currentStart);
    const previousSeries = previousStart ? buildSeries(previousStart, currentStart) : [];

    const currentMap = new Map(currentSeries.map((item) => [item.cycleDay, item]));
    const previousMap = new Map(previousSeries.map((item) => [item.cycleDay, item]));

    const days = new Set<number>();
    currentSeries.forEach((item) => days.add(item.cycleDay));
    previousSeries.forEach((item) => days.add(item.cycleDay));

    const data: MenstruationComparisonPoint[] = Array.from(days)
      .sort((a, b) => a - b)
      .map((day) => {
        const current = currentMap.get(day);
        const previous = previousMap.get(day);

        return {
          cycleDay: day,
          currentPBAC: current ? current.pbac ?? null : null,
          previousPBAC: previous ? previous.pbac ?? null : null,
          currentDate: current?.date,
          previousDate: previous?.date,
          currentPain: current?.pain ?? null,
          previousPain: previous?.pain ?? null,
          currentImpact: current?.impact ?? null,
          previousImpact: previous?.impact ?? null,
        };
      });

    const hasValues = data.some((item) => item.currentPBAC !== null || item.previousPBAC !== null);
    if (!hasValues) {
      return null;
    }

    return {
      data,
      currentStartDate: currentStart,
      previousStartDate: previousStart,
    };
  }, [annotatedDailyEntries, cycleStartDates]);

  const hasActivePeriod = useMemo(() => {
    const todayEntry = annotatedDailyEntries.find(({ entry }) => entry.date === today);
    if (todayEntry) {
      return hasBleedingForEntry(todayEntry.entry);
    }
    let latest: (typeof annotatedDailyEntries)[number] | null = null;
    for (const item of annotatedDailyEntries) {
      if (item.entry.date > today) {
        continue;
      }
      if (!latest || item.entry.date > latest.entry.date) {
        latest = item;
      }
    }
    return latest ? hasBleedingForEntry(latest.entry) : false;
  }, [annotatedDailyEntries, today]);

  const expectedPeriodBadgeLabel = useMemo(() => {
    if (!todayDate) {
      return null;
    }
    if (hasActivePeriod) {
      return null;
    }
    if (completedCycleLengths.length === 0) {
      return null;
    }
    if (!cycleStartDates.length) {
      return null;
    }
    const lastStartIso = cycleStartDates[cycleStartDates.length - 1];
    const lastStartDate = parseIsoDate(lastStartIso);
    if (!lastStartDate) {
      return null;
    }
    const diffMs = todayDate.getTime() - lastStartDate.getTime();
    if (diffMs < 0) {
      return null;
    }
    const daysSinceLastStart = Math.floor(diffMs / MS_PER_DAY);
    const recentLengths = completedCycleLengths.slice(-3);
    const averageCycleLength = Math.round(
      recentLengths.reduce((sum, value) => sum + value, 0) / recentLengths.length
    );
    if (!Number.isFinite(averageCycleLength) || averageCycleLength <= 0) {
      return null;
    }
    const remainingDays = averageCycleLength - daysSinceLastStart;
    const clampedRemaining = remainingDays > 0 ? remainingDays : 0;
    if (!Number.isFinite(clampedRemaining)) {
      return null;
    }
    if (clampedRemaining === 1) {
      return "Periode erwartet in 1 Tag";
    }
    return `Periode erwartet in ${clampedRemaining} Tagen`;
  }, [
    completedCycleLengths,
    cycleStartDates,
    hasActivePeriod,
    todayDate,
  ]);

  const ovulationBadgeLabel = useMemo(() => {
    if (!cycleAnalysis) {
      return null;
    }

    const { daysUntilOvulation, isOvulationDay, isInFertileWindow, cycleCount } = cycleAnalysis;
    const uncertaintyPrefix = cycleCount < 3 ? "~" : "";

    if (isOvulationDay) {
      return `${uncertaintyPrefix}Eisprung heute (geschätzt)`;
    }

    if (daysUntilOvulation !== null && daysUntilOvulation > 0 && daysUntilOvulation <= 7) {
      return `${uncertaintyPrefix}Eisprung in ${daysUntilOvulation} ${daysUntilOvulation === 1 ? "Tag" : "Tagen"}`;
    }

    if (isInFertileWindow && daysUntilOvulation !== null && daysUntilOvulation < 0) {
      return `${uncertaintyPrefix}Fruchtbares Fenster`;
    }

    return null;
  }, [cycleAnalysis]);

  const todayCycleComparisonBadge = useMemo((): { label: string; className: string } | null => {
    if (!hasDailyEntryForToday) return null;
    const todayEntry = annotatedDailyEntries.find(({ entry }) => entry.date === today);
    if (!todayEntry || !todayEntry.cycleDay) return null;
    const painValue = typeof todayEntry.entry.painNRS === "number" ? todayEntry.entry.painNRS : null;
    if (typeof painValue !== "number") return null;
    const overlayEntry = cycleOverlay.find((item) => item.cycleDay === todayEntry.cycleDay);
    if (!overlayEntry || typeof overlayEntry.painAvg !== "number") return null;
    const diff = painValue - overlayEntry.painAvg;
    const tolerance = 0.1;
    if (diff < -tolerance) {
      return { label: "Besser als Durchschnitt", className: "bg-emerald-100 text-emerald-700" };
    }
    if (diff > tolerance) {
      return { label: "Schlechter als Durchschnitt", className: "bg-rose-100 text-rose-700" };
    }
    return { label: "Wie der Durchschnitt", className: "bg-amber-100 text-amber-700" };
  }, [annotatedDailyEntries, cycleOverlay, hasDailyEntryForToday, today]);

  // Correlation data: Cycle comparison strips (last 6 cycles)
  const cycleStrips = useMemo(() => {
    if (cycleStartDates.length === 0) return null;

    const MAX_CYCLES = 6;
    const MAX_DAYS = 10;
    const starts = [...cycleStartDates].sort().slice(-MAX_CYCLES);

    const cycles: Array<{
      startDate: string;
      days: Array<{
        cycleDay: number;
        pain: number | null;
        pbac: number | null;
        isBleeding: boolean;
      }>;
    }> = [];

    starts.forEach((startDate, idx) => {
      const nextStart = starts[idx + 1];
      const entries = annotatedDailyEntries.filter(({ entry, cycleDay }) => {
        if (!cycleDay || cycleDay > MAX_DAYS) return false;
        if (entry.date < startDate) return false;
        if (nextStart && entry.date >= nextStart) return false;
        return true;
      });

      const days = entries.map(({ entry, cycleDay }) => ({
        cycleDay: cycleDay!,
        pain: typeof entry.painNRS === "number" ? entry.painNRS : null,
        pbac: typeof entry.bleeding?.pbacScore === "number" ? entry.bleeding.pbacScore : null,
        isBleeding: hasBleedingForEntry(entry),
      }));

      cycles.push({ startDate, days });
    });

    return cycles.length > 0 ? cycles : null;
  }, [annotatedDailyEntries, cycleStartDates]);

  // Correlation data: Day-of-period average pain
  const dayOfPeriodPain = useMemo(() => {
    const MAX_DAYS = 7;
    const dayStats = new Map<number, { painSum: number; count: number }>();

    annotatedDailyEntries.forEach(({ entry, cycleDay }) => {
      if (!cycleDay || cycleDay > MAX_DAYS) return;
      if (!hasBleedingForEntry(entry)) return;
      if (typeof entry.painNRS !== "number") return;

      const current = dayStats.get(cycleDay) ?? { painSum: 0, count: 0 };
      current.painSum += entry.painNRS;
      current.count += 1;
      dayStats.set(cycleDay, current);
    });

    const data = Array.from(dayStats.entries())
      .map(([day, stats]) => ({
        day,
        label: `Tag ${day}`,
        avgPain: Number((stats.painSum / stats.count).toFixed(1)),
        count: stats.count,
      }))
      .sort((a, b) => a.day - b.day);

    return data.length >= 2 ? data : null;
  }, [annotatedDailyEntries]);

  // Correlation data: Pain vs PBAC scatter with trend
  const painBleedingScatter = useMemo(() => {
    const points: Array<{ x: number; y: number; date: string }> = [];

    derivedDailyEntries.forEach((entry) => {
      if (!hasBleedingForEntry(entry)) return;
      const pbac = entry.bleeding?.pbacScore;
      const pain = entry.painNRS;
      if (typeof pbac !== "number" || typeof pain !== "number") return;
      points.push({ x: pbac, y: pain, date: entry.date });
    });

    if (points.length < 3) return null;

    // Compute linear regression for trend line
    const n = points.length;
    const sumX = points.reduce((acc, p) => acc + p.x, 0);
    const sumY = points.reduce((acc, p) => acc + p.y, 0);
    const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
    const sumX2 = points.reduce((acc, p) => acc + p.x * p.x, 0);

    const denominator = n * sumX2 - sumX * sumX;
    let slope = 0;
    let intercept = sumY / n;

    if (denominator !== 0) {
      slope = (n * sumXY - sumX * sumY) / denominator;
      intercept = (sumY - slope * sumX) / n;
    }

    // Compute Pearson correlation
    const meanX = sumX / n;
    const meanY = sumY / n;
    const diffX = points.map((p) => p.x - meanX);
    const diffY = points.map((p) => p.y - meanY);
    const sumDiffXY = diffX.reduce((acc, dx, i) => acc + dx * diffY[i], 0);
    const sumDiffX2 = diffX.reduce((acc, dx) => acc + dx * dx, 0);
    const sumDiffY2 = diffY.reduce((acc, dy) => acc + dy * dy, 0);
    const r = sumDiffX2 > 0 && sumDiffY2 > 0 ? sumDiffXY / Math.sqrt(sumDiffX2 * sumDiffY2) : 0;

    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));

    const interpretation =
      Math.abs(r) >= 0.5
        ? r > 0
          ? "Starker Zusammenhang"
          : "Starker negativer Zusammenhang"
        : Math.abs(r) >= 0.3
          ? r > 0
            ? "Moderater Zusammenhang"
            : "Moderater negativer Zusammenhang"
          : "Kein klarer Zusammenhang";

    return {
      points,
      r: Number(r.toFixed(2)),
      n: points.length,
      interpretation,
      trendLine: {
        start: { x: minX, y: slope * minX + intercept },
        end: { x: maxX, y: slope * maxX + intercept },
      },
    };
  }, [derivedDailyEntries]);

  // Time correlation graph data - uses shared cycleOvulationData
  const timeCorrelationData = useMemo(() => {
    if (!cycleOvulationData || cycleOvulationData.cycles.length === 0) return null;

    const MAX_CYCLES = 12;
    // Use the last MAX_CYCLES from the shared data
    const cycles = cycleOvulationData.cycles.slice(-MAX_CYCLES).map(cycle => ({
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      length: cycle.length,
      ovulationDay: cycle.ovulationDay,
      ovulationConfidence: cycle.ovulationConfidence,
      ovulationMethod: cycle.ovulationMethod,
      entries: cycle.entries,
    }));

    return cycles.length > 0 ? cycles : null;
  }, [cycleOvulationData]);

  // Aligned time correlation data based on selected mode
  const alignedTimeCorrelationData = useMemo(() => {
    if (!timeCorrelationData) return null;

    const alignDay = (cycleDay: number, ovulationDay: number | null): number => {
      if (timeCorrelationAlignment === "period") {
        return cycleDay;
      }
      // Align to ovulation (ovulation = day 0)
      if (!ovulationDay) return cycleDay;
      return cycleDay - ovulationDay;
    };

    return timeCorrelationData.map((cycle) => ({
      ...cycle,
      alignedEntries: cycle.entries.map(({ cycleDay, entry }) => ({
        alignedDay: alignDay(cycleDay, cycle.ovulationDay),
        cycleDay,
        entry,
      })),
    }));
  }, [timeCorrelationData, timeCorrelationAlignment]);

  // Heat strip data for time correlation graph
  const timeCorrelationHeatStrips = useMemo(() => {
    if (!alignedTimeCorrelationData) return null;

    const SYMPTOM_KEYS: SymptomKey[] = [
      "dysmenorrhea",
      "fatigue",
      "bloating",
      "deepDyspareunia",
      "pelvicPainNonMenses",
      "dyschezia",
      "dysuria",
    ];

    const SYMPTOM_LABELS: Record<SymptomKey, string> = {
      dysmenorrhea: "Regelschmerzen",
      fatigue: "Erschöpfung",
      bloating: "Blähungen",
      deepDyspareunia: "Schmerz b. Sex",
      pelvicPainNonMenses: "Beckenschmerz",
      dyschezia: "Stuhlgang",
      dysuria: "Blase",
    };

    // Pain location groups with their child regions
    const LOCATION_GROUPS = [
      {
        id: "head-neck",
        label: "Kopf/Nacken",
        regions: ["head", "neck"],
        regionLabels: { head: "Kopf", neck: "Nacken" },
      },
      {
        id: "back",
        label: "Rücken",
        regions: ["upper_back_left", "upper_back_right", "mid_back_left", "mid_back_right", "lower_back"],
        regionLabels: {
          upper_back_left: "Ob. Rücken li.",
          upper_back_right: "Ob. Rücken re.",
          mid_back_left: "Mi. Rücken li.",
          mid_back_right: "Mi. Rücken re.",
          lower_back: "LWS/Kreuzbein",
        },
      },
      {
        id: "upper-body",
        label: "Oberbauch",
        regions: ["chest_left", "chest_right", "upper_abdomen_left", "upper_abdomen", "upper_abdomen_right"],
        regionLabels: {
          chest_left: "Brust li.",
          chest_right: "Brust re.",
          upper_abdomen_left: "Oberbauch li.",
          upper_abdomen: "Oberbauch Mi.",
          upper_abdomen_right: "Oberbauch re.",
        },
      },
      {
        id: "lower-abdomen",
        label: "Unterbauch",
        regions: ["lower_abdomen_left", "lower_abdomen", "lower_abdomen_right"],
        regionLabels: {
          lower_abdomen_left: "Unterbauch li.",
          lower_abdomen: "Unterbauch Mi.",
          lower_abdomen_right: "Unterbauch re.",
        },
      },
      {
        id: "pelvis",
        label: "Becken",
        regions: ["pelvis_left", "pelvis_right", "uterus", "rectal", "vaginal"],
        regionLabels: {
          pelvis_left: "Becken li.",
          pelvis_right: "Becken re.",
          uterus: "Uterus",
          rectal: "Rektal",
          vaginal: "Vaginal",
        },
      },
      {
        id: "legs",
        label: "Beine/Hüfte",
        regions: ["hip_left", "hip_right", "upper_leg_left", "upper_leg_right", "knee_left", "knee_right", "lower_leg_left", "lower_leg_right"],
        regionLabels: {
          hip_left: "Hüfte li.",
          hip_right: "Hüfte re.",
          upper_leg_left: "Obersch. li.",
          upper_leg_right: "Obersch. re.",
          knee_left: "Knie li.",
          knee_right: "Knie re.",
          lower_leg_left: "Untersch. li.",
          lower_leg_right: "Untersch. re.",
        },
      },
    ] as const;

    // Get target cycles based on view mode
    // For "last" mode: show the most recent completed cycle, or ongoing if no completed cycles
    const targetCycles =
      timeCorrelationView === "last"
        ? (() => {
            // Find the most recent completed cycle
            const completedCycles = alignedTimeCorrelationData.filter(c => c.endDate !== null);
            if (completedCycles.length > 0) {
              return [completedCycles[completedCycles.length - 1]];
            }
            // If no completed cycles, show the ongoing one
            return alignedTimeCorrelationData.slice(-1);
          })()
        : alignedTimeCorrelationData;

    // Find day range across all target cycles
    let minDay = Infinity;
    let maxDay = -Infinity;
    targetCycles.forEach((cycle) => {
      cycle.alignedEntries.forEach(({ alignedDay }) => {
        if (alignedDay < minDay) minDay = alignedDay;
        if (alignedDay > maxDay) maxDay = alignedDay;
      });
    });

    if (!Number.isFinite(minDay) || !Number.isFinite(maxDay)) {
      return null;
    }

    // Clamp to reasonable range
    minDay = Math.max(minDay, timeCorrelationAlignment === "ovulation" ? -20 : 1);
    maxDay = Math.min(maxDay, timeCorrelationAlignment === "ovulation" ? 20 : 40);
    const dayRange = Array.from({ length: maxDay - minDay + 1 }, (_, i) => minDay + i);

    // Aggregate data for symptoms
    const symptomData = new Map<SymptomKey, Map<number, { sum: number; count: number }>>();
    SYMPTOM_KEYS.forEach((key) => symptomData.set(key, new Map()));

    // Aggregate data for location groups and individual regions
    const locationGroupData = new Map<string, Map<number, { sum: number; count: number }>>();
    const individualLocationData = new Map<string, Map<number, { sum: number; count: number }>>();

    LOCATION_GROUPS.forEach((group) => {
      locationGroupData.set(group.id, new Map());
      group.regions.forEach((regionId) => {
        individualLocationData.set(regionId, new Map());
      });
    });

    // Process entries
    targetCycles.forEach((cycle) => {
      cycle.alignedEntries.forEach(({ alignedDay, entry }) => {
        // Symptoms
        SYMPTOM_KEYS.forEach((key) => {
          const symptom = entry.symptoms?.[key];
          if (symptom?.present) {
            const value = typeof symptom.score === "number" ? symptom.score : 5;
            const dayMap = symptomData.get(key)!;
            const current = dayMap.get(alignedDay) ?? { sum: 0, count: 0 };
            current.sum += value;
            current.count += 1;
            dayMap.set(alignedDay, current);
          }
        });

        // Pain locations from painRegions, painMapRegionIds, and quickPainEvents
        const locationIntensities = new Map<string, number>();

        // From painRegions (detailed)
        entry.painRegions?.forEach((region) => {
          const regionId = region.regionId;
          const intensity = typeof region.nrs === "number" ? region.nrs : entry.painNRS ?? 5;
          const currentMax = locationIntensities.get(regionId) ?? 0;
          locationIntensities.set(regionId, Math.max(currentMax, intensity));
        });

        // From painMapRegionIds (simple list)
        entry.painMapRegionIds?.forEach((regionId) => {
          if (!locationIntensities.has(regionId)) {
            locationIntensities.set(regionId, entry.painNRS ?? 5);
          }
        });

        // From quickPainEvents
        entry.quickPainEvents?.forEach((event) => {
          const regionId = event.regionId;
          const intensity = event.intensity ?? entry.painNRS ?? 5;
          const currentMax = locationIntensities.get(regionId) ?? 0;
          locationIntensities.set(regionId, Math.max(currentMax, intensity));
        });

        // Aggregate into groups and individual locations
        locationIntensities.forEach((intensity, regionId) => {
          // Find which group this region belongs to
          const group = LOCATION_GROUPS.find((g) => (g.regions as readonly string[]).includes(regionId));
          if (group) {
            // Group aggregate
            const groupMap = locationGroupData.get(group.id)!;
            const groupCurrent = groupMap.get(alignedDay) ?? { sum: 0, count: 0 };
            groupCurrent.sum += intensity;
            groupCurrent.count += 1;
            groupMap.set(alignedDay, groupCurrent);

            // Individual region
            const regionMap = individualLocationData.get(regionId);
            if (regionMap) {
              const regionCurrent = regionMap.get(alignedDay) ?? { sum: 0, count: 0 };
              regionCurrent.sum += intensity;
              regionCurrent.count += 1;
              regionMap.set(alignedDay, regionCurrent);
            }
          }
        });
      });
    });

    // Build symptom rows
    const symptomRows: Array<{
      key: string;
      label: string;
      type: "symptom";
      values: Map<number, number | null>;
    }> = [];

    SYMPTOM_KEYS.forEach((key) => {
      const dayMap = symptomData.get(key)!;
      const values = new Map<number, number | null>();
      dayRange.forEach((day) => {
        const data = dayMap.get(day);
        values.set(day, data ? data.sum / data.count : null);
      });
      symptomRows.push({ key, label: SYMPTOM_LABELS[key], type: "symptom", values });
    });

    // Build location group rows (with children for expansion)
    const locationGroups: Array<{
      id: string;
      label: string;
      values: Map<number, number | null>;
      children: Array<{
        id: string;
        label: string;
        values: Map<number, number | null>;
      }>;
    }> = [];

    LOCATION_GROUPS.forEach((group) => {
      const groupMap = locationGroupData.get(group.id)!;
      const groupValues = new Map<number, number | null>();
      dayRange.forEach((day) => {
        const data = groupMap.get(day);
        groupValues.set(day, data ? data.sum / data.count : null);
      });

      const children: typeof locationGroups[number]["children"] = [];
      group.regions.forEach((regionId) => {
        const regionMap = individualLocationData.get(regionId);
        if (regionMap) {
          const regionValues = new Map<number, number | null>();
          dayRange.forEach((day) => {
            const data = regionMap.get(day);
            regionValues.set(day, data ? data.sum / data.count : null);
          });
          // Only include if there's any data
          if (Array.from(regionValues.values()).some((v) => v !== null)) {
            children.push({
              id: regionId,
              label: group.regionLabels[regionId as keyof typeof group.regionLabels] ?? regionId,
              values: regionValues,
            });
          }
        }
      });

      locationGroups.push({
        id: group.id,
        label: group.label,
        values: groupValues,
        children,
      });
    });

    // Build top graph data (cycle overview with bleeding, pain, ovulation)
    const topGraphData: Array<{
      alignedDay: number;
      bleedingValue: number;
      painNRS: number | null;
      impactNRS: number | null;
      isOvulation: boolean;
      isFertile: boolean;
    }> = [];

    // For overlay mode, we need to aggregate across cycles
    if (timeCorrelationView === "overlay") {
      const dayAggregates = new Map<
        number,
        {
          bleedingSum: number;
          bleedingCount: number;
          painSum: number;
          painCount: number;
          impactSum: number;
          impactCount: number;
          ovulationCount: number;
          fertileCount: number;
          totalCycles: number;
        }
      >();

      targetCycles.forEach((cycle) => {
        const cycleOvulationDay = cycle.ovulationDay
          ? timeCorrelationAlignment === "ovulation"
            ? 0
            : cycle.ovulationDay
          : null;

        cycle.alignedEntries.forEach(({ alignedDay, entry }) => {
          const current = dayAggregates.get(alignedDay) ?? {
            bleedingSum: 0,
            bleedingCount: 0,
            painSum: 0,
            painCount: 0,
            impactSum: 0,
            impactCount: 0,
            ovulationCount: 0,
            fertileCount: 0,
            totalCycles: 0,
          };

          current.totalCycles += 1;

          if (hasBleedingForEntry(entry)) {
            const pbac = entry.bleeding?.pbacScore ?? 5;
            current.bleedingSum += pbac;
            current.bleedingCount += 1;
          }

          if (typeof entry.painNRS === "number") {
            current.painSum += entry.painNRS;
            current.painCount += 1;
          }

          if (typeof entry.impactNRS === "number") {
            current.impactSum += entry.impactNRS;
            current.impactCount += 1;
          }

          if (cycleOvulationDay !== null && alignedDay === cycleOvulationDay) {
            current.ovulationCount += 1;
          }

          if (cycleOvulationDay !== null) {
            const fertileStart = cycleOvulationDay - 5;
            const fertileEnd = cycleOvulationDay + 1;
            if (alignedDay >= fertileStart && alignedDay <= fertileEnd) {
              current.fertileCount += 1;
            }
          }

          dayAggregates.set(alignedDay, current);
        });
      });

      dayRange.forEach((day) => {
        const data = dayAggregates.get(day);
        topGraphData.push({
          alignedDay: day,
          bleedingValue: data && data.bleedingCount > 0 ? data.bleedingSum / data.bleedingCount : 0,
          painNRS: data && data.painCount > 0 ? data.painSum / data.painCount : null,
          impactNRS: data && data.impactCount > 0 ? data.impactSum / data.impactCount : null,
          isOvulation: data ? data.ovulationCount >= data.totalCycles / 2 : false,
          isFertile: data ? data.fertileCount >= data.totalCycles / 2 : false,
        });
      });
    } else {
      // Single cycle mode
      const cycle = targetCycles[0];
      if (cycle) {
        const cycleOvulationDay = cycle.ovulationDay
          ? timeCorrelationAlignment === "ovulation"
            ? 0
            : cycle.ovulationDay
          : null;

        dayRange.forEach((day) => {
          const entryData = cycle.alignedEntries.find((e) => e.alignedDay === day);
          const entry = entryData?.entry;

          const isOvulation = cycleOvulationDay !== null && day === cycleOvulationDay;
          let isFertile = false;
          if (cycleOvulationDay !== null) {
            const fertileStart = cycleOvulationDay - 5;
            const fertileEnd = cycleOvulationDay + 1;
            isFertile = day >= fertileStart && day <= fertileEnd;
          }

          topGraphData.push({
            alignedDay: day,
            bleedingValue: entry && hasBleedingForEntry(entry) ? entry.bleeding?.pbacScore ?? 5 : 0,
            painNRS: entry?.painNRS ?? null,
            impactNRS: entry?.impactNRS ?? null,
            isOvulation,
            isFertile,
          });
        });
      }
    }

    // Find ovulation day for reference line
    // In ovulation alignment: always day 0
    // In period alignment with single cycle: use that cycle's ovulation day
    // In period alignment with overlay: use confidence-weighted average
    let ovulationDay: number | null;
    if (timeCorrelationAlignment === "ovulation") {
      ovulationDay = 0;
    } else if (targetCycles.length === 1) {
      ovulationDay = targetCycles[0]?.ovulationDay ?? null;
    } else {
      // Calculate confidence-weighted average ovulation day for overlay mode
      let totalWeight = 0;
      let weightedSum = 0;
      targetCycles.forEach((cycle) => {
        if (cycle.ovulationDay !== null) {
          const weight = cycle.ovulationConfidence ?? 50;
          weightedSum += cycle.ovulationDay * weight;
          totalWeight += weight;
        }
      });
      ovulationDay = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
    }

    const hasSymptomData = symptomRows.some((row) => Array.from(row.values.values()).some((v) => v !== null));
    const hasLocationData = locationGroups.some((group) =>
      Array.from(group.values.values()).some((v) => v !== null)
    );

    // Calculate gesamt (total) pain as max across all locations per day
    const gesamtPainValues = new Map<number, number | null>();
    dayRange.forEach((day) => {
      let maxPain: number | null = null;
      locationGroups.forEach((group) => {
        const groupValue = group.values.get(day);
        if (groupValue !== null && groupValue !== undefined) {
          maxPain = maxPain === null ? groupValue : Math.max(maxPain, groupValue);
        }
        group.children.forEach((child) => {
          const childValue = child.values.get(day);
          if (childValue !== null && childValue !== undefined) {
            maxPain = maxPain === null ? childValue : Math.max(maxPain, childValue);
          }
        });
      });
      gesamtPainValues.set(day, maxPain);
    });

    // Build per-cycle bleeding data for expandable view
    // Includes ALL days in dayRange with correct ovulation/fertility markers
    const cycleBleedingRows: Array<{
      cycleIndex: number;
      startDate: string;
      ovulationDay: number | null;
      values: Map<number, { bleedingValue: number; isOvulation: boolean; isFertile: boolean }>;
    }> = [];

    if (timeCorrelationView === "overlay") {
      targetCycles.forEach((cycle, idx) => {
        const cycleOvulationDay = cycle.ovulationDay
          ? timeCorrelationAlignment === "ovulation"
            ? 0
            : cycle.ovulationDay
          : null;

        // Calculate fertile window once for this cycle
        const fertileStart = cycleOvulationDay !== null ? cycleOvulationDay - 5 : null;
        const fertileEnd = cycleOvulationDay !== null ? cycleOvulationDay + 1 : null;

        // Build a map of alignedDay -> entry for quick lookup
        const entryByDay = new Map<number, DailyEntry>();
        cycle.alignedEntries.forEach(({ alignedDay, entry }) => {
          entryByDay.set(alignedDay, entry);
        });

        // Build values for ALL days in dayRange (not just days with entries)
        const values = new Map<number, { bleedingValue: number; isOvulation: boolean; isFertile: boolean }>();
        dayRange.forEach((day) => {
          const entry = entryByDay.get(day);
          const isOvulation = cycleOvulationDay !== null && day === cycleOvulationDay;
          const isFertile = fertileStart !== null && fertileEnd !== null &&
            day >= fertileStart && day <= fertileEnd;

          values.set(day, {
            bleedingValue: entry && hasBleedingForEntry(entry) ? entry.bleeding?.pbacScore ?? 5 : 0,
            isOvulation,
            isFertile,
          });
        });

        cycleBleedingRows.push({
          cycleIndex: idx + 1,
          startDate: cycle.startDate,
          ovulationDay: cycleOvulationDay,
          values,
        });
      });
    }

    // Build per-cycle symptom data for expandable view
    const cycleSymptomRows: Array<{
      cycleIndex: number;
      startDate: string;
      symptomValues: Map<SymptomKey, Map<number, number | null>>;
    }> = [];

    if (timeCorrelationView === "overlay") {
      targetCycles.forEach((cycle, idx) => {
        const symptomValues = new Map<SymptomKey, Map<number, number | null>>();

        SYMPTOM_KEYS.forEach((key) => {
          const dayValues = new Map<number, number | null>();
          dayRange.forEach((day) => dayValues.set(day, null));
          symptomValues.set(key, dayValues);
        });

        cycle.alignedEntries.forEach(({ alignedDay, entry }) => {
          SYMPTOM_KEYS.forEach((key) => {
            const symptom = entry.symptoms?.[key];
            if (symptom?.present) {
              const value = typeof symptom.score === "number" ? symptom.score : 5;
              symptomValues.get(key)!.set(alignedDay, value);
            }
          });
        });

        cycleSymptomRows.push({
          cycleIndex: idx + 1,
          startDate: cycle.startDate,
          symptomValues,
        });
      });
    }

    // Build per-cycle Gesamt pain data for expandable view
    const cycleGesamtRows: Array<{
      cycleIndex: number;
      startDate: string;
      values: Map<number, number | null>;
    }> = [];

    if (timeCorrelationView === "overlay") {
      targetCycles.forEach((cycle, idx) => {
        const values = new Map<number, number | null>();
        dayRange.forEach((day) => values.set(day, null));

        cycle.alignedEntries.forEach(({ alignedDay, entry }) => {
          // Collect max pain across all locations for this entry
          let maxPain: number | null = null;

          entry.painRegions?.forEach((region) => {
            const intensity = typeof region.nrs === "number" ? region.nrs : entry.painNRS ?? 5;
            maxPain = maxPain === null ? intensity : Math.max(maxPain, intensity);
          });

          entry.painMapRegionIds?.forEach(() => {
            const intensity = entry.painNRS ?? 5;
            maxPain = maxPain === null ? intensity : Math.max(maxPain, intensity);
          });

          entry.quickPainEvents?.forEach((event) => {
            const intensity = event.intensity ?? entry.painNRS ?? 5;
            maxPain = maxPain === null ? intensity : Math.max(maxPain, intensity);
          });

          if (maxPain !== null) {
            values.set(alignedDay, maxPain);
          }
        });

        cycleGesamtRows.push({
          cycleIndex: idx + 1,
          startDate: cycle.startDate,
          values,
        });
      });
    }

    // Sort cycle rows by date descending (newest first)
    cycleBleedingRows.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    cycleSymptomRows.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    cycleGesamtRows.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    return {
      symptomRows,
      locationGroups,
      dayRange,
      topGraphData,
      ovulationDay,
      cycleCount: targetCycles.length,
      hasData: hasSymptomData || hasLocationData,
      gesamtPainValues,
      cycleBleedingRows,
      cycleSymptomRows,
      cycleGesamtRows,
    };
  }, [alignedTimeCorrelationData, timeCorrelationAlignment, timeCorrelationView]);

  const backupPayload = useMemo<BackupPayload>(
    () => ({
      version: 1,
      exportedAt: new Date().toISOString(),
      dailyEntries: derivedDailyEntries,
      weeklyReports,
      monthlyEntries,
      featureFlags,
    }),
    [derivedDailyEntries, weeklyReports, monthlyEntries, featureFlags]
  );

  const urinaryStats = useMemo(() => {
    if (!activeUrinary) return null;
    const relevant = dailyEntries.filter((entry) => entry.urinaryOpt);
    if (!relevant.length) return null;
    const urgencyValues = relevant
      .map((entry) => entry.urinaryOpt?.urgency)
      .filter((value): value is number => typeof value === "number");
    const nocturiaValues = relevant
      .map((entry) => entry.urinaryOpt?.nocturia)
      .filter((value): value is number => typeof value === "number");
    const leakDays = relevant.filter((entry) => (entry.urinaryOpt?.leaksCount ?? 0) > 0).length;
    return {
      avgUrgency: urgencyValues.length
        ? Number((urgencyValues.reduce((sum, value) => sum + value, 0) / urgencyValues.length).toFixed(1))
        : null,
      avgNocturia: nocturiaValues.length
        ? Number((nocturiaValues.reduce((sum, value) => sum + value, 0) / nocturiaValues.length).toFixed(1))
        : null,
      leakRate: relevant.length ? Number(((leakDays / relevant.length) * 100).toFixed(1)) : null,
    };
  }, [activeUrinary, dailyEntries]);

  const headacheStats = useMemo(() => {
    if (!activeHeadache) return null;
    const relevant = dailyEntries.filter((entry) => entry.headacheOpt);
    if (!relevant.length) return null;
    const months = new Map<string, { headacheDays: number }>();
    let headacheDaysTotal = 0;
    const nrsValues: number[] = [];
    relevant.forEach((entry) => {
      const month = entry.date.slice(0, 7);
      const stats = months.get(month) ?? { headacheDays: 0 };
      if (entry.headacheOpt?.present) {
        stats.headacheDays += 1;
        headacheDaysTotal += 1;
        if (typeof entry.headacheOpt.nrs === "number") {
          nrsValues.push(entry.headacheOpt.nrs);
        }
      }
      months.set(month, stats);
    });
    const avgPerMonth = months.size ? Number((headacheDaysTotal / months.size).toFixed(1)) : null;
    const avgNrs = nrsValues.length
      ? Number((nrsValues.reduce((sum, value) => sum + value, 0) / nrsValues.length).toFixed(1))
      : null;
    return { avgPerMonth, avgNrs };
  }, [activeHeadache, dailyEntries]);

  const dizzinessStats = useMemo(() => {
    if (!activeDizziness) return null;
    const relevant = dailyEntries.filter((entry) => entry.dizzinessOpt);
    if (!relevant.length) return null;
    const presentDays = relevant.filter((entry) => entry.dizzinessOpt?.present).length;
    const nrsValues = relevant
      .filter((entry) => entry.dizzinessOpt?.present && typeof entry.dizzinessOpt.nrs === "number")
      .map((entry) => entry.dizzinessOpt!.nrs!);
    const heavyDays = relevant.filter(
      (entry) => entry.dizzinessOpt?.present && isHeavyBleedToday(entry)
    ).length;
    const months = new Map<string, { dizzinessDays: number }>();
    relevant.forEach((entry) => {
      if (!entry.dizzinessOpt) return;
      const month = entry.date.slice(0, 7);
      const stats = months.get(month) ?? { dizzinessDays: 0 };
      if (entry.dizzinessOpt.present) {
        stats.dizzinessDays += 1;
      }
      months.set(month, stats);
    });
    const avgPerMonth = months.size
      ? Number(
          (
            Array.from(months.values()).reduce((sum, value) => sum + value.dizzinessDays, 0) / months.size
          ).toFixed(1)
        )
      : null;
    const avgNrs = nrsValues.length
      ? Number((nrsValues.reduce((sum, value) => sum + value, 0) / nrsValues.length).toFixed(1))
      : null;
    return { avgPerMonth, avgNrs, presentDays, heavyDays };
  }, [activeDizziness, dailyEntries]);

  const storageStatusMessages = useMemo(() => {
    const messages = new Set<string>();
    if (!storageReady) {
      messages.add("Speicher wird initialisiert …");
    }
    storageErrors.forEach((message) => {
      if (message) messages.add(message);
    });
    if (hasMemoryFallback) {
      messages.add("IndexedDB blockiert – Speicherung aktuell nur temporär.");
    }
    if (storageUnavailable) {
      messages.add("Browser erlaubt keinen Zugriff auf persistente Speicherung.");
    }
    if (persistWarning) {
      messages.add(persistWarning);
    }
    return Array.from(messages);
  }, [hasMemoryFallback, persistWarning, storageErrors, storageReady, storageUnavailable]);

  const storageDriverText = storageDrivers.length ? storageDrivers.join(", ") : "unbekannt";
  const persistedLabel =
    persisted === true ? "dauerhaft aktiv" : persisted === false ? "nicht dauerhaft" : "Status unbekannt";
  const persistedBadgeClass =
    persisted === true ? "bg-emerald-100 text-emerald-700" : persisted === false ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
  const storageIsIndexedDb = storageDriverText.toLowerCase() === "indexeddb";
  const storagePersisted = persisted === true;
  const storageCompactPossible = storageIsIndexedDb && storagePersisted && storageStatusMessages.length === 0;
  const [storageDetailsExpanded, setStorageDetailsExpanded] = useState(!storageCompactPossible);

  useEffect(() => {
    if (!storageCompactPossible) {
      setStorageDetailsExpanded(true);
    } else {
      setStorageDetailsExpanded(false);
    }
  }, [storageCompactPossible]);
  const installHintVisible = showInstallHint && !isStandalone;
  const isHomeView = activeView === "home";
  const currentDataView = isHomeView ? "daily" : activeView;

  useEffect(() => {
    if (activeView !== "daily") {
      setDailyActiveCategory("overview");
    }
  }, [activeView]);

  const dailyCategoryCompletionTitles: Partial<
    Record<Exclude<DailyCategoryId, "overview">, string>
  > = useMemo(
    () => ({
      cervixMucus: "Cervixschleim",
      pain: "Schmerzen",
      symptoms: "Typische Endometriose-Symptome",
      bleeding: "Periode und Blutung",
      medication: TERMS.meds.label,
      sleep: "Schlaf",
      bowelBladder: "Darm & Blase",
      notes: "Notizen & Tags",
      optional: "Optionale Werte (Hilfsmittel nötig)",
    }),
    []
  );

  const dailyCategoryCompletion: Record<Exclude<DailyCategoryId, "overview">, boolean> = useMemo(
    () =>
      DAILY_CATEGORY_KEYS.reduce(
        (acc, categoryId) => {
          const sectionTitle = dailyCategoryCompletionTitles[categoryId];
          acc[categoryId] = sectionTitle ? Boolean(dailySectionCompletion[sectionTitle]) : false;
          return acc;
        },
        {} as Record<Exclude<DailyCategoryId, "overview">, boolean>
      ),
    [dailyCategoryCompletionTitles, dailySectionCompletion]
  );

  useEffect(() => {
    if (!pendingBleedingQuickAdd) {
      return;
    }
    if (dailyDraft.date !== today) {
      selectDailyDate(today);
      return;
    }
    const selectedItem = PBAC_PRODUCT_ITEMS.find((item) => item.id === pendingBleedingQuickAdd);
    if (!selectedItem) {
      setPendingBleedingQuickAdd(null);
      return;
    }
    setBleedingQuickAddOpen(false);
    let didAddProduct = false;
    setPbacCounts((prev) => {
      const current = prev[pendingBleedingQuickAdd] ?? 0;
      const nextValue = Math.min(PBAC_MAX_PRODUCT_COUNT, current + 1);
      if (current === nextValue) {
        return prev;
      }
      didAddProduct = true;
      return { ...prev, [pendingBleedingQuickAdd]: nextValue };
    });
    if (didAddProduct) {
      setBleedingQuickAddNotice({
        id: Date.now(),
        label: selectedItem.label,
        saturation: selectedItem.saturation,
        score: selectedItem.score,
        Icon: selectedItem.Icon,
      });
      if (bleedingQuickAddNoticeTimeoutRef.current) {
        window.clearTimeout(bleedingQuickAddNoticeTimeoutRef.current);
      }
      bleedingQuickAddNoticeTimeoutRef.current = window.setTimeout(() => {
        setBleedingQuickAddNotice(null);
      }, 2400);
    }
    setPendingBleedingQuickAdd(null);
  }, [
    dailyDraft.date,
    bleedingQuickAddNoticeTimeoutRef,
    pendingBleedingQuickAdd,
    selectDailyDate,
    setDailyDraft,
    setPbacCounts,
    setBleedingQuickAddOpen,
    setPendingBleedingQuickAdd,
    setBleedingQuickAddNotice,
    today,
  ]);

  useEffect(() => {
    if (!pendingPainQuickAdd) {
      return;
    }
    const normalized = normalizeQuickPainEvent(pendingPainQuickAdd);
    updateQuickPainEventsForDate(normalized.date, (events) => [...events, normalized]);
    if (
      pendingPainQuickAdd.source === "daily" &&
      dailyDraft.date !== normalized.date
    ) {
      selectDailyDate(normalized.date);
    }
    setPendingPainQuickAdd(null);
  }, [
    dailyDraft.date,
    pendingPainQuickAdd,
    selectDailyDate,
    setDailyDraft,
    updateQuickPainEventsForDate,
  ]);

  const categoryZeroStates = useMemo<
    Partial<Record<TrackableDailyCategoryId, boolean>>
  >(
    () => {
      const entry = dailyDraft;
      const isPainZero = (() => {
        const painRegions = entry.painRegions ?? [];
        const painMapRegionIds = entry.painMapRegionIds ?? [];
        const painQuality = entry.painQuality ?? [];
        const quickPainEvents = entry.quickPainEvents ?? [];
        const painNRS = typeof entry.painNRS === "number" ? entry.painNRS : 0;
        const impactNRS = typeof entry.impactNRS === "number" ? entry.impactNRS : 0;
        return (
          painRegions.length === 0 &&
          painMapRegionIds.length === 0 &&
          painQuality.length === 0 &&
          quickPainEvents.length === 0 &&
          painNRS <= 0 &&
          impactNRS <= 0
        );
      })();

      const isSymptomsZero = (() => {
        const symptomEntries = Object.entries(entry.symptoms ?? {}) as Array<[
          SymptomKey,
          { present?: boolean }
        ]>;
        if (!symptomEntries.length) {
          return true;
        }
        return symptomEntries.every(([, value]) => !value?.present);
      })();

      const isBleedingZero = (() => {
        const pbacZero = Object.values(pbacCounts).every((count) => count === 0);
        const derivedBleeding = hasBleedingForEntry({ ...entry, pbacCounts });
        const hasExtras = Boolean(entry.bleeding?.clots || entry.bleeding?.flooding);
        const pbacScore = typeof entry.bleeding?.pbacScore === "number" ? entry.bleeding.pbacScore : 0;
        return !derivedBleeding && !hasExtras && pbacScore <= 0 && pbacZero;
      })();

      const isMedicationZero = (() => {
        const meds = entry.rescueMeds ?? [];
        return meds.length === 0;
      })();

      return {
        pain: isPainZero,
        symptoms: isSymptomsZero,
        bleeding: isBleedingZero,
        medication: isMedicationZero,
      };
    },
    [dailyDraft, pbacCounts]
  );

  const confirmQuickActionReset = useCallback(
    (categoryId: TrackableDailyCategoryId) => {
      if (!dailyCategoryCompletion[categoryId]) {
        return true;
      }
      return window.confirm("Sollen die eingegebenen Werte gelöscht und auf 0 gesetzt werden?");
    },
    [dailyCategoryCompletion]
  );

  const handleQuickNoPain = useCallback(() => {
    if (!confirmQuickActionReset("pain")) {
      return;
    }
    updateQuickPainEventsForDate(dailyDraft.date, () => []);
    setDailyDraft((prev) => ({
      ...prev,
      painRegions: [],
      painMapRegionIds: [],
      painQuality: [],
      painNRS: 0,
      impactNRS: 0,
    }));
  }, [confirmQuickActionReset, dailyDraft.date, setDailyDraft, updateQuickPainEventsForDate]);

  const handleQuickNoSymptoms = useCallback(() => {
    if (!confirmQuickActionReset("symptoms")) {
      return;
    }
    setDailyDraft((prev) => {
      const existing = prev.symptoms ?? {};
      const cleared: DailyEntry["symptoms"] = {};
      (Object.keys(existing) as SymptomKey[]).forEach((key) => {
        cleared[key] = { present: false };
      });
      return { ...prev, symptoms: cleared };
    });
  }, [confirmQuickActionReset, setDailyDraft]);

  const handleQuickNoBleeding = useCallback(() => {
    if (!confirmQuickActionReset("bleeding")) {
      return;
    }
    setPbacCounts(createEmptyPbacCounts());
    setDailyDraft((prev) => ({
      ...prev,
      bleeding: {
        isBleeding: false,
        clots: false,
        flooding: false,
      },
    }));
  }, [confirmQuickActionReset, setDailyDraft, setPbacCounts]);

  const handleQuickNoMedication = useCallback(() => {
    if (!confirmQuickActionReset("medication")) {
      return;
    }
    setDailyDraft((prev) => ({
      ...prev,
      rescueMeds: [],
    }));
  }, [confirmQuickActionReset, setDailyDraft]);

  const startRescueWizard = useCallback(() => {
    setRescueWizard({ step: 1 });
  }, []);

  const resetRescueWizard = useCallback(() => {
    setRescueWizard(null);
    setCustomRescueName("");
  }, []);

  const handleRescueNameSelect = useCallback((name: string) => {
    setRescueWizard((prev) => ({ ...(prev ?? { step: 1 }), name, step: 2 }));
  }, []);

  const handleRescueWizardNext = useCallback(() => {
    setRescueWizard((prev) => {
      if (!prev) return prev;
      if (prev.step === 1 && prev.name) return { ...prev, step: 2 };
      if (prev.step === 2) return { ...prev, step: 3 };
      return prev;
    });
  }, []);

  const handleRescueWizardBack = useCallback(() => {
    setRescueWizard((prev) => {
      if (!prev || prev.step === 1) return prev;
      return { ...prev, step: (prev.step - 1) as 1 | 2 | 3 };
    });
  }, []);

  const handleRescueWizardSave = useCallback(() => {
    setRescueWizard((current) => {
      if (!current?.name || current.doseMg === undefined || !current.time) {
        return current;
      }
      const nextDose = { name: current.name, doseMg: current.doseMg, time: current.time };
      setDailyDraft((prev) => ({
        ...prev,
        rescueMeds: [...(prev.rescueMeds ?? []), nextDose],
      }));
      return null;
    });
  }, [setDailyDraft]);

  const handleCustomRescueSubmit = useCallback(() => {
    const trimmed = customRescueName.trim();
    if (!trimmed) {
      return;
    }
    setCustomRescueMeds((prev) => {
      const next = Array.from(new Set([...prev, trimmed]));
      return next;
    });
    setRescueWizard({ step: 2, name: trimmed });
    setCustomRescueName("");
  }, [customRescueName, setCustomRescueMeds]);

  const removeRescueMed = useCallback(
    (index: number) => {
      setDailyDraft((prev) => ({
        ...prev,
        rescueMeds: (prev.rescueMeds ?? []).filter((_, i) => i !== index),
      }));
    },
    [setDailyDraft]
  );

  const resetPainQuickAddState = useCallback(() => {
    setPainQuickStep(1);
    setPainQuickRegion(null);
    setPainQuickQualities([]);
    setPainQuickIntensity(5);
    setPainQuickTimesOfDay([]);
  }, []);

  const handlePainQuickRegionSelect = useCallback((regionId: string) => {
    setPainQuickRegion(regionId);
    setPainQuickQualities([]);
    setPainQuickStep(2);
  }, []);

  const handlePainQuickQualitySelect = useCallback((quality: DailyEntry["painQuality"][number]) => {
    setPainQuickQualities((prev) => {
      const hasQuality = prev.includes(quality);
      const next = hasQuality ? prev.filter((item) => item !== quality) : [...prev, quality];
      return next;
    });
  }, []);

  const handlePainQuickTimeToggle = useCallback((time: PainTimeOfDay) => {
    setPainQuickTimesOfDay((prev) => {
      if (prev.includes(time)) {
        return prev.filter((entry) => entry !== time);
      }
      return [...prev, time];
    });
  }, []);

  const handlePainShortcut = useCallback(() => {
    resetPainQuickAddState();
    setPainQuickContext("shortcut");
    setPainQuickAddOpen(true);
  }, [resetPainQuickAddState]);

  const handlePainModuleQuickAdd = useCallback(() => {
    resetPainQuickAddState();
    setPainQuickContext("module");
    setPainQuickAddOpen(true);
  }, [resetPainQuickAddState]);

  const handlePainQuickClose = useCallback(() => {
    setPainQuickAddOpen(false);
    setPainQuickContext("shortcut");
    resetPainQuickAddState();
  }, [resetPainQuickAddState]);

  const handlePainQuickBack = useCallback(() => {
    setPainQuickStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3) : prev));
  }, []);

  const handlePainQuickConfirm = useCallback(() => {
    const requiresTimeSelection = painQuickContext === "module";
    if (!painQuickRegion || !painQuickQualities.length || (requiresTimeSelection && painQuickTimesOfDay.length === 0)) {
      return;
    }
    const intensity = Math.max(0, Math.min(10, Math.round(painQuickIntensity)));
    if (painQuickContext === "module") {
      setDailyDraft((prev) => {
        const current = prev.painRegions ?? [];
        const nextRegions = [...current] as NonNullable<DailyEntry["painRegions"]>;
        const existingIndex = nextRegions.findIndex((region) => region.regionId === painQuickRegion);
        const existingRegion = existingIndex === -1 ? null : nextRegions[existingIndex];
        const mergedQualities = new Set(existingRegion?.qualities ?? []);
        painQuickQualities.forEach((quality) => mergedQualities.add(quality));
        let normalized = Array.from(mergedQualities) as DailyEntry["painQuality"];
        if (painQuickRegion === HEAD_REGION_ID) {
          normalized = sanitizeHeadRegionQualities(normalized);
        } else {
          normalized = normalized.filter((entry) => !MIGRAINE_QUALITY_SET.has(entry)) as DailyEntry["painQuality"];
        }
        const existingTimes = Array.isArray(existingRegion?.timeOfDay)
          ? (existingRegion.timeOfDay.filter((time) => PAIN_TIME_OF_DAY_SET.has(time as PainTimeOfDay)) as PainTimeOfDay[])
          : [];
        const mergedTimes = Array.from(new Set([...existingTimes, ...painQuickTimesOfDay])) as PainTimeOfDay[];
        const nextGranularity: PainGranularity = mergedTimes.length ? "dritteltag" : existingRegion?.granularity ?? "tag";
        const nextRegion: NonNullable<DailyEntry["painRegions"]>[number] = {
          ...(existingRegion ?? { regionId: painQuickRegion, nrs: intensity, qualities: [] as DailyEntry["painQuality"] }),
          regionId: painQuickRegion,
          nrs: intensity,
          qualities: normalized,
          timeOfDay: mergedTimes,
          granularity: nextGranularity,
        };
        if ("time" in nextRegion) {
          const { time: _omit, ...rest } = nextRegion as typeof nextRegion & { time?: string };
          nextRegions[existingIndex === -1 ? nextRegions.length : existingIndex] = rest;
        } else if (existingIndex === -1) {
          nextRegions.push(nextRegion);
        } else {
          nextRegions[existingIndex] = nextRegion;
        }
        const nextDraft = buildDailyDraftWithPainRegions(prev, nextRegions);
        return nextDraft;
      });
      setPainQuickAddOpen(false);
      resetPainQuickAddState();
      return;
    }

    const now = new Date();
    const timestamp = now.toISOString();
    const isShortcutContext = painQuickContext === "shortcut";
    const date = isShortcutContext ? formatDate(now) : dailyDraft.date;
    const source: PendingQuickPainAdd["source"] = isShortcutContext ? "shortcut" : "daily";
    const nextEvent: PendingQuickPainAdd = {
      id: now.getTime(),
      date,
      regionId: painQuickRegion,
      qualities: painQuickQualities,
      intensity,
      timestamp,
      source,
      ...(painQuickTimesOfDay.length && requiresTimeSelection
        ? { timeOfDay: painQuickTimesOfDay, granularity: "dritteltag" as const }
        : {}),
    };
    setPendingPainQuickAdd(nextEvent);
    setPainQuickAddOpen(false);
    resetPainQuickAddState();
  }, [
    dailyDraft.date,
    painQuickContext,
    painQuickIntensity,
    painQuickQualities,
    painQuickRegion,
    painQuickTimesOfDay,
    setDailyDraft,
    resetPainQuickAddState,
    setPendingPainQuickAdd,
  ]);

  const handleBleedingQuickAddSelect = useCallback((itemId: PbacProductItemId) => {
    setPendingBleedingQuickAdd(itemId);
    setBleedingQuickAddOpen(false);
  }, []);
  const bleedingShortcutProducts = useMemo(() => {
    if (dailyDraft.date !== today) {
      return {
        dots: [] as PbacSaturation[],
        summary: { light: 0, medium: 0, heavy: 0 } as Record<PbacSaturation, number>,
        total: 0,
      };
    }
    const summary: Record<PbacSaturation, number> = { light: 0, medium: 0, heavy: 0 };
    const dots: PbacSaturation[] = [];
    PBAC_PRODUCT_ITEMS.forEach((item) => {
      const count = pbacCounts[item.id] ?? 0;
      if (!count) {
        return;
      }
      summary[item.saturation] += count;
      for (let index = 0; index < count; index += 1) {
        dots.push(item.saturation);
      }
    });
    return { dots, summary, total: dots.length };
  }, [dailyDraft.date, pbacCounts, today]);
  const periodShortcutAriaLabel = useMemo(() => {
    if (!bleedingShortcutProducts.total) {
      return "Periode: Produkt hinzufügen";
    }
    const detailParts = PBAC_SATURATION_ORDER.filter(
      (key) => bleedingShortcutProducts.summary[key] > 0
    ).map((key) => `${bleedingShortcutProducts.summary[key]}× ${PBAC_SATURATION_LABELS[key]}`);
    const details = detailParts.length ? ` – ${detailParts.join(", ")}` : "";
    return `Periode: ${bleedingShortcutProducts.total} Produkte${details}`;
  }, [bleedingShortcutProducts]);
  const painShortcutAriaLabel = useMemo(() => {
    if (!latestPainShortcutEvent) {
      return "Schmerzen schnell erfassen";
    }
    const timeLabel =
      formatPainTimeOfDayList(latestPainShortcutEvent.timeOfDay) ??
      formatShortTimeLabel(latestPainShortcutEvent.timestamp) ??
      (latestPainShortcutEvent.granularity === "tag" ? "Ganzer Tag" : null);
    const regionLabel = getRegionLabel(latestPainShortcutEvent.regionId);
    return timeLabel
      ? `Schmerz aktualisieren – ${regionLabel} ${timeLabel}`
      : `Schmerz aktualisieren – ${regionLabel}`;
  }, [latestPainShortcutEvent]);
  const BleedingQuickAddNoticeIcon = bleedingQuickAddNotice?.Icon;

  const dailyCategoryButtons = useMemo(() => {
    const baseButtons: Array<{
      id: Exclude<DailyCategoryId, "overview">;
      title: string;
      description: string;
      icon?: ComponentType<SVGProps<SVGSVGElement>>;
      quickActions?: Array<{ label: string; onClick: () => void }>;
    }> = [
      {
        id: "pain" as const,
        title: "Schmerzen",
        description: "Körperkarte, Intensität & Auswirkungen",
        icon: PainIcon,
        quickActions: [{ label: "Heute keine Schmerzen", onClick: handleQuickNoPain }],
      },
      {
        id: "symptoms" as const,
        title: "Symptome",
        description: "Typische Endometriose-Symptome dokumentieren",
        icon: SymptomsIcon,
        quickActions: [{ label: "Heute keine Symptome", onClick: handleQuickNoSymptoms }],
      },
      {
        id: "bleeding" as const,
        title: "Periode und Blutung",
        description: "Blutung, PBAC-Score & Begleitsymptome",
        icon: PeriodIcon,
        quickActions: [{ label: "Heute keine Periode", onClick: handleQuickNoBleeding }],
      },
      {
        id: "medication" as const,
        title: TERMS.meds.label,
        description: "Eingenommene Medikamente & Hilfen",
        icon: MedicationIcon,
        quickActions: [{ label: "Heute keine Medikamente", onClick: handleQuickNoMedication }],
      },
      {
        id: "sleep" as const,
        title: "Schlaf",
        description: "Dauer, Qualität & Aufwachphasen",
        icon: SleepIcon,
      },
      {
        id: "bowelBladder" as const,
        title: "Darm & Blase",
        description: "Verdauung & Blase im Blick behalten",
        icon: BauchIcon,
      },
      {
        id: "notes" as const,
        title: "Notizen & Tags",
        description: "Freitextnotizen und Tags ergänzen",
        icon: NotesTagsIcon,
      },
      {
        id: "optional" as const,
        title: "Optionale Werte",
        description: "Hilfsmittel- & Wearable-Daten erfassen",
        icon: OptionalValuesIcon,
      },
    ];

    if (featureFlags.billingMethod) {
      return [
        {
          id: "cervixMucus" as const,
          title: "Cervixschleim",
          description: "Beobachtung nach der Billings-Methode",
          icon: CervixMucusIcon,
          quickActions: undefined,
        },
        ...baseButtons,
      ];
    }

    return baseButtons;
  }, [featureFlags.billingMethod, handleQuickNoBleeding, handleQuickNoMedication, handleQuickNoPain, handleQuickNoSymptoms]);

  useEffect(() => {
    if (previousDailyScopeRef.current === resolvedDailyScopeKey) {
      return;
    }
    previousDailyScopeRef.current = resolvedDailyScopeKey;
    setDailyCategorySnapshots({});
    setDailyCategoryDirtyState({});
    previousDailyCategoryCompletionRef.current = createEmptyCategoryCompletion();
  }, [resolvedDailyScopeKey]);

  useEffect(() => {
    if (!resolvedDailyScopeKey) {
      return;
    }

    setDailyCategorySnapshots((prev) => {
      let changed = false;
      const next = { ...prev } as Partial<Record<TrackableDailyCategoryId, string>>;

      TRACKED_DAILY_CATEGORY_IDS.forEach((categoryId) => {
        if (next[categoryId]) {
          return;
        }
        const snapshot = extractDailyCategorySnapshot(dailyDraft, categoryId, featureFlags, pbacCounts);
        if (snapshot) {
          next[categoryId] = JSON.stringify(snapshot);
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [dailyDraft, featureFlags, pbacCounts, resolvedDailyScopeKey]);

  useEffect(() => {
    if (!resolvedDailyScopeKey) {
      return;
    }

    TRACKED_DAILY_CATEGORY_IDS.forEach((categoryId) => {
      if (dailyCategoryCompletion[categoryId]) {
        return;
      }

      const snapshotString = dailyCategorySnapshots[categoryId];
      if (!snapshotString) {
        return;
      }

      const currentSnapshot = extractDailyCategorySnapshot(
        dailyDraft,
        categoryId,
        featureFlags,
        pbacCounts
      );

      if (!currentSnapshot) {
        return;
      }

      const baselineSnapshot = JSON.parse(snapshotString) as CategorySnapshot;

      if (equalWithNullUndefined(baselineSnapshot, currentSnapshot)) {
        return;
      }

      const completionTitle = dailyCategoryCompletionTitles[categoryId];
      if (completionTitle) {
        sectionCompletionContextValue.setCompletion(resolvedDailyScopeKey, completionTitle, true);
      }
    });
  }, [
    dailyCategoryCompletion,
    dailyCategoryCompletionTitles,
    dailyCategorySnapshots,
    dailyDraft,
    featureFlags,
    pbacCounts,
    resolvedDailyScopeKey,
    sectionCompletionContextValue,
  ]);

  useEffect(() => {
    if (!resolvedDailyScopeKey) {
      previousDailyCategoryCompletionRef.current = createEmptyCategoryCompletion();
      return;
    }
    const prevCompletion = previousDailyCategoryCompletionRef.current;
    const nextCompletion: Record<TrackableDailyCategoryId, boolean> = { ...prevCompletion };
    const snapshotUpdates: Array<[TrackableDailyCategoryId, string]> = [];
    const dirtyResets: TrackableDailyCategoryId[] = [];
    TRACKED_DAILY_CATEGORY_IDS.forEach((categoryId) => {
      const completed = dailyCategoryCompletion[categoryId] ?? false;
      if (completed && !prevCompletion[categoryId]) {
        const snapshot = extractDailyCategorySnapshot(
          dailyDraft,
          categoryId,
          featureFlags,
          pbacCounts
        );
        if (snapshot) {
          snapshotUpdates.push([categoryId, JSON.stringify(snapshot)]);
        }
        dirtyResets.push(categoryId);
      }
      nextCompletion[categoryId] = completed;
    });
    previousDailyCategoryCompletionRef.current = nextCompletion;
    if (snapshotUpdates.length) {
      setDailyCategorySnapshots((prev) => {
        const next = { ...prev };
        snapshotUpdates.forEach(([categoryId, value]) => {
          next[categoryId] = value;
        });
        return next;
      });
    }
    if (dirtyResets.length) {
      setDailyCategoryDirtyState((prev) => {
        let changed = false;
        const next = { ...prev };
        dirtyResets.forEach((categoryId) => {
          if (next[categoryId]) {
            delete next[categoryId];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [dailyCategoryCompletion, dailyDraft, featureFlags, pbacCounts, resolvedDailyScopeKey]);

  useEffect(() => {
    if (!resolvedDailyScopeKey) {
      return;
    }
    const dirtyUpdates: Array<[TrackableDailyCategoryId, boolean]> = [];
    TRACKED_DAILY_CATEGORY_IDS.forEach((categoryId) => {
      const snapshotString = dailyCategorySnapshots[categoryId];
      if (!snapshotString) {
        return;
      }
      const currentSnapshot = extractDailyCategorySnapshot(
        dailyDraft,
        categoryId,
        featureFlags,
        pbacCounts
      );
      if (!currentSnapshot) {
        return;
      }
      const storedSnapshot = JSON.parse(snapshotString) as CategorySnapshot;
      const snapshotsEqual = equalWithNullUndefined(storedSnapshot, currentSnapshot);
      const completed = dailyCategoryCompletion[categoryId] ?? false;
      const wasDirty = Boolean(dailyCategoryDirtyState[categoryId]);
      if (completed) {
        if (!snapshotsEqual && !wasDirty) {
          dirtyUpdates.push([categoryId, true]);
        } else if (snapshotsEqual && wasDirty) {
          dirtyUpdates.push([categoryId, false]);
        }
      } else {
        const isDirty = !snapshotsEqual;
        if (isDirty !== wasDirty) {
          dirtyUpdates.push([categoryId, isDirty]);
        }
      }
    });
    if (dirtyUpdates.length) {
      setDailyCategoryDirtyState((prev) => {
        let changed = false;
        const next = { ...prev };
        dirtyUpdates.forEach(([categoryId, dirty]) => {
          if (dirty) {
            if (!next[categoryId]) {
              next[categoryId] = true;
              changed = true;
            }
          } else if (next[categoryId]) {
            delete next[categoryId];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [
    dailyCategoryCompletion,
    dailyCategoryCompletionTitles,
    dailyCategoryDirtyState,
    dailyCategorySnapshots,
    dailyDraft,
    featureFlags,
    pbacCounts,
    resolvedDailyScopeKey,
    sectionCompletionContextValue,
  ]);

  const applyPendingOverviewNavigation = (pending: PendingOverviewConfirm) => {
    if (pending.action === "change-date") {
      selectDailyDate(pending.targetDate, pending.options);
      return;
    }
    setActiveView("home");
  };

  const handleOverviewConfirmCancel = () => {
    setPendingOverviewConfirm(null);
  };

  const handleOverviewConfirmDiscard = () => {
    setPendingOverviewConfirm((pending) => {
      if (!pending) {
        return null;
      }
      const restoredEntry =
        typeof structuredClone === "function"
          ? structuredClone(lastSavedDailySnapshot)
          : (JSON.parse(JSON.stringify(lastSavedDailySnapshot)) as DailyEntry);
      setDailyDraft(restoredEntry);
      applyPendingOverviewNavigation(pending);
      return null;
    });
  };

  const handleOverviewConfirmSave = () => {
    setPendingOverviewConfirm((pending) => {
      if (!pending) {
        return null;
      }
      const saved = handleDailySubmit({ goToHome: false });
      if (!saved) {
        return null;
      }
      applyPendingOverviewNavigation(pending);
      setActiveView("home");
      return null;
    });
  };

  const pendingCategoryTitle = useMemo(() => {
    if (!pendingCategoryConfirm) {
      return null;
    }
    const match = dailyCategoryButtons.find((category) => category.id === pendingCategoryConfirm);
    return match?.title ?? null;
  }, [dailyCategoryButtons, pendingCategoryConfirm]);

  const handleCategoryConfirmCancel = useCallback(() => {
    setPendingCategoryConfirm(null);
  }, []);

  const handleCategoryConfirmSave = useCallback(() => {
    if (!pendingCategoryConfirm) {
      return;
    }
    const categoryId = pendingCategoryConfirm;
    const snapshot = extractDailyCategorySnapshot(dailyDraft, categoryId, featureFlags, pbacCounts);
    if (snapshot) {
      const snapshotString = JSON.stringify(snapshot);
      setDailyCategorySnapshots((prev) => ({ ...prev, [categoryId]: snapshotString }));
    }
    setDailyCategoryDirtyState((prev) => {
      if (!prev[categoryId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
    setPendingCategoryConfirm(null);
    setDailyActiveCategory("overview");
  }, [
    dailyDraft,
    featureFlags,
    pbacCounts,
    pendingCategoryConfirm,
  ]);

  const handleCategoryConfirmDiscard = useCallback(() => {
    if (!pendingCategoryConfirm) {
      return;
    }
    const categoryId = pendingCategoryConfirm;
    const snapshotString = dailyCategorySnapshots[categoryId];
    if (snapshotString) {
      const snapshot = JSON.parse(snapshotString) as CategorySnapshot;
      const restored = restoreDailyCategorySnapshot(
        dailyDraft,
        featureFlags,
        pbacCounts,
        categoryId,
        snapshot
      );
      setDailyDraft(restored.entry);
      setFeatureFlags(restored.featureFlags);
      setPbacCounts(restored.pbacCounts);
    }
    setDailyCategoryDirtyState((prev) => {
      if (!prev[categoryId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
    setPendingCategoryConfirm(null);
    setDailyActiveCategory("overview");
  }, [
    dailyCategorySnapshots,
    dailyDraft,
    featureFlags,
    pbacCounts,
    pendingCategoryConfirm,
    setDailyDraft,
    setFeatureFlags,
    setPbacCounts,
  ]);

  const dailyCategorySummaries = useMemo(
    () => {
      const entry = dailyDraft;
      const summaries: Partial<Record<Exclude<DailyCategoryId, "overview">, string[]>> = {};

      // Cervix mucus summary (only when Billings method is enabled)
      if (featureFlags.billingMethod) {
        const mucusLines: string[] = [];
        const mucus = entry.cervixMucus;
        if (mucus?.observation || mucus?.appearance) {
          const observationLabels: Record<string, string> = {
            dry: "Trocken",
            moist: "Feucht",
            wet: "Nass",
            slippery: "Glitschig",
          };
          const appearanceLabels: Record<string, string> = {
            none: "Nichts",
            sticky: "Klebrig",
            creamy: "Cremig",
            eggWhite: "Spinnbar (Eiweiß)",
          };
          if (mucus.observation) {
            mucusLines.push(`Empfindung: ${observationLabels[mucus.observation] ?? mucus.observation}`);
          }
          if (mucus.appearance) {
            mucusLines.push(`Aussehen: ${appearanceLabels[mucus.appearance] ?? mucus.appearance}`);
          }
          const fertilityScore = scoreCervixMucusFertility(mucus);
          if (fertilityScore >= 3) {
            mucusLines.push(fertilityScore === 4 ? "🟢 Peak-Fruchtbarkeit" : "🟡 Hohe Fruchtbarkeit");
          }
        } else {
          mucusLines.push("Noch nicht erfasst.");
        }
        summaries.cervixMucus = mucusLines;
      }

      const painRegions = entry.painRegions ?? [];
      const painLines: string[] = [];

      if (sortedPainShortcutEvents.length) {
        painLines.push("Akut-Einträge:");
        sortedPainShortcutEvents.forEach((event) => {
          painLines.push(describeQuickPainEvent(event));
        });
      }

      if (painRegions.length) {
        const regionLabels = painRegions.map((region) => getRegionLabel(region.regionId));
        painLines.push(`Bereiche: ${formatList(regionLabels, 3)}`);
        const intensities = painRegions
          .map((region) => (typeof region.nrs === "number" ? region.nrs : null))
          .filter((value): value is number => value !== null);
        if (intensities.length) {
          painLines.push(`Max.: ${Math.max(...intensities)}/10`);
        }
        const qualities = Array.from(
          new Set(
            painRegions.flatMap((region) => region.qualities ?? [])
          )
        );
        if (qualities.length) {
          painLines.push(`Qualitäten: ${formatList(qualities, 3)}`);
        }
      }
      const deepDyspareuniaSymptom = entry.symptoms?.deepDyspareunia;
      if (deepDyspareuniaSymptom?.present) {
        const score =
          typeof deepDyspareuniaSymptom.score === "number" ? deepDyspareuniaSymptom.score : 0;
        painLines.push(`${TERMS.deepDyspareunia.label}: ${score}/10`);
      }
      if (entry.ovulationPain?.side) {
        const ovulationParts = [OVULATION_PAIN_SIDE_LABELS[entry.ovulationPain.side]];
        if (typeof entry.ovulationPain.intensity === "number") {
          const rounded = Math.max(0, Math.min(10, Math.round(entry.ovulationPain.intensity)));
          ovulationParts.push(`${rounded}/10`);
        }
        painLines.push(`${TERMS.ovulationPain.label}: ${ovulationParts.join(" · ")}`);
      }
      if (typeof entry.impactNRS === "number" && (painRegions.length || entry.impactNRS > 0)) {
        painLines.push(`Belastung: ${entry.impactNRS}/10`);
      }
      if (!painLines.length) {
        painLines.push(`${pickRandom(PAIN_FREE_MESSAGES)} ${pickRandom(PAIN_FREE_EMOJIS)}`);
      }
      summaries.pain = painLines;

      const symptomEntries = Object.entries(entry.symptoms ?? {}) as Array<[
        SymptomKey,
        { present?: boolean; score?: number }
      ]>;
      const presentSymptoms = symptomEntries.filter(([, value]) => value?.present);
      const symptomLines: string[] = [];
      if (presentSymptoms.length || entry.dizzinessOpt?.present) {
        const labels = presentSymptoms.map(([key, value]) => {
          const descriptor = SYMPTOM_TERMS[key];
          const label = descriptor?.label ?? key;
          return typeof value?.score === "number" ? `${label} (${value.score}/10)` : label;
        });
        if (entry.dizzinessOpt?.present) {
          const dizzinessLabel = MODULE_TERMS.dizzinessOpt.present.label;
          const details: string[] = [];
          if (typeof entry.dizzinessOpt.nrs === "number") {
            details.push(`${formatNumber(entry.dizzinessOpt.nrs, { maximumFractionDigits: 1 })}/10`);
          }
          if (entry.dizzinessOpt.orthostatic) {
            details.push("orthostatisch");
          }
          labels.push(details.length ? `${dizzinessLabel} (${details.join(", ")})` : dizzinessLabel);
        }
        symptomLines.push(`Vorhanden: ${formatList(labels, 3)}`);
      } else {
        symptomLines.push(`${pickRandom(SYMPTOM_FREE_MESSAGES)} ${pickRandom(SYMPTOM_FREE_EMOJIS)}`);
      }
      summaries.symptoms = symptomLines;

      const bleedLines: string[] = [];
      const bleedingActive = hasBleedingForEntry(entry);
      if (bleedingActive) {
        const pbac = entry.bleeding?.pbacScore ?? 0;
        bleedLines.push(`Blutung aktiv – PBAC ${pbac}`);
        const extras: string[] = [];
        if (entry.bleeding.clots) {
          extras.push("Koagel");
        }
        if (entry.bleeding.flooding) {
          extras.push("Flooding");
        }
        if (extras.length) {
          bleedLines.push(`Begleitsymptome: ${extras.join(", ")}`);
        }
      } else {
        bleedLines.push("Keine Blutung heute.");
      }
      summaries.bleeding = bleedLines;

      const medicationLines: string[] = [];
      const rescueMeds = (entry.rescueMeds ?? []).filter((med) => med.name);
      if (rescueMeds.length) {
        rescueMeds.forEach((med) => {
          const parts = [med.name];
          if (typeof med.doseMg === "number") {
            parts.push(`${med.doseMg} mg`);
          }
          if (med.time) {
            parts.push(med.time);
          }
          medicationLines.push(parts.join(" • "));
        });
      } else {
        medicationLines.push("Keine Rescue-Medikation eingetragen.");
      }
      summaries.medication = medicationLines;

      const sleepLines: string[] = [];
      if (entry.sleep?.hours !== undefined) {
        sleepLines.push(`Dauer: ${formatNumber(entry.sleep.hours, { maximumFractionDigits: 1 })} h`);
      }
      if (entry.sleep?.quality !== undefined) {
        sleepLines.push(`Qualität: ${entry.sleep.quality}/10`);
      }
      if (entry.sleep?.awakenings !== undefined) {
        sleepLines.push(`Aufwachphasen: ${entry.sleep.awakenings}`);
      }
      if (!sleepLines.length) {
        sleepLines.push("Keine Schlafdaten erfasst.");
      }
      summaries.sleep = sleepLines;

      const bowelLines: string[] = [];
      const dyschezia = entry.symptoms?.dyschezia;
      if (dyschezia?.present) {
        bowelLines.push(`${TERMS.dyschezia.label}: ${dyschezia.score ?? 0}/10`);
      }
      if (entry.gi?.bristolType) {
        bowelLines.push(`Bristol: Typ ${entry.gi.bristolType}`);
      }
      const dysuria = entry.symptoms?.dysuria;
      if (dysuria?.present) {
        bowelLines.push(`${TERMS.dysuria.label}: ${dysuria.score ?? 0}/10`);
      }
      if (entry.urinary?.freqPerDay !== undefined) {
        bowelLines.push(`Toilettengänge: ${entry.urinary.freqPerDay}/Tag`);
      }
      if (entry.urinary?.urgency !== undefined) {
        bowelLines.push(`${TERMS.urinary_urgency.label}: ${entry.urinary.urgency}/10`);
      }
      const urinaryOpt = entry.urinaryOpt ?? {};
      const urinaryDetails: string[] = [];
      if (urinaryOpt.leaksCount !== undefined) {
        urinaryDetails.push(`${urinaryOpt.leaksCount} Leckagen`);
      }
      if (urinaryOpt.padsCount !== undefined) {
        urinaryDetails.push(`${urinaryOpt.padsCount} Schutzwechsel`);
      }
      if (urinaryOpt.nocturia !== undefined) {
        urinaryDetails.push(`${urinaryOpt.nocturia}× nachts`);
      }
      if (urinaryDetails.length) {
        bowelLines.push(`Dranginkontinenz: ${urinaryDetails.join(", ")}`);
      }
      if (!bowelLines.length) {
        bowelLines.push("Keine Angaben hinterlegt.");
      }
      summaries.bowelBladder = bowelLines;

      const notesLines: string[] = [];
      const tags = entry.notesTags ?? [];
      if (tags.length) {
        notesLines.push(`Tags: ${formatList(tags, 3)}`);
      }
      if (entry.notesFree?.trim()) {
        notesLines.push(`Notiz: ${truncateText(entry.notesFree.trim(), 80)}`);
      }
      if (!notesLines.length) {
        notesLines.push("Keine Notizen hinterlegt.");
      }
      summaries.notes = notesLines;

      const optionalLines: string[] = [];
      if (entry.ovulation?.lhTestDone) {
        optionalLines.push(`LH-Test: ${entry.ovulation.lhPositive ? "positiv" : "negativ"}`);
        if (entry.ovulation.lhTime) {
          const [isoDate, isoTime] = entry.ovulation.lhTime.split("T");
          const parsed = isoDate ? parseIsoDate(isoDate) : null;
          const timeLabel = isoTime ? isoTime.slice(0, 5) : null;
          if (parsed && timeLabel) {
            optionalLines.push(
              `Zeitpunkt: ${parsed.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} ${timeLabel}`
            );
          } else {
            optionalLines.push(`Zeitpunkt: ${entry.ovulation.lhTime}`);
          }
        }
      }
      if (entry.ovulation?.bbtCelsius !== undefined) {
        optionalLines.push(
          `BBT: ${formatNumber(entry.ovulation.bbtCelsius, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} °C`
        );
      }
      if (entry.activity?.steps !== undefined) {
        optionalLines.push(`Schritte: ${formatNumber(entry.activity.steps, { maximumFractionDigits: 0 })}`);
      }
      if (entry.activity?.activeMinutes !== undefined) {
        optionalLines.push(`Aktive Minuten: ${entry.activity.activeMinutes}`);
      }
      if (entry.exploratory?.hrvRmssdMs !== undefined) {
        optionalLines.push(`HRV: ${entry.exploratory.hrvRmssdMs} ms`);
      }
      if (entry.headacheOpt?.present) {
        optionalLines.push(
          `Kopfschmerz: ${formatNumber(entry.headacheOpt.nrs ?? 0, { maximumFractionDigits: 1 })}/10${
            entry.headacheOpt.aura ? ", Aura" : ""
          }`
        );
      }
      if (entry.dizzinessOpt?.present) {
        optionalLines.push(
          `Schwindel: ${formatNumber(entry.dizzinessOpt.nrs ?? 0, { maximumFractionDigits: 1 })}/10${
            entry.dizzinessOpt.orthostatic ? ", orthostatisch" : ""
          }`
        );
      }
      if (!optionalLines.length) {
        optionalLines.push("Keine optionalen Daten hinterlegt.");
      }
      summaries.optional = optionalLines;

      return summaries;
    },
    [dailyDraft, featureFlags.billingMethod, sortedPainShortcutEvents]
  );

  useLayoutEffect(() => {
    if (isHomeView) {
      return;
    }

    const updateHeight = () => {
      const element = detailToolbarRef.current;
      if (!element) {
        setDetailToolbarHeight(DETAIL_TOOLBAR_FALLBACK_HEIGHT);
        return;
      }
      setDetailToolbarHeight(element.getBoundingClientRect().height);
    };

    updateHeight();

    const element = detailToolbarRef.current;
    if (!element) {
      return;
    }

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => updateHeight());
      observer.observe(element);
      return () => {
        observer.disconnect();
      };
    }

    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateHeight);
      return () => {
        window.removeEventListener("resize", updateHeight);
      };
    }

    return;
  }, [
    isHomeView,
    infoMessage,
    toolbarLabel,
    activeScopeProgress.completed,
    activeScopeProgress.total,
  ]);

  const showScopeProgressCounter = activeView !== "analytics" && activeScopeProgress.total > 0;

  const toolbarBadgeItems = useMemo(
    () => {
      const items: Array<{ order: number; element: ReactNode }> = [];

      if (isDailyOverview) {
        items.push({
          order: 10,
          element: (
            <span
              key="cycle-day"
              className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 shadow-inner"
            >
              {cycleDayBadgeLabel}
            </span>
          ),
        });
      }

      if (toolbarLabel && !isDailyOverview) {
        items.push({
          order: 20,
          element: (
            <span
              key="toolbar-label"
              className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700"
            >
              {toolbarLabel}
            </span>
          ),
        });
      }

      if (showScopeProgressCounter) {
        items.push({
          order: 30,
          element: (
            <span
              key="scope-progress"
              className="rounded-full bg-rose-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-800"
            >
              {`${activeScopeProgress.completed}/${activeScopeProgress.total}`}
            </span>
          ),
        });
      }

      return items.sort((a, b) => a.order - b.order).map((item) => item.element);
    },
    [
      activeScopeProgress.completed,
      activeScopeProgress.total,
      cycleDayBadgeLabel,
      isDailyOverview,
      showScopeProgressCounter,
      toolbarLabel,
    ]
  );

  const showFloatingCheckInBadge = activeView === "home" && pendingCheckIns.length > 0 && !showBirthdayGreeting;

  const floatingCheckInBadge = showFloatingCheckInBadge ? (
    <div className="pointer-events-none fixed right-4 top-4 z-[90] flex flex-col items-end gap-2 sm:right-6">
      <button
        type="button"
        onClick={() => setShowCheckInPopup((previous) => !previous)}
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-lg font-bold text-white shadow-xl ring-4 ring-white transition hover:bg-rose-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-300"
        aria-label={`Fällige Check-ins anzeigen (${pendingCheckIns.length})`}
      >
        {pendingCheckIns.length}
      </button>
      {showCheckInPopup ? (
        <div className="pointer-events-auto w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-rose-200 bg-white/95 p-4 text-left shadow-xl backdrop-blur">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex flex-col">
              <p className="text-sm font-semibold text-rose-900">Fällige Check-ins</p>
              <p className="text-xs text-rose-700">Ausstehende Einträge schnell erledigen</p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setShowCheckInPopup(false)}
              aria-label="Check-in Badge schließen"
              className="text-rose-500"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {pendingCheckIns.map((checkIn) => (
              <div
                key={checkIn.key}
                className="flex items-start justify-between gap-3 rounded-xl bg-rose-50/80 p-3"
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-rose-900">{checkIn.label}</p>
                  <p className="text-xs text-rose-700">{checkIn.description}</p>
                </div>
                <div className="flex flex-col items-end gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${checkIn.label} ausfallen lassen`}
                    onClick={() => setPendingDismissCheckIn(checkIn)}
                    className="text-rose-500 hover:text-rose-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" onClick={() => handleFillCheckIn(checkIn.type)}>
                    ausfüllen
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

  // Compute toolbar background color based on active category
  const toolbarBgColor = useMemo(() => {
    if (activeView === "daily" && dailyActiveCategory !== "overview") {
      const categoryColor = CATEGORY_COLORS[dailyActiveCategory];
      return categoryColor?.pastel ?? "var(--endo-bg, #fff)";
    }
    return "var(--endo-bg, #fff)";
  }, [activeView, dailyActiveCategory]);

  const toolbarBorderColor = useMemo(() => {
    if (activeView === "daily" && dailyActiveCategory !== "overview") {
      const categoryColor = CATEGORY_COLORS[dailyActiveCategory];
      return categoryColor?.border ?? undefined;
    }
    return undefined;
  }, [activeView, dailyActiveCategory]);

  const detailToolbar = !isHomeView ? (
    <>
      <header
        ref={detailToolbarRef}
        className="fixed inset-x-0 top-0 z-40 border-b shadow-sm backdrop-blur supports-[backdrop-filter:none]:bg-white"
        style={{ backgroundColor: toolbarBgColor, borderColor: toolbarBorderColor }}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-3">
              <BackButton
                type="button"
                onClick={() => {
                  if (activeView === "daily") {
                    if (dailyActiveCategory !== "overview") {
                      if (
                        isTrackedDailyCategory(dailyActiveCategory) &&
                        dailyCategoryDirtyState[dailyActiveCategory]
                      ) {
                        setPendingCategoryConfirm(dailyActiveCategory);
                        return;
                      }
                      setDailyActiveCategory("overview");
                      return;
                    }
                    if (isDailyDirty) {
                      setPendingOverviewConfirm({ action: "go-home" });
                      return;
                    }
                  }
                  setActiveView("home");
                }}
              >
                Zurück
              </BackButton>
              {isDailyOverview && dailyOverviewDateLabel ? (
                <span className="text-sm font-semibold text-rose-900 sm:text-base">
                  {dailyOverviewDateLabel}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">{toolbarBadgeItems}</div>
          </div>
          {infoMessage ? <p className="text-xs text-rose-600 sm:text-sm">{infoMessage}</p> : null}
          {showPainSummaryInToolbar ? renderPainSummaryToolbar() : null}
          {showPbacSummaryInToolbar ? renderPbacSummaryPanel() : null}
        </div>
      </header>
      <div
        aria-hidden="true"
        className="w-full"
        style={{ height: detailToolbarHeight || DETAIL_TOOLBAR_FALLBACK_HEIGHT }}
      />
    </>
  ) : null;

  return (
    <div className="relative flex min-h-screen flex-col">
      {floatingCheckInBadge}
      {showBirthdayGreeting && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-br from-rose-50 via-white to-rose-100 px-6 py-12 text-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-8">
            <h1 className="text-4xl font-extrabold tracking-tight text-rose-700 sm:text-5xl">
              Alles Liebe zum Geburtstag!
            </h1>
            <div className="heart-3d-container">
              <div className="heart-3d">
                <svg viewBox="0 0 512 512" className="h-full w-full" aria-hidden="true" focusable="false">
                  <defs>
                    <linearGradient id={heartGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f9a8d4" />
                      <stop offset="50%" stopColor="#f472b6" />
                      <stop offset="100%" stopColor="#db2777" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M256 464l-35.35-32.33C118.6 343.5 48 279.4 48 196.6 48 131 99 80 164.5 80c37.5 0 73.5 17.7 96 45.2C283.9 97.7 319.9 80 357.4 80 423 80 474 131 474 196.6c0 82.8-70.6 146.9-172.7 235.1L256 464z"
                    fill={`url(#${heartGradientId})`}
                  />
                </svg>
              </div>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setShowBirthdayGreeting(false)}
            className="mx-auto mt-auto w-full max-w-xs rounded-full bg-rose-600 py-4 text-lg font-semibold shadow-lg transition hover:bg-rose-500"
          >
            weiter zur App
          </Button>
        </div>
      )}
      {showSettings && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSettings(false);
          }}
        >
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              {settingsPage === "main" ? (
                <h2 className="text-xl font-semibold text-rose-900">Einstellungen</h2>
              ) : (
                <button
                  type="button"
                  onClick={() => setSettingsPage("main")}
                  className="flex items-center gap-2 text-rose-600 hover:text-rose-800 transition"
                >
                  <ChevronLeft className="h-5 w-5" />
                  <span className="font-medium">Zurück</span>
                </button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowSettings(false);
                  setSettingsPage("main");
                }}
                className="text-rose-500 hover:text-rose-700"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {settingsPage === "main" && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSettingsPage("ovulation")}
                  className="flex w-full items-center justify-between gap-3 p-4 rounded-xl border border-rose-100 bg-rose-50/50 text-left hover:bg-rose-50 transition"
                >
                  <span className="text-lg font-semibold text-rose-900">Eisprungsbestimmung</span>
                  <ChevronRight className="h-5 w-5 text-rose-400" />
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsPage("bleeding")}
                  className="flex w-full items-center justify-between gap-3 p-4 rounded-xl border border-rose-100 bg-rose-50/50 text-left hover:bg-rose-50 transition"
                >
                  <span className="text-lg font-semibold text-rose-900">Blutungs-Erfassung</span>
                  <ChevronRight className="h-5 w-5 text-rose-400" />
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsPage("colorScheme")}
                  className="flex w-full items-center justify-between gap-3 p-4 rounded-xl border border-rose-100 bg-rose-50/50 text-left hover:bg-rose-50 transition"
                >
                  <span className="text-lg font-semibold text-rose-900">Farbschema</span>
                  <ChevronRight className="h-5 w-5 text-rose-400" />
                </button>
              </div>
            )}

            {settingsPage === "ovulation" && (
              <div>
                <h3 className="text-lg font-semibold text-rose-900 mb-4">Eisprungsbestimmung</h3>
                <div className="flex items-start justify-between gap-4 rounded-xl border border-rose-100 bg-rose-50/50 p-4">
                  <div className="flex-1">
                    <p className="font-medium text-rose-900">Billings-Methode</p>
                    <p className="mt-1 text-sm text-rose-600">Bestimmung anhand des Cervixschleims</p>
                    <p className="mt-2 text-xs text-rose-500">Verbesserte Vorhersagen werden erst nach mindestens 2 Zyklen mit Cervixschleim-Daten angezeigt. Bis dahin wird die Standard-Methode verwendet.</p>
                  </div>
                  <Switch
                    checked={featureFlags.billingMethod ?? false}
                    onCheckedChange={(checked) =>
                      setFeatureFlags((prev) => ({ ...prev, billingMethod: checked }))
                    }
                  />
                </div>
              </div>
            )}

            {settingsPage === "bleeding" && (
              <div>
                <h3 className="text-lg font-semibold text-rose-900 mb-4">Blutungs-Erfassung</h3>
                <ProductSettingsPanel
                  settings={productSettings}
                  onSettingsChange={async (newSettings) => {
                    setProductSettings(newSettings);
                    await saveProductSettings(newSettings);
                  }}
                  todayHasBleedingData={todayHasAnyBleedingData}
                  onResetTodayBleedingData={handleResetTodayBleedingData}
                  onNavigateToProducts={() => setSettingsPage("products")}
                />
              </div>
            )}

            {settingsPage === "colorScheme" && (
              <div>
                <h3 className="text-lg font-semibold text-rose-900 mb-4">Farbschema</h3>
                <p className="text-sm text-rose-600 mb-4">
                  Wähle ein Farbschema für die App.
                </p>
                <div className="space-y-3">
                  {(["neutral", "rose"] as const).map((scheme) => {
                    const swatches = getColorSchemeSwatches(scheme);
                    const isSelected = colorScheme === scheme;
                    return (
                      <button
                        key={scheme}
                        type="button"
                        onClick={() => setColorScheme(scheme)}
                        className={cn(
                          "flex w-full items-start justify-between gap-4 rounded-xl border p-4 text-left transition",
                          isSelected
                            ? "border-rose-300 bg-rose-50/50"
                            : "border-rose-100 hover:bg-rose-50/30"
                        )}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="flex gap-1">
                              {swatches.map((color, i) => (
                                <div
                                  key={i}
                                  className="h-4 w-4 rounded-full border border-black/10"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                            <p className="font-medium text-rose-900">
                              {getColorSchemeName(scheme)}
                            </p>
                          </div>
                          <p className="mt-1 text-sm text-rose-600">
                            {getColorSchemeDescription(scheme)}
                          </p>
                        </div>
                        <div className="mt-0.5">
                          <div
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-full border-2",
                              isSelected
                                ? "border-rose-500 bg-rose-500"
                                : "border-rose-300"
                            )}
                          >
                            {isSelected && (
                              <div className="h-2 w-2 rounded-full bg-white" />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {settingsPage === "products" && (
              <div>
                <h3 className="text-lg font-semibold text-rose-900 mb-4">Meine Produkte</h3>
                <ProductConfigPanel
                  settings={productSettings}
                  onSettingsChange={async (newSettings) => {
                    setProductSettings(newSettings);
                    await saveProductSettings(newSettings);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
      <SectionCompletionContext.Provider value={sectionCompletionContextValue}>
        {detailToolbar}
        <main
          className={cn(
            "mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 pb-8",
            isHomeView ? "pt-8" : "pt-6"
          )}
        >
          {isHomeView ? (
            <div className="flex flex-col gap-6">
              <header className="space-y-1">
                <h1 className="text-4xl font-black tracking-tight text-rose-900">Cycle.</h1>
                <p className="text-sm text-rose-600">Dein Zyklus- und Symptomtracker</p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-rose-700">
                  <Badge
                    className="bg-rose-200 text-rose-700"
                    title={todayLabel ?? undefined}
                    aria-label={
                      todayCycleDay !== null
                        ? `Zyklustag ${todayCycleDay}${todayLabel ? ` – ${todayLabel}` : ""}`
                        : todayLabel ?? undefined
                    }
                  >
                    {todayCycleDay !== null ? `Zyklustag ${todayCycleDay}` : "Zyklustag –"}
                  </Badge>
                  {todayCycleComparisonBadge ? (
                    <Badge className={todayCycleComparisonBadge.className}>
                      {todayCycleComparisonBadge.label}
                    </Badge>
                  ) : null}
                  {expectedPeriodBadgeLabel ? (
                    <Badge className="bg-amber-100 text-rose-800">{expectedPeriodBadgeLabel}</Badge>
                  ) : null}
                  {ovulationBadgeLabel ? (
                    <Badge
                      className="bg-yellow-100 text-yellow-800"
                      title={`Basierend auf ${cycleAnalysis?.cycleCount ?? 0} ${cycleAnalysis?.cycleCount === 1 ? "Zyklus" : "Zyklen"}. Eisprung = Zykluslänge − 14 Tage.`}
                    >
                      {ovulationBadgeLabel}
                    </Badge>
                  ) : null}
                </div>
                {infoMessage && <p className="text-sm font-medium text-rose-600">{infoMessage}</p>}
                {billingsProgress && !billingsProgress.hasEnoughData && (
                  <p className="text-[11px] text-gray-400">
                    Billings: {billingsProgress.completedCyclesWithMucus}/{billingsProgress.cyclesNeeded} Zyklen
                    {billingsProgress.daysWithMucusInCurrentCycle > 0 && (
                      <span> · {billingsProgress.daysWithMucusInCurrentCycle} {billingsProgress.daysWithMucusInCurrentCycle === 1 ? "Tag" : "Tage"} aktuell</span>
                    )}
                  </p>
                )}
              </header>
              {cycleOverview ? <CycleOverviewMiniChart data={cycleOverview} /> : null}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div
                  role="group"
                  aria-label={painShortcutAriaLabel}
                  className="flex flex-1 min-w-[12rem] items-center gap-3 rounded-xl border border-rose-100 bg-white/80 px-3 py-2 text-rose-800 shadow-sm"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handlePainShortcut}
                    aria-label={painShortcutAriaLabel}
                    className="h-9 w-9 rounded-full border-rose-200 bg-white text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <div className="flex flex-1 items-center justify-between gap-2">
                    <div className="flex flex-col leading-tight">
                      <span className="text-[12px] font-semibold leading-tight">Akut-Schmerzen</span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-500">
                        quick tracker
                      </span>
                    </div>
                    <div className="flex h-6 items-end gap-0.5" aria-hidden>
                      {painShortcutTimeline.map((segment, index) => {
                        const height = 4 + (segment.maxIntensity / 10) * 14;
                        const hasMultiple = segment.eventCount > 1;
                        return (
                          <span
                            key={`pain-inline-bar-${index}`}
                            className={cn(
                              "w-1.5 rounded-full bg-rose-100 transition",
                              segment.eventCount > 0 ? "bg-rose-500 shadow-sm shadow-rose-200" : "bg-rose-100"
                            )}
                            style={{
                              height,
                              backgroundImage: hasMultiple
                                ? "repeating-linear-gradient(135deg, #fb7185, #fb7185 6px, #fecdd3 6px, #fecdd3 10px)"
                                : undefined,
                            }}
                            title={
                              segment.eventCount > 0
                                ? `${segment.eventCount} Ereignis${segment.eventCount > 1 ? "se" : ""}`
                                : undefined
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
                {/* Hide Periodenprodukte quick tracker in simple mode */}
                {productSettings.trackingMethod !== "simple" && (
                  <div
                    role="group"
                    aria-label={periodShortcutAriaLabel}
                    className="flex flex-1 min-w-[12rem] items-center gap-3 rounded-xl border border-rose-100 bg-white/80 px-3 py-2 text-rose-800 shadow-sm"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setBleedingQuickAddOpen(true)}
                      aria-label={periodShortcutAriaLabel}
                      className="h-9 w-9 rounded-full border-rose-200 bg-white text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <div className="flex flex-1 items-center justify-between gap-2">
                      <div className="flex flex-col leading-tight">
                        <span className="text-[12px] font-semibold leading-tight">Periodenprodukte</span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-500">
                          quick tracker
                        </span>
                      </div>
                      <div className="flex min-h-[0.75rem] flex-wrap items-center justify-end gap-1" aria-hidden>
                        {bleedingShortcutProducts.dots.length === 0 ? (
                          <span className="h-1 w-6 rounded-full bg-rose-100" />
                        ) : (
                          bleedingShortcutProducts.dots.map((saturation, index) => (
                            <span
                              key={`period-inline-dot-${saturation}-${index}`}
                              className={cn(
                                "h-2 w-2 rounded-full shadow-sm shadow-rose-200/60",
                                PBAC_SATURATION_DOT_CLASSES[saturation]
                              )}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-3 lg:col-span-2">
                  <Button
                    type="button"
                    onClick={() => {
                      manualDailySelectionRef.current = false;
                      if (dailyDraft.date !== today) {
                        selectDailyDate(today);
                      }
                      setDailyActiveCategory("overview");
                      setActiveView("daily");
                    }}
                    className="flex min-h-[180px] w-full flex-col items-start justify-start gap-2 rounded-2xl bg-rose-600 px-6 py-5 text-left text-white shadow-lg transition hover:bg-rose-500"
                  >
                    <span className="text-lg font-semibold">Täglicher Check-in</span>
                    <span className="text-sm text-rose-50/80">In unter einer Minute erledigt</span>
                    {hasDailyEntryForToday && (
                      <span className="flex items-center gap-1 text-sm font-medium text-rose-50">
                        <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                        Heute erledigt
                      </span>
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveView("weekly")}
                  className="h-auto w-full flex-col items-start justify-start gap-2 rounded-2xl border-rose-200 px-5 py-4 text-left text-rose-800 transition hover:border-rose-300 hover:text-rose-900"
                >
                  <span className="text-base font-semibold">Wöchentlich</span>
                  <div className="flex flex-col gap-1">
                    {showWeeklyReminderBadge && (
                      <Badge className="bg-amber-400 text-rose-900" aria-label="Wöchentlicher Check-in fällig">
                        fällig
                      </Badge>
                    )}
                    <span className="text-xs text-rose-500">{weeklyInfoText}</span>
                  </div>
                </Button>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveView("monthly")}
                    className="h-auto w-full flex-col items-start justify-start gap-2 rounded-2xl border-rose-200 px-5 py-4 text-left text-rose-800 transition hover:border-rose-300 hover:text-rose-900"
                  >
                    <span className="text-base font-semibold">Monatlich</span>
                    <div className="flex flex-col gap-1">
                      {showMonthlyReminderBadge && (
                        <Badge className="bg-amber-400 text-rose-900" aria-label="Monatlicher Check-in fällig">
                          fällig
                        </Badge>
                      )}
                      <span className="text-xs text-rose-500">{monthlyInfoText}</span>
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveView("analytics")}
                    className="h-auto w-full items-center justify-start gap-2 rounded-xl border-rose-200 px-4 py-3 text-left text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
                  >
                    <TrendingUp className="h-4 w-4 text-rose-500" />
                    Auswertungen
                  </Button>
                </div>
              </div>
              {storageCompactPossible && !storageDetailsExpanded ? (
                <button
                  type="button"
                  onClick={() => setStorageDetailsExpanded(true)}
                  className="flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-[11px] font-semibold text-emerald-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> lokale Speicherung aktiv
                </button>
              ) : (
                <div className="space-y-3 rounded-lg border border-rose-200 bg-white p-4 shadow-sm">
                  {storageCompactPossible && (
                    <div className="flex items-start justify-between gap-2 rounded-md bg-emerald-50 p-3 text-xs text-emerald-700">
                      <p className="font-medium">Solange die App installiert ist, bleiben die Daten dauerhaft gespeichert.</p>
                      <button
                        type="button"
                        onClick={() => setStorageDetailsExpanded(false)}
                        className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 transition hover:text-emerald-700"
                      >
                        Ausblenden
                      </button>
                    </div>
                  )}
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-rose-700">
                      <span className="flex items-center gap-2 font-medium text-rose-800">
                        <HardDrive className="h-4 w-4 text-rose-500" /> Speicher: {storageDriverText}
                      </span>
                      <span className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold", persistedBadgeClass)}>
                        <ShieldCheck className="h-3.5 w-3.5" /> {persistedLabel}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" className="text-rose-700" onClick={handleBackupExport}>
                        <Download className="mr-2 h-4 w-4" /> Daten exportieren
                      </Button>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50">
                        <Upload className="h-4 w-4" /> Daten importieren
                        <input type="file" accept="application/json" className="hidden" onChange={handleBackupImport} />
                      </label>
                    </div>
                  </div>
                  {storageStatusMessages.length > 0 && (
                    <div className="space-y-1 text-xs text-amber-700">
                      {storageStatusMessages.map((message) => (
                        <div key={message} className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                          <span>{message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {installHintVisible && (
                    <div className="flex flex-col gap-2 rounded-md bg-rose-50 p-3 text-xs text-rose-700 sm:flex-row sm:items-center sm:justify-between">
                      <span className="flex items-center gap-2 font-medium text-rose-700">
                        <Smartphone className="h-4 w-4 text-rose-500" /> Zum Home-Bildschirm hinzufügen für Offline-Nutzung.
                      </span>
                      {installPrompt ? (
                        <Button type="button" size="sm" onClick={handleInstallClick} className="self-start sm:self-auto">
                          <Home className="mr-2 h-4 w-4" /> Installieren
                        </Button>
                      ) : (
                        <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-medium text-rose-600">
                          Im Browser-Menü „Zum Home-Bildschirm“ wählen.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowSettings(true)}
                className="mx-auto flex items-center gap-2 text-sm text-rose-600 hover:text-rose-700"
              >
                <Settings className="h-4 w-4" />
                Einstellungen
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <Tabs defaultValue="daily" value={currentDataView} className="w-full">
                <TabsContent value="daily" className="space-y-6">
                  <SectionScopeContext.Provider value={resolvedDailyScopeKey}>
          <Section
            title="Tagescheck-in"
            variant="plain"
            completionEnabled={false}
            hideHeader
          >
            <div className="space-y-6">
              <div className={cn("space-y-6", dailyActiveCategory === "overview" ? "" : "hidden")}>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold text-rose-900 sm:text-2xl">
                    Täglicher Check-in
                  </h2>
                  {dailyOverviewDateLabel ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-rose-600 sm:text-base">
                      <span>{dailyOverviewDateLabel}</span>
                      {isSelectedDateToday ? (
                        <Badge className="bg-emerald-100 text-emerald-700">Heute</Badge>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-white p-5 shadow-sm">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-3 lg:flex-1">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                          <CalendarDays className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-wide text-rose-400">Ausgewählter Tag</p>
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={goToPreviousDay}
                              aria-label="Vorheriger Tag"
                              className="flex-shrink-0 text-rose-500 hover:text-rose-700"
                            >
                              <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <div
                              onClick={openDailyDatePicker}
                              className="relative flex flex-1 cursor-pointer overflow-hidden rounded-xl border border-rose-100 bg-white text-left text-sm font-medium text-rose-700 shadow-inner transition hover:border-rose-200 focus-within:border-rose-200 focus-within:ring-2 focus-within:ring-rose-300"
                            >
                              <div className="pointer-events-none flex w-full items-start gap-3 px-3 py-2">
                                <Calendar className="h-4 w-4 flex-shrink-0 text-rose-400" aria-hidden="true" />
                                <div className="flex min-w-0 flex-col text-left">
                                  <span className="text-sm font-semibold text-rose-900 sm:text-base">
                                    {selectedDateLabel ?? "Bitte Datum wählen"}
                                  </span>
                                  {isSelectedDateToday ? (
                                    <Badge className="mt-1 w-fit bg-emerald-100 text-emerald-700">Heute</Badge>
                                  ) : null}
                                </div>
                              </div>
                              <Input
                                ref={dailyDateInputRef}
                                type="date"
                                value={dailyDraft.date}
                                onChange={(event) => attemptSelectDailyDate(event.target.value, { manual: true })}
                                className="absolute inset-0 block h-full w-full cursor-pointer rounded-xl border-0 bg-transparent p-0 opacity-0 focus-visible:outline-none"
                                max={today}
                                aria-label="Datum auswählen"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={goToNextDay}
                              aria-label="Nächster Tag"
                              className="flex-shrink-0 text-rose-500 hover:text-rose-700"
                              disabled={!canGoToNextDay}
                            >
                              <ChevronRight className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {hasEntryForSelectedDate && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" aria-hidden="true" />
                        <div>
                          <p className="font-semibold">Für dieses Datum wurden bereits Angaben gespeichert.</p>
                          <p className="text-xs text-amber-600">Beim Speichern werden die bestehenden Daten aktualisiert.</p>
                        </div>
                      </div>
                    )}
                    {renderIssuesForPath("date")}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-rose-200 to-transparent" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-rose-600">Kategorien</h3>
                    <div className="h-px flex-1 bg-gradient-to-l from-rose-200 to-transparent" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {dailyCategoryButtons.map((category) => {
                      const isCompleted = dailyCategoryCompletion[category.id] ?? false;
                      const summaryLines = dailyCategorySummaries[category.id] ?? [];
                      const Icon = category.icon;
                      const isTrackableCategory = isTrackedDailyCategory(category.id);
                      const quickActionDisabled =
                        isCompleted &&
                        isTrackableCategory &&
                        (categoryZeroStates[category.id as TrackableDailyCategoryId] ?? false);
                      const categoryColor = CATEGORY_COLORS[category.id];
                      return (
                        <div
                          key={category.id}
                          className={cn(
                            "group rounded-2xl border p-4 shadow-sm transition hover:shadow-md",
                            isCompleted
                              ? "border-amber-200 bg-amber-50 hover:border-amber-300"
                              : "hover:shadow-lg"
                          )}
                          style={
                            isCompleted
                              ? undefined
                              : {
                                  backgroundColor: categoryColor.pastel,
                                  borderColor: categoryColor.border,
                                }
                          }
                        >
                          <button
                            type="button"
                            onClick={() => setDailyActiveCategory(category.id)}
                            className="flex w-full items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
                          >
                            {Icon ? (
                              <span
                                className={cn(
                                  "flex h-12 w-12 flex-none items-center justify-center rounded-full border transition",
                                  isCompleted && "border-amber-200 bg-amber-100 text-amber-600"
                                )}
                                style={
                                  isCompleted
                                    ? undefined
                                    : {
                                        backgroundColor: "rgba(255, 255, 255, 0.7)",
                                        borderColor: categoryColor.border,
                                        color: categoryColor.saturated,
                                      }
                                }
                                aria-hidden="true"
                              >
                                <Icon className="h-full w-full" />
                              </span>
                            ) : null}
                            <div className="flex flex-1 items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-rose-900">{category.title}</p>
                                <p className="mt-1 text-xs text-rose-600">{category.description}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <ChevronRight className="h-4 w-4 text-rose-400 transition group-hover:text-rose-500" aria-hidden="true" />
                              </div>
                            </div>
                          </button>
                          {category.quickActions?.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {category.quickActions.map((action) => (
                                <Button
                                  key={action.label}
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="rounded-full border border-rose-100 bg-rose-50/80 text-xs font-medium text-rose-700 shadow-none transition hover:border-rose-200 hover:bg-rose-100"
                                  disabled={quickActionDisabled}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (quickActionDisabled) {
                                      return;
                                    }
                                    action.onClick();
                                  }}
                                >
                                  {action.label}
                                </Button>
                              ))}
                            </div>
                          ) : null}
                          {isCompleted ? (
                            category.id === "pain" ? (
                              <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                    <Flame className="h-3.5 w-3.5" aria-hidden />
                                    <span>Akut-Schmerzen</span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {hasAcutePainEvents ? (
                                      sortedPainShortcutEvents.map((event) => {
                                        const timeLabel =
                                          formatPainTimeOfDayList(event.timeOfDay) ??
                                          formatShortTimeLabel(event.timestamp) ??
                                          (event.granularity === "tag" ? "Ganzer Tag" : null);
                                        const qualityLabel = event.qualities?.length
                                          ? formatList(event.qualities, 2)
                                          : event.quality;
                                        return (
                                          <span
                                            key={event.id}
                                            className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[11px] font-medium text-amber-900"
                                          >
                                            {timeLabel ? (
                                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                                {timeLabel}
                                              </span>
                                            ) : null}
                                            <span className="text-amber-800">{getRegionLabel(event.regionId)}</span>
                                            <span className="text-amber-600">{event.intensity}/10</span>
                                            {qualityLabel ? <span className="text-amber-600">{qualityLabel}</span> : null}
                                          </span>
                                        );
                                      })
                                    ) : (
                                      <span className="text-amber-700">Keine Akut-Schmerzen erfasst.</span>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-2 border-t border-amber-200 pt-2">
                                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                    <Activity className="h-3.5 w-3.5" aria-hidden />
                                    <span>Dokumentierte Schmerzen</span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {painSummaryRegions.length ? (
                                      painSummaryRegions.map((region) => {
                                        const details: string[] = [];
                                        if (typeof region.intensity === "number") {
                                          details.push(`${region.intensity}/10`);
                                        }
                                        if (region.qualities.length) {
                                          details.push(formatList(region.qualities, 2));
                                        }
                                        return (
                                          <span
                                            key={region.id}
                                            className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[11px] font-medium text-amber-900"
                                          >
                                            <span className="font-semibold text-amber-950">{region.label}</span>
                                            {details.length ? <span className="text-amber-700">· {details.join(" · ")}</span> : null}
                                          </span>
                                        );
                                      })
                                    ) : (
                                      <span className="text-amber-700">Noch keine Bereiche dokumentiert.</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : summaryLines.length ? (
                              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                                <ul className="space-y-1 text-amber-800">
                                  {summaryLines.map((line, index) => (
                                    <li key={index}>{line}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="text-xs text-rose-600">
                  Es werden nur Daten von den gelb markierten Bereichen gespeichert.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={() => handleDailySubmit()} disabled={!isDailyDirty}>
                    Tagesdaten speichern
                  </Button>
                  {(draftStatus || dailySaveNotice) && (
                    <div className="flex items-center gap-2">
                      {draftStatus && (
                        <span
                          className={cn(
                            "text-sm",
                            draftStatus === "Wiederhergestellt" ? "text-sky-600" : "text-emerald-600"
                          )}
                        >
                          {draftStatus}
                        </span>
                      )}
                      {dailySaveNotice && (
                        <span className="text-sm text-amber-600">{dailySaveNotice}</span>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {[3, 6, 12].map((months) => (
                      <Button key={months} type="button" variant="outline" onClick={() => handleReportDownload(months)}>
                        {months} Monate PDF
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className={cn("space-y-6", dailyActiveCategory === "cervixMucus" ? "" : "hidden")}>
                <Section
                  title="Cervixschleim"
                  description="Beobachtung nach der Billings-Methode"
                  sectionType="fertility"
                >
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-rose-800">Empfindung</p>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { value: "dry", label: "Trocken" },
                          { value: "moist", label: "Feucht" },
                          { value: "wet", label: "Nass" },
                          { value: "slippery", label: "Glitschig" },
                        ] as const).map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            variant={dailyDraft.cervixMucus?.observation === option.value ? "default" : "outline"}
                            className={cn(
                              "rounded-full",
                              dailyDraft.cervixMucus?.observation === option.value
                                ? "bg-rose-600 text-white hover:bg-rose-700"
                                : "border-rose-200 text-rose-700 hover:bg-rose-50"
                            )}
                            onClick={() =>
                              setDailyDraft((prev) => ({
                                ...prev,
                                cervixMucus: {
                                  ...(prev.cervixMucus ?? {}),
                                  observation: prev.cervixMucus?.observation === option.value ? undefined : option.value,
                                },
                              }))
                            }
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-rose-800">Aussehen</p>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { value: "none", label: "Nichts" },
                          { value: "sticky", label: "Klebrig" },
                          { value: "creamy", label: "Cremig" },
                          { value: "eggWhite", label: "Spinnbar (Eiweiß)" },
                        ] as const).map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            variant={dailyDraft.cervixMucus?.appearance === option.value ? "default" : "outline"}
                            className={cn(
                              "rounded-full",
                              dailyDraft.cervixMucus?.appearance === option.value
                                ? "bg-rose-600 text-white hover:bg-rose-700"
                                : "border-rose-200 text-rose-700 hover:bg-rose-50"
                            )}
                            onClick={() =>
                              setDailyDraft((prev) => ({
                                ...prev,
                                cervixMucus: {
                                  ...(prev.cervixMucus ?? {}),
                                  appearance: prev.cervixMucus?.appearance === option.value ? undefined : option.value,
                                },
                              }))
                            }
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </Section>
              </div>
              <div className={cn("space-y-6", dailyActiveCategory === "pain" ? "" : "hidden")}>
                <Section
                  title="Schmerzen"
                  description="Schmerzen hinzufügen, Intensität und Art je Region festhalten und Auswirkungen dokumentieren"
                  sectionType="pain"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-100 bg-white/80 p-3 text-sm text-rose-800">
                    <p className="text-sm text-rose-700">
                      Füge neue Schmerz-Einträge mit drei schnellen Schritten hinzu.
                    </p>
                    <Button type="button" variant="outline" onClick={handlePainModuleQuickAdd}>
                      Schmerz hinzufügen
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <details
                      className="group overflow-hidden rounded-xl border border-rose-200 bg-white shadow-sm transition-shadow hover:shadow-md [&[open]]:shadow-md"
                      open={deepDyspareuniaCardOpen}
                      onToggle={(event) => setDeepDyspareuniaCardOpen(event.currentTarget.open)}
                    >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-gradient-to-r from-rose-50 to-rose-100/50 px-4 py-3 text-sm font-semibold text-rose-900 transition-colors hover:from-rose-100/80 hover:to-rose-100/60 [&::-webkit-details-marker]:hidden">
                          <div className="flex items-center gap-2">
                            <ChevronRight className="h-4 w-4 text-rose-400 transition-transform group-open:rotate-90" />
                            <span>{TERMS.deepDyspareunia.label}</span>
                          </div>
                          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-rose-600 shadow-sm">{deepDyspareuniaSummary}</span>
                        </summary>
                        <div className="space-y-4 border-t border-rose-100 bg-white px-4 py-4 text-rose-700">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <TermHeadline termKey="deepDyspareunia" />
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-rose-600">vorhanden</Label>
                              <Switch
                                checked={deepDyspareuniaSymptom.present}
                                onCheckedChange={(checked) =>
                                  setDailyDraft((prev) => ({
                                    ...prev,
                                    symptoms: {
                                      ...prev.symptoms,
                                      deepDyspareunia: checked
                                        ? {
                                            present: true,
                                            score: prev.symptoms.deepDyspareunia?.score ?? 0,
                                          }
                                        : { present: false },
                                    },
                                  }))
                                }
                              />
                            </div>
                          </div>
                          {renderIssuesForPath("symptoms.deepDyspareunia.present")}
                          {deepDyspareuniaSymptom.present ? (
                            <div className="space-y-2">
                              <ScoreInput
                                id="pain-deep-dyspareunia"
                                label={`${TERMS.deepDyspareunia.label} – Stärke (0–10)`}
                                value={deepDyspareuniaSymptom.score ?? 0}
                                onChange={(value) =>
                                  setDailyDraft((prev) => ({
                                    ...prev,
                                    symptoms: {
                                      ...prev.symptoms,
                                      deepDyspareunia: {
                                        present: true,
                                        score: Math.max(0, Math.min(10, Math.round(value))),
                                      },
                                    },
                                  }))
                                }
                              />
                              {renderIssuesForPath("symptoms.deepDyspareunia.score")}
                            </div>
                          ) : null}
                        </div>
                      </details>

                      <details
                        className="group overflow-hidden rounded-xl border border-rose-200 bg-white shadow-sm transition-shadow hover:shadow-md [&[open]]:shadow-md"
                        open={ovulationPainCardOpen}
                        onToggle={(event) => setOvulationPainCardOpen(event.currentTarget.open)}
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-gradient-to-r from-rose-50 to-rose-100/50 px-4 py-3 text-sm font-semibold text-rose-900 transition-colors hover:from-rose-100/80 hover:to-rose-100/60 [&::-webkit-details-marker]:hidden">
                          <div className="flex items-center gap-2">
                            <ChevronRight className="h-4 w-4 text-rose-400 transition-transform group-open:rotate-90" />
                            <span>{TERMS.ovulationPain.label}</span>
                          </div>
                          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-rose-600 shadow-sm">{ovulationPainSummary}</span>
                        </summary>
                        <div className="space-y-4 border-t border-rose-100 bg-white px-4 py-4 text-rose-700">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <TermHeadline termKey="ovulationPain" />
                            {dailyDraft.ovulationPain ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="rounded-full border border-rose-100 bg-rose-50/80 text-xs font-medium text-rose-700 hover:border-rose-200 hover:bg-rose-100"
                                onClick={() =>
                                  setDailyDraft((prev) => {
                                    const next = { ...prev } as { ovulationPain?: DailyEntry["ovulationPain"] };
                                    delete next.ovulationPain;
                                    return next as DailyEntry;
                                  })
                                }
                              >
                                Zurücksetzen
                              </Button>
                            ) : null}
                          </div>
                          <div className="space-y-3">
                            <Label className="text-xs text-rose-600">Seite</Label>
                            <Select
                              value={ovulationPainDraft.side ?? ""}
                              onValueChange={(value) => {
                                if (value === "__clear") {
                                  setDailyDraft((prev) => {
                                    const next = { ...prev } as { ovulationPain?: DailyEntry["ovulationPain"] };
                                    delete next.ovulationPain;
                                    return next as DailyEntry;
                                  });
                                  return;
                                }
                                setDailyDraft((prev) => {
                                  const previousIntensity = prev.ovulationPain?.intensity;
                                  const next: NonNullable<DailyEntry["ovulationPain"]> = {
                                    side: value as NonNullable<DailyEntry["ovulationPain"]>["side"],
                                  };
                                  if (typeof previousIntensity === "number") {
                                    next.intensity = Math.max(0, Math.min(10, Math.round(previousIntensity)));
                                  }
                                  return {
                                    ...prev,
                                    ovulationPain: next,
                                  };
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Auswählen" />
                              </SelectTrigger>
                              <SelectContent>
                                {OVULATION_PAIN_SIDES.map((side) => (
                                  <SelectItem key={side} value={side}>
                                    {OVULATION_PAIN_SIDE_LABELS[side]}
                                  </SelectItem>
                                ))}
                                <SelectItem value="__clear">Keine Angabe</SelectItem>
                              </SelectContent>
                            </Select>
                            {renderIssuesForPath("ovulationPain.side")}
                          </div>
                          <div className="space-y-2">
                            <ScoreInput
                              id="ovulation-pain-intensity"
                              label="Intensität (0–10)"
                              value={ovulationPainDraft.intensity ?? 0}
                              onChange={(value) =>
                                setDailyDraft((prev) => {
                                  const side = prev.ovulationPain?.side;
                                  if (!side) {
                                    return prev;
                                  }
                                  return {
                                    ...prev,
                                    ovulationPain: {
                                      side,
                                      intensity: Math.max(0, Math.min(10, Math.round(value))),
                                    },
                                  };
                                })
                              }
                              disabled={!ovulationPainDraft.side}
                            />
                            {renderIssuesForPath("ovulationPain.intensity")}
                          </div>
                        </div>
                      </details>

                      <TermField termKey="nrs">
                        <div className="space-y-3 rounded-lg border border-rose-100 bg-white p-4">
                          <p className="font-medium text-rose-800">
                            Wie stark haben dich deine Schmerzen heute insgesamt eingeschränkt oder belastet?
                          </p>
                          <NrsInput
                            id="impact-nrs"
                            value={dailyDraft.impactNRS ?? 0}
                            onChange={(value) => {
                              setDailyDraft((prev) => ({
                                ...prev,
                                impactNRS: Math.max(0, Math.min(10, Math.round(value))),
                              }));
                            }}
                            minLabel="0 überhaupt nicht"
                            maxLabel="10 extrem stark"
                          />
                        </div>
                      </TermField>
                      {renderIssuesForPath("impactNRS")}
                  </div>
                </Section>
              </div>

              <div className={cn("space-y-6", dailyActiveCategory === "symptoms" ? "" : "hidden")}> 
                <Section
                  title="Typische Endometriose-Symptome"
                  description="Je Symptom: Ja/Nein plus Stärke auf der 0–10 Skala"
                  sectionType="symptoms"
                >
                  <div className="grid gap-4">
                    {SYMPTOM_ITEMS.map((item) => {
                      const symptom = dailyDraft.symptoms[item.key] ?? { present: false };
                      const term: TermDescriptor = TERMS[item.termKey];
                      return (
                        <div key={item.key} className="rounded-lg border border-rose-100 bg-rose-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-rose-800">{term.label}</p>
                              <InfoTip tech={term.tech ?? term.label} help={term.help} />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-rose-600">vorhanden</Label>
                              <Switch
                                checked={symptom.present}
                                onCheckedChange={(checked) =>
                                  setDailyDraft((prev) => ({
                                    ...prev,
                                    symptoms: {
                                      ...prev.symptoms,
                                      [item.key]: checked ? { present: true, score: symptom.score ?? 0 } : { present: false },
                                    },
                                  }))
                                }
                              />
                            </div>
                          </div>
                          {symptom.present && (
                            <div className="mt-3">
                              <ScoreInput
                                id={`symptom-${item.key}`}
                                label={`${term.label} – Stärke (0–10)`}
                                value={symptom.score ?? 0}
                                onChange={(value) =>
                                  setDailyDraft((prev) => ({
                                    ...prev,
                                    symptoms: {
                                      ...prev.symptoms,
                                      [item.key]: {
                                        present: true,
                                        score: Math.max(0, Math.min(10, Math.round(value))),
                                      },
                                    },
                                  }))
                                }
                              />
                              {renderIssuesForPath(`symptoms.${item.key}.score`)}
                            </div>
                          )}
                          {renderIssuesForPath(`symptoms.${item.key}.present`)}
                        </div>
                      );
                    })}
                    {SYMPTOM_MODULE_TOGGLES.map((toggle) => {
                      const isActive = Boolean(featureFlags[toggle.key]);
                      return (
                        <div key={toggle.key} className="rounded-lg border border-rose-100 bg-rose-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-rose-800">{toggle.label}</p>
                              <InfoTip tech={toggle.term.tech ?? toggle.label} help={toggle.term.help} />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-rose-600">vorhanden</Label>
                              <Switch
                                checked={isActive}
                                onCheckedChange={(checked) => handleFeatureToggle(toggle.key, checked)}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {activeDizziness ? (
                      <div className="rounded-lg border border-rose-100 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-sm text-rose-800">
                            <Checkbox
                              checked={dailyDraft.dizzinessOpt?.present ?? false}
                              onChange={(event) =>
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  dizzinessOpt: {
                                    ...(prev.dizzinessOpt ?? {}),
                                    present: event.target.checked,
                                  },
                                }))
                              }
                            />
                            <span>{MODULE_TERMS.dizzinessOpt.present.label}</span>
                            <InfoTip
                              tech={
                                MODULE_TERMS.dizzinessOpt.present.tech ?? MODULE_TERMS.dizzinessOpt.present.label
                              }
                              help={MODULE_TERMS.dizzinessOpt.present.help}
                            />
                          </label>
                        </div>
                        {renderIssuesForPath("dizzinessOpt.present")}
                        {dailyDraft.dizzinessOpt?.present && (
                          <div className="mt-3 space-y-3">
                            {showDizzinessNotice && (
                              <InlineNotice
                                title="Schwindel an starken Blutungstagen"
                                text="Mehrfacher Schwindel bei starker Blutung – ärztliche Abklärung (Eisenstatus) erwägen."
                              />
                            )}
                            <div className="space-y-1">
                              <Labeled
                                label={MODULE_TERMS.dizzinessOpt.nrs.label}
                                tech={MODULE_TERMS.dizzinessOpt.nrs.tech}
                                help={MODULE_TERMS.dizzinessOpt.nrs.help}
                                htmlFor="dizziness-opt-nrs"
                              >
                                <NrsInput
                                  id="dizziness-opt-nrs"
                                  value={dailyDraft.dizzinessOpt?.nrs ?? 0}
                                  onChange={(value) =>
                                    setDailyDraft((prev) => ({
                                      ...prev,
                                      dizzinessOpt: { ...(prev.dizzinessOpt ?? {}), nrs: value },
                                    }))
                                  }
                                />
                              </Labeled>
                              {renderIssuesForPath("dizzinessOpt.nrs")}
                            </div>
                            <label className="flex items-center gap-2 text-sm text-rose-800">
                              <Checkbox
                                checked={dailyDraft.dizzinessOpt?.orthostatic ?? false}
                                onChange={(event) =>
                                  setDailyDraft((prev) => ({
                                    ...prev,
                                    dizzinessOpt: {
                                      ...(prev.dizzinessOpt ?? {}),
                                      orthostatic: event.target.checked,
                                    },
                                  }))
                                }
                              />
                              <span>{MODULE_TERMS.dizzinessOpt.orthostatic.label}</span>
                              <InfoTip
                                tech={
                                  MODULE_TERMS.dizzinessOpt.orthostatic.tech ??
                                  MODULE_TERMS.dizzinessOpt.orthostatic.label
                                }
                                help={MODULE_TERMS.dizzinessOpt.orthostatic.help}
                              />
                            </label>
                            {renderIssuesForPath("dizzinessOpt.orthostatic")}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </Section>
              </div>

              <div className={cn("space-y-6", dailyActiveCategory === "bleeding" ? "" : "hidden")}>
                <Section
                  title="Periode und Blutung"
                  sectionType="bleeding"
                >
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <TermHeadline termKey="bleeding_active" />
                        {/* Only show product-based description for non-simple modes */}
                        {effectiveBleedingTrackingMethod !== "simple" && (
                          <p className="text-sm text-rose-700">
                            Dokumentiere deine Periode über Periodenprodukte, Koagel und Flooding. Der PBAC-Score wird
                            automatisch berechnet.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Periode heute</span>
                        {bleedingActive ? (
                          <span className="text-sm">eingetragen</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">noch keine Blutung erfasst</span>
                        )}
                      </div>
                      {!showPbacSummaryInToolbar ? renderPbacSummaryPanel() : null}

                      {/* Show badge when viewing data entered with a different mode */}
                      {isViewingDifferentBleedingMode && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                          <p className="font-medium">
                            Erfasst mit:{" "}
                            {effectiveBleedingTrackingMethod === "simple"
                              ? "Vereinfachte Erfassung"
                              : effectiveBleedingTrackingMethod === "pbac_classic"
                                ? "Klassischer PBAC"
                                : "Erweiterter PBAC"}
                          </p>
                          <p className="text-xs text-amber-600 mt-1">
                            Diese Daten wurden mit einer anderen Erfassungsmethode eingetragen.
                          </p>
                        </div>
                      )}

                      {/* Simple Tracking Mode */}
                      {effectiveBleedingTrackingMethod === "simple" ? (
                        <div className="space-y-4">
                          {/* Keine Blutung button */}
                          <button
                            type="button"
                            onClick={() => {
                              setDailyDraft((prev) => ({
                                ...prev,
                                simpleBleedingIntensity: "none",
                                bleeding: {
                                  ...prev.bleeding,
                                  isBleeding: false,
                                  pbacScore: undefined,
                                },
                                extendedPbacData: {
                                  ...(prev.extendedPbacData ?? {}),
                                  trackingMethod: "simple",
                                  extendedEntries: prev.extendedPbacData?.extendedEntries ?? [],
                                  freeBleedingEntries: prev.extendedPbacData?.freeBleedingEntries ?? [],
                                },
                              }));
                            }}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition",
                              dailyDraft.simpleBleedingIntensity === "none"
                                ? "border-emerald-300 bg-emerald-50"
                                : "border-rose-100 bg-white hover:border-rose-200"
                            )}
                          >
                            <div
                              className={cn(
                                "h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                dailyDraft.simpleBleedingIntensity === "none"
                                  ? "border-emerald-500 bg-emerald-500"
                                  : "border-rose-300"
                              )}
                            >
                              {dailyDraft.simpleBleedingIntensity === "none" && (
                                <div className="h-2 w-2 rounded-full bg-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "font-medium",
                                dailyDraft.simpleBleedingIntensity === "none" ? "text-emerald-900" : "text-rose-900"
                              )}>
                                Keine Blutung
                              </p>
                              <p className={cn(
                                "text-sm",
                                dailyDraft.simpleBleedingIntensity === "none" ? "text-emerald-600" : "text-rose-600"
                              )}>
                                Heute keine Periodenblutung
                              </p>
                            </div>
                          </button>

                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Blutungsstärke</p>
                          </div>
                          <div className="space-y-2">
                            {SIMPLE_BLEEDING_INTENSITIES.filter((i) => i.id !== "none").map((intensity) => {
                              const isSelected = dailyDraft.simpleBleedingIntensity === intensity.id;
                              const pbacScore = getSimpleBleedingPbacEquivalent(intensity.id);
                              return (
                                <button
                                  key={intensity.id}
                                  type="button"
                                  onClick={() => {
                                    setDailyDraft((prev) => ({
                                      ...prev,
                                      simpleBleedingIntensity: intensity.id,
                                      bleeding: {
                                        ...prev.bleeding,
                                        isBleeding: true,
                                        pbacScore,
                                      },
                                      // Tag with tracking method for historical reference
                                      extendedPbacData: {
                                        ...(prev.extendedPbacData ?? {}),
                                        trackingMethod: "simple",
                                        extendedEntries: prev.extendedPbacData?.extendedEntries ?? [],
                                        freeBleedingEntries: prev.extendedPbacData?.freeBleedingEntries ?? [],
                                      },
                                    }));
                                  }}
                                  className={cn(
                                    "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition",
                                    isSelected
                                      ? "border-rose-300 bg-rose-50"
                                      : "border-rose-100 bg-white hover:border-rose-200"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                      isSelected ? "border-rose-500 bg-rose-500" : "border-rose-300"
                                    )}
                                  >
                                    {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-rose-900">{intensity.label}</p>
                                    <p className="text-sm text-rose-600">{intensity.description}</p>
                                    <p className="mt-1 text-xs text-rose-500">
                                      Entspricht {intensity.productEquivalent}
                                    </p>
                                    <p className="text-xs text-rose-400">
                                      PBAC-Äquivalent: {intensity.pbacEquivalentMin}–{intensity.pbacEquivalentMax}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : effectiveBleedingTrackingMethod === "pbac_extended" ? (
                        /* Extended PBAC Mode */
                        <ExtendedBleedingEntryForm
                          settings={productSettings}
                          onAddEntry={handleAddExtendedBleedingEntry}
                        />
                      ) : (
                      /* Classic PBAC Mode */
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Auswahl</p>
                          <p className="text-sm text-rose-700">Wähle, was du dokumentieren möchtest.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {PBAC_ENTRY_CATEGORY_OPTIONS.map((option) => {
                          const isActive = activePbacCategory === option.id;
                          const panelId = `pbac-${option.id}-panel`;
                          const categoryProducts =
                            option.id === "pad" || option.id === "tampon"
                              ? PBAC_PRODUCT_GROUPS[option.id]
                              : null;
                          return (
                            <div
                              key={option.id}
                              className={cn(
                                "rounded-2xl border bg-white/70 p-3 text-sm shadow-sm transition",
                                isActive
                                  ? "border-rose-300 text-rose-900 sm:col-span-2"
                                  : "border-transparent text-rose-700 hover:border-rose-200"
                              )}
                            >
                              <button
                                type="button"
                                className="flex w-full items-start gap-3 text-left"
                                onClick={() => setActivePbacCategory(option.id)}
                                aria-pressed={isActive}
                                aria-expanded={isActive}
                                aria-controls={panelId}
                              >
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-xs font-semibold uppercase tracking-wide text-rose-600">
                                  {option.label.slice(0, 2)}
                                </span>
                                <span>
                                  <span className="block font-semibold">{option.label}</span>
                                  <span className="text-xs text-rose-600">{option.description}</span>
                                </span>
                              </button>
                              <div
                                id={panelId}
                                className={cn("mt-3 space-y-3", isActive ? "block" : "hidden")}
                              >
                                {categoryProducts ? (
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    {categoryProducts.map((item) => {
                                      const value = pbacCounts[item.id] ?? 0;
                                      const max = PBAC_MAX_PRODUCT_COUNT;
                                      const warningId = `${item.id}-counter-warning`;
                                      const decrementDisabled = value === 0;
                                      const incrementDisabled = value === max;

                                      return (
                                        <Labeled
                                          key={item.id}
                                          label={item.label}
                                          tech={TERMS.pbac.tech}
                                          help={TERMS.pbac.help}
                                          meta={
                                            <span className="rounded-full bg-rose-100/80 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                              +{item.score} PBAC
                                            </span>
                                          }
                                        >
                                          <div className="rounded-xl border border-rose-100 bg-white/70 p-3 shadow-sm">
                                            <div className="flex items-center justify-between gap-3">
                                              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-500">
                                                <item.Icon className="h-5 w-5" aria-hidden />
                                              </span>
                                              <div className="flex items-center gap-1 text-rose-900">
                                                <button
                                                  type="button"
                                                  className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                  onClick={() => updatePbacCount(item.id, value - 1, max)}
                                                  aria-label={`Ein ${item.label} entfernen`}
                                                  disabled={decrementDisabled}
                                                >
                                                  <Minus className="h-4 w-4" aria-hidden />
                                                </button>
                                                <output className="w-10 text-center text-2xl font-semibold" aria-live="polite">
                                                  {value}
                                                </output>
                                                <button
                                                  type="button"
                                                  className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                  onClick={() => updatePbacCount(item.id, value + 1, max)}
                                                  aria-label={`Ein ${item.label} hinzufügen`}
                                                  disabled={incrementDisabled}
                                                >
                                                  <Plus className="h-4 w-4" aria-hidden />
                                                </button>
                                              </div>
                                            </div>
                                            {value === max ? (
                                              <p id={warningId} className="mt-2 text-xs font-medium text-rose-800">
                                                Bei mehr als zwölf bitte ärztlich abklären.
                                              </p>
                                            ) : null}
                                          </div>
                                        </Labeled>
                                      );
                                    })}
                                  </div>
                                ) : null}
                                {option.id === "clot" ? (
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    {PBAC_CLOT_ITEMS.map((item) => {
                                      const value = pbacCounts[item.id] ?? 0;
                                      const decrementDisabled = value === 0;
                                      const incrementDisabled = value === PBAC_MAX_CLOT_COUNT;
                                      return (
                                        <Labeled
                                          key={item.id}
                                          label={item.label}
                                          tech={TERMS.pbac.tech}
                                          help={TERMS.pbac.help}
                                          meta={
                                            <span className="rounded-full bg-rose-100/80 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                              +{item.score} PBAC
                                            </span>
                                          }
                                        >
                                          <div className="rounded-xl border border-rose-100 bg-white/70 p-3 shadow-sm">
                                            <div className="flex items-center justify-between gap-3">
                                              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-xs font-semibold uppercase tracking-wide text-rose-600">
                                                Ko
                                              </span>
                                              <div className="flex items-center gap-1 text-rose-900">
                                                <button
                                                  type="button"
                                                  className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                  onClick={() => updatePbacCount(item.id, value - 1, PBAC_MAX_CLOT_COUNT)}
                                                  aria-label={`Ein ${item.label} entfernen`}
                                                  disabled={decrementDisabled}
                                                >
                                                  <Minus className="h-4 w-4" aria-hidden />
                                                </button>
                                                <output className="w-10 text-center text-2xl font-semibold" aria-live="polite">
                                                  {value}
                                                </output>
                                                <button
                                                  type="button"
                                                  className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                  onClick={() => updatePbacCount(item.id, value + 1, PBAC_MAX_CLOT_COUNT)}
                                                  aria-label={`Ein ${item.label} hinzufügen`}
                                                  disabled={incrementDisabled}
                                                >
                                                  <Plus className="h-4 w-4" aria-hidden />
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        </Labeled>
                                      );
                                    })}
                                  </div>
                                ) : null}
                                {option.id === "flooding" ? (
                                  <div className="rounded-xl border border-rose-100 bg-white/70 p-4 shadow-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-rose-900">
                                      <div className="flex items-center gap-2">
                                        <span>{TERMS.flooding.label}</span>
                                        {TERMS.flooding.help ? (
                                          <InfoTip
                                            tech={TERMS.flooding.tech ?? TERMS.flooding.label}
                                            help={TERMS.flooding.help}
                                          />
                                        ) : null}
                                      </div>
                                      <div className="flex items-center gap-2 text-xs font-medium text-rose-600">
                                        <Switch
                                          id={pbacFloodingToggleId}
                                          checked={pbacFlooding}
                                          onCheckedChange={(checked) =>
                                            setDailyDraft((prev) => ({
                                              ...prev,
                                              bleeding: { ...prev.bleeding, flooding: checked },
                                            }))
                                          }
                                          aria-describedby={`${pbacFloodingToggleId}-hint`}
                                        />
                                        <span id={`${pbacFloodingToggleId}-hint`} className="text-rose-700">
                                          {pbacFlooding ? `+${PBAC_FLOODING_SCORE} PBAC` : "Kein Flooding"}
                                        </span>
                                      </div>
                                    </div>
                                    <p className="mt-2 text-xs text-rose-700">
                                      Aktiviere Flooding nur bei starker Durchbruchblutung.
                                    </p>
                                    <div className="mt-2 text-xs text-rose-600">{renderIssuesForPath("bleeding.flooding")}</div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                      )}
                    <div className="space-y-1 text-xs text-rose-600">
                      {renderIssuesForPath("bleeding.pbacScore")}
                      {renderIssuesForPath("bleeding.clots")}
                      {renderIssuesForPath("bleeding.flooding")}
                    </div>
                  </div>
                </Section>
              </div>

              <div className={cn("space-y-6", dailyActiveCategory === "medication" ? "" : "hidden")}> 
                <Section
                  title={TERMS.meds.label}
                  description="Akut-/Rescue-Medikation des Tages erfassen"
                  sectionType="medication"
                >
                  <div className="grid gap-4">
                    <TermHeadline termKey="meds" />
                    <div className="space-y-2">
                      {(dailyDraft.rescueMeds ?? []).length ? (
                        (dailyDraft.rescueMeds ?? []).map((med, index) => {
                          const detailParts = [
                            typeof med.doseMg === "number" ? `${med.doseMg} mg` : null,
                            med.time ?? null,
                          ].filter(Boolean);
                          return (
                            <div
                              key={`${med.name}-${index}`}
                              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-rose-100 bg-rose-50 p-3"
                            >
                              <div className="space-y-1 text-sm">
                                <p className="font-semibold text-rose-800">{med.name || "Ohne Namen"}</p>
                                <p className="text-rose-700">{detailParts.length ? detailParts.join(" • ") : "Keine Details hinterlegt"}</p>
                                <div className="space-y-0.5 text-xs text-rose-600">
                                  {renderIssuesForPath(`rescueMeds[${index}].name`)}
                                  {renderIssuesForPath(`rescueMeds[${index}].doseMg`)}
                                  {renderIssuesForPath(`rescueMeds[${index}].time`)}
                                </div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-rose-600"
                                onClick={() => removeRescueMed(index)}
                              >
                                Entfernen
                              </Button>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-rose-600">Noch keine Rescue-Dosen dokumentiert.</p>
                      )}
                    </div>
                    {rescueWizard ? (
                      <div className="space-y-3 rounded-lg border border-rose-100 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-rose-800">Dosis hinzufügen</p>
                          <Button type="button" variant="ghost" size="sm" onClick={resetRescueWizard}>
                            Abbrechen
                          </Button>
                        </div>
                        <div className="grid gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs text-rose-600">Schritt 1: Medikament auswählen</Label>
                            <div className="flex flex-wrap gap-2">
                              {rescueMedOptions.map((name) => (
                                <Button
                                  key={name}
                                  type="button"
                                  variant={rescueWizard.name === name ? "default" : "outline"}
                                  size="sm"
                                  className="rounded-full"
                                  onClick={() => handleRescueNameSelect(name)}
                                >
                                  {name}
                                </Button>
                              ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                placeholder="Anderes Medikament anlegen"
                                value={customRescueName}
                                onChange={(event) => setCustomRescueName(event.target.value)}
                              />
                              <Button type="button" variant="secondary" size="sm" onClick={handleCustomRescueSubmit}>
                                Anlegen
                              </Button>
                            </div>
                          </div>
                          {rescueWizard.step >= 2 ? (
                            <div className="space-y-1">
                              <Label className="text-xs text-rose-600">Schritt 2: Dosis (mg) auswählen</Label>
                              <Input
                                type="number"
                                min={0}
                                value={rescueWizard.doseMg ?? ""}
                                onChange={(event) =>
                                  setRescueWizard((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          doseMg: event.target.value ? Number(event.target.value) : undefined,
                                        }
                                      : prev
                                  )
                                }
                              />
                            </div>
                          ) : null}
                          {rescueWizard.step >= 3 ? (
                            <div className="space-y-1">
                              <Label className="text-xs text-rose-600">Schritt 3: Uhrzeit angeben</Label>
                              <Input
                                type="time"
                                value={rescueWizard.time ?? ""}
                                onChange={(event) =>
                                  setRescueWizard((prev) => (prev ? { ...prev, time: event.target.value } : prev))
                                }
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="flex justify-end gap-2">
                          {rescueWizard.step > 1 ? (
                            <Button type="button" variant="ghost" size="sm" onClick={handleRescueWizardBack}>
                              Zurück
                            </Button>
                          ) : null}
                          {rescueWizard.step < 3 ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleRescueWizardNext}
                              disabled={
                                (rescueWizard.step === 1 && !rescueWizard.name) ||
                                (rescueWizard.step === 2 && rescueWizard.doseMg === undefined)
                              }
                            >
                              Weiter
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleRescueWizardSave}
                              disabled={!rescueWizard.name || rescueWizard.doseMg === undefined || !rescueWizard.time}
                            >
                              Dosis speichern
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <Button type="button" variant="secondary" className="justify-start" onClick={startRescueWizard}>
                        Dosis hinzufügen
                      </Button>
                    )}
                  </div>
                </Section>
              </div>

              <div className={cn("space-y-6", dailyActiveCategory === "sleep" ? "" : "hidden")}> 
                <Section
                  title="Schlaf"
                  description="Kurzabfrage ohne Hilfsmittel"
                  sectionType="sleep"
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <TermField termKey="sleep_hours" htmlFor="sleep-hours">
                      <Input
                        id="sleep-hours"
                        type="number"
                        min={0}
                        max={24}
                        step={0.25}
                        value={dailyDraft.sleep?.hours ?? ""}
                        onChange={(event) =>
                          setDailyDraft((prev) => ({
                            ...prev,
                            sleep: { ...(prev.sleep ?? {}), hours: event.target.value ? Number(event.target.value) : undefined },
                          }))
                        }
                      />
                      {renderIssuesForPath("sleep.hours")}
                    </TermField>
                    <div>
                      <ScoreInput
                        id="sleep-quality"
                        label={TERMS.sleep_quality.label}
                        termKey="sleep_quality"
                        value={dailyDraft.sleep?.quality ?? 0}
                        onChange={(value) =>
                          setDailyDraft((prev) => ({
                            ...prev,
                            sleep: {
                              ...(prev.sleep ?? {}),
                              quality: Math.max(0, Math.min(10, Math.round(value))),
                            },
                          }))
                        }
                      />
                      {renderIssuesForPath("sleep.quality")}
                    </div>
                    <TermField termKey="awakenings" htmlFor="sleep-awakenings">
                      <Input
                        id="sleep-awakenings"
                        type="number"
                        min={0}
                        step={1}
                        value={dailyDraft.sleep?.awakenings ?? ""}
                        onChange={(event) =>
                          setDailyDraft((prev) => ({
                            ...prev,
                            sleep: {
                              ...(prev.sleep ?? {}),
                              awakenings: event.target.value ? Number(event.target.value) : undefined,
                            },
                          }))
                        }
                      />
                      {renderIssuesForPath("sleep.awakenings")}
                    </TermField>
                  </div>
                </Section>
              </div>

              <div className={cn("space-y-6", dailyActiveCategory === "bowelBladder" ? "" : "hidden")}> 
                <Section
                  title="Darm & Blase"
                  description="Situativ erfassbar"
                  sectionType="symptoms"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
                      <p className="font-medium text-rose-800">Darm</p>
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-rose-800">{TERMS.dyschezia.label}</p>
                            <InfoTip tech={TERMS.dyschezia.tech ?? TERMS.dyschezia.label} help={TERMS.dyschezia.help} />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-rose-600">vorhanden</Label>
                            <Switch
                              checked={dyscheziaSymptom?.present ?? false}
                              onCheckedChange={(checked) =>
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  symptoms: {
                                    ...prev.symptoms,
                                    dyschezia: checked
                                      ? {
                                          present: true,
                                          score: prev.symptoms.dyschezia?.score ?? 0,
                                        }
                                      : { present: false },
                                  },
                                }))
                              }
                            />
                          </div>
                        </div>
                        {renderIssuesForPath("symptoms.dyschezia.present")}
                        {dyscheziaSymptom?.present ? (
                          <div className="space-y-2">
                            <ScoreInput
                              id="symptom-dyschezia"
                              label={`${TERMS.dyschezia.label} – Stärke (0–10)`}
                              value={dyscheziaSymptom?.score ?? 0}
                              onChange={(value) =>
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  symptoms: {
                                    ...prev.symptoms,
                                    dyschezia: {
                                      present: true,
                                      score: Math.max(0, Math.min(10, Math.round(value))),
                                    },
                                  },
                                }))
                              }
                            />
                            {renderIssuesForPath("symptoms.dyschezia.score")}
                          </div>
                        ) : null}
                      </div>
                      <TermField termKey="bristol">
                        <Select
                          value={dailyDraft.gi?.bristolType ? String(dailyDraft.gi.bristolType) : ""}
                          onValueChange={(value) =>
                            setDailyDraft((prev) => ({
                              ...prev,
                              gi: {
                                ...(prev.gi ?? {}),
                                bristolType: value ? (Number(value) as 1 | 2 | 3 | 4 | 5 | 6 | 7) : undefined,
                              },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {BRISTOL_TYPES.map((item) => (
                              <SelectItem key={item.value} value={String(item.value)}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {renderIssuesForPath("gi.bristolType")}
                      </TermField>
                    </div>
                    <div className="grid gap-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-rose-800">Blase</p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-rose-800">{TERMS.dysuria.label}</p>
                            <InfoTip tech={TERMS.dysuria.tech ?? TERMS.dysuria.label} help={TERMS.dysuria.help} />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-rose-600">vorhanden</Label>
                            <Switch
                              checked={dysuriaSymptom?.present ?? false}
                              onCheckedChange={(checked) =>
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  symptoms: {
                                    ...prev.symptoms,
                                    dysuria: checked
                                      ? {
                                          present: true,
                                          score: prev.symptoms.dysuria?.score ?? 0,
                                        }
                                      : { present: false },
                                  },
                                }))
                              }
                            />
                          </div>
                        </div>
                        {renderIssuesForPath("symptoms.dysuria.present")}
                        {dysuriaSymptom?.present ? (
                          <div className="space-y-2">
                            <ScoreInput
                              id="symptom-dysuria"
                              label={`${TERMS.dysuria.label} – Stärke (0–10)`}
                              value={dysuriaSymptom?.score ?? 0}
                              onChange={(value) =>
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  symptoms: {
                                    ...prev.symptoms,
                                    dysuria: {
                                      present: true,
                                      score: Math.max(0, Math.min(10, Math.round(value))),
                                    },
                                  },
                                }))
                              }
                            />
                            {renderIssuesForPath("symptoms.dysuria.score")}
                          </div>
                        ) : null}
                      </div>
                      <TermField termKey="urinary_freq" htmlFor="urinary-frequency">
                        <Input
                          id="urinary-frequency"
                          type="number"
                          min={0}
                          step={1}
                          value={dailyDraft.urinary?.freqPerDay ?? ""}
                          onChange={(event) =>
                            setDailyDraft((prev) => ({
                              ...prev,
                              urinary: {
                                ...(prev.urinary ?? {}),
                                freqPerDay: event.target.value ? Number(event.target.value) : undefined,
                              },
                            }))
                          }
                        />
                        {renderIssuesForPath("urinary.freqPerDay")}
                      </TermField>
                      {activeUrinary ? null : (
                        <>
                          <ScoreInput
                            id="urinary-urgency"
                            label={TERMS.urinary_urgency.label}
                            termKey="urinary_urgency"
                            value={dailyDraft.urinary?.urgency ?? 0}
                            onChange={(value) =>
                              setDailyDraft((prev) => ({
                                ...prev,
                                urinary: {
                                  ...(prev.urinary ?? {}),
                                  urgency: Math.max(0, Math.min(10, Math.round(value))),
                                },
                              }))
                            }
                          />
                          {renderIssuesForPath("urinary.urgency")}
                        </>
                      )}
                      <ModuleToggleRow
                        label="Dranginkontinenz"
                        tech={MODULE_TERMS.urinaryOpt.urgency.tech}
                        help={MODULE_TERMS.urinaryOpt.urgency.help}
                        checked={activeUrinary}
                        onCheckedChange={(checked) => handleFeatureToggle("moduleUrinary", checked)}
                        className="bg-white/60"
                      />
                      {activeUrinary ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Labeled
                              label={MODULE_TERMS.urinaryOpt.leaksCount.label}
                              tech={MODULE_TERMS.urinaryOpt.leaksCount.tech}
                              help={MODULE_TERMS.urinaryOpt.leaksCount.help}
                              htmlFor="urinary-opt-leaks"
                            >
                              <NumberField
                                id="urinary-opt-leaks"
                                value={dailyDraft.urinaryOpt?.leaksCount}
                                onChange={(value) =>
                                  setDailyDraft((prev) => ({
                                    ...prev,
                                    urinaryOpt: {
                                      ...(prev.urinaryOpt ?? {}),
                                      leaksCount: value ?? undefined,
                                    },
                                  }))
                                }
                              />
                            </Labeled>
                            {renderIssuesForPath("urinaryOpt.leaksCount")}
                          </div>
                          <div className="space-y-1">
                            <Labeled
                              label={MODULE_TERMS.urinaryOpt.padsCount.label}
                              tech={MODULE_TERMS.urinaryOpt.padsCount.tech}
                              help={MODULE_TERMS.urinaryOpt.padsCount.help}
                              htmlFor="urinary-opt-pads"
                            >
                              <NumberField
                                id="urinary-opt-pads"
                                value={dailyDraft.urinaryOpt?.padsCount}
                                onChange={(value) =>
                                  setDailyDraft((prev) => ({
                                    ...prev,
                                    urinaryOpt: {
                                      ...(prev.urinaryOpt ?? {}),
                                      padsCount: value ?? undefined,
                                    },
                                  }))
                                }
                              />
                            </Labeled>
                            {renderIssuesForPath("urinaryOpt.padsCount")}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {renderIssuesForPath("urinaryOpt.leaksCount")}
                  {renderIssuesForPath("urinaryOpt.padsCount")}
                  <ModuleToggleRow
                    label="Blasensymptome"
                    tech={MODULE_TERMS.urinaryOpt.present.tech}
                    help={MODULE_TERMS.urinaryOpt.present.help}
                    checked={activeUrinary}
                    onCheckedChange={(checked) => handleFeatureToggle("moduleUrinary", checked)}
                    className="hidden"
                  />
                  <ModuleToggleRow
                    label={MODULE_TERMS.urinaryOpt.present.label}
                    tech={MODULE_TERMS.urinaryOpt.present.tech}
                    help={MODULE_TERMS.urinaryOpt.present.help}
                    checked={dailyDraft.urinaryOpt?.present ?? false}
                    onCheckedChange={(checked) =>
                      setDailyDraft((prev) => ({
                        ...prev,
                        urinaryOpt: {
                          ...(prev.urinaryOpt ?? {}),
                          present: checked,
                        },
                      }))
                    }
                    className="hidden"
                  />
                  {renderIssuesForPath("urinaryOpt.present")}
                </Section>
              </div>

              <div className={cn("space-y-6", dailyActiveCategory === "notes" ? "" : "hidden")}>
                <Section
                  title="Notizen & Tags"
                  description="Freitext oder wiederkehrende Muster markieren"
                  sectionType="notes"
                >
                  <div className="grid gap-3">
                    <TermField termKey="notesTags" htmlFor="notes-tag-input">
                      <div className="flex flex-wrap gap-2">
                        <Input
                          id="notes-tag-input"
                          placeholder="Neuer Tag"
                          value={notesTagDraft}
                          onChange={(event) => setNotesTagDraft(event.target.value)}
                        />
                        <Button type="button" variant="secondary" onClick={handleAddTag}>
                          Hinzufügen
                        </Button>
                      </div>
                    </TermField>
                    <div className="flex flex-wrap gap-2">
                      {(dailyDraft.notesTags ?? []).map((tag) => (
                        <Badge key={tag} className="flex items-center gap-2 bg-rose-200 text-rose-700">
                          {tag}
                          <button type="button" onClick={() => handleRemoveTag(tag)} className="text-xs">
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <TermField termKey="notesFree" htmlFor="notes-free">
                      <Textarea
                        id="notes-free"
                        placeholder="Freitextnotizen"
                        value={dailyDraft.notesFree ?? ""}
                        onChange={(event) => setDailyDraft((prev) => ({ ...prev, notesFree: event.target.value }))}
                      />
                    </TermField>
                  </div>
                </Section>
              </div>

              <div className={cn("space-y-6", dailyActiveCategory === "optional" ? "" : "hidden")}> 
                <Section
                  title="Optionale Werte (Hilfsmittel nötig)"
                  description="Standardmäßig ausgeblendet – Wearables, LH-Tests, BBT"
                  sectionType="ovulation"
                  aside={
                    <Switch
                      checked={sensorsVisible}
                      onCheckedChange={setSensorsVisible}
                      aria-label="Hilfsmittel-Optionen"
                    />
                  }
                >
                  <Button type="button" variant="secondary" onClick={() => setSensorsVisible((prev) => !prev)}>
                    {optionalSensorsLabel}
                  </Button>
                  {sensorsVisible && (
                    <div className="grid gap-4">
                      <div className="grid gap-2 rounded-lg border border-rose-100 bg-rose-50 p-4">
                        <p className="font-medium text-rose-800">Ovulation / LH-Tests</p>
                        <div className="flex items-center gap-3">
                          <TermHeadline termKey="opk_done" />
                          <Switch
                            checked={dailyDraft.ovulation?.lhTestDone ?? false}
                            onCheckedChange={(checked) =>
                              setDailyDraft((prev) => ({
                                ...prev,
                                ovulation: { ...(prev.ovulation ?? {}), lhTestDone: checked },
                              }))
                            }
                          />
                        </div>
                        {(dailyDraft.ovulation?.lhTestDone ?? false) && (
                          <div className="grid gap-2 md:grid-cols-3">
                            <div className="flex items-center gap-3">
                              <TermHeadline termKey="opk_positive" />
                              <Switch
                                checked={dailyDraft.ovulation?.lhPositive ?? false}
                                onCheckedChange={(checked) =>
                                  setDailyDraft((prev) => ({
                                    ...prev,
                                    ovulation: { ...(prev.ovulation ?? {}), lhPositive: checked },
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <Label>Testzeit (ISO)</Label>
                              <Input
                                type="datetime-local"
                                value={dailyDraft.ovulation?.lhTime ?? ""}
                                onChange={(event) =>
                                  setDailyDraft((prev) => ({
                                    ...prev,
                                    ovulation: { ...(prev.ovulation ?? {}), lhTime: event.target.value },
                                  }))
                                }
                              />
                              {renderIssuesForPath("ovulation.lhTime")}
                            </div>
                          </div>
                        )}
                        <TermField termKey="bbt">
                          <Input
                            type="number"
                            step="0.01"
                            min={34}
                            max={38}
                            value={dailyDraft.ovulation?.bbtCelsius ?? ""}
                            onChange={(event) =>
                              setDailyDraft((prev) => ({
                                ...prev,
                                ovulation: {
                                  ...(prev.ovulation ?? {}),
                                  bbtCelsius: event.target.value ? Number(event.target.value) : undefined,
                                },
                              }))
                            }
                          />
                          {renderIssuesForPath("ovulation.bbtCelsius")}
                        </TermField>
                      </div>

                      <div className="grid gap-2 rounded-lg border border-rose-100 bg-rose-50 p-4">
                        <p className="font-medium text-rose-800">Aktivität (Wearable/Smartphone)</p>
                        <div className="grid gap-2 md:grid-cols-2">
                          <TermField termKey="steps" htmlFor="activity-steps">
                            <Input
                              id="activity-steps"
                              type="number"
                              min={0}
                              step={1}
                              value={dailyDraft.activity?.steps ?? ""}
                              onChange={(event) =>
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  activity: {
                                    ...(prev.activity ?? {}),
                                    steps: event.target.value ? Number(event.target.value) : undefined,
                                  },
                                }))
                              }
                            />
                            {renderIssuesForPath("activity.steps")}
                          </TermField>
                          <TermField termKey="activeMinutes" htmlFor="activity-minutes">
                            <Input
                              id="activity-minutes"
                              type="number"
                              min={0}
                              step={1}
                              value={dailyDraft.activity?.activeMinutes ?? ""}
                              onChange={(event) =>
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  activity: {
                                    ...(prev.activity ?? {}),
                                    activeMinutes: event.target.value ? Number(event.target.value) : undefined,
                                  },
                                }))
                              }
                            />
                            {renderIssuesForPath("activity.activeMinutes")}
                          </TermField>
                        </div>
                      </div>

                      <div className="grid gap-2 rounded-lg border border-rose-100 bg-rose-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <TermHeadline termKey="hrv" />
                          <Switch checked={exploratoryVisible} onCheckedChange={setExploratoryVisible} />
                        </div>
                        <p className="text-xs text-rose-600">
                          HRV nur explorativ, kein Schmerzsurrogat. Wird nicht in Kerntrends angezeigt.
                        </p>
                        {exploratoryVisible && (
                          <TermField termKey="hrv">
                            <Input
                              type="number"
                              min={0}
                              value={dailyDraft.exploratory?.hrvRmssdMs ?? ""}
                              onChange={(event) =>
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  exploratory: {
                                    ...(prev.exploratory ?? {}),
                                    hrvRmssdMs: event.target.value ? Number(event.target.value) : undefined,
                                  },
                                }))
                              }
                            />
                            {renderIssuesForPath("exploratory.hrvRmssdMs")}
                          </TermField>
                        )}
                      </div>
                    </div>
                  )}
                </Section>
              </div>
            </div>
          </Section>
                  </SectionScopeContext.Provider>
                </TabsContent>
        <TabsContent value="analytics" className="space-y-6">
          <SectionScopeContext.Provider value="analytics">
            <div className="space-y-6">
              <div className="space-y-3 rounded-2xl border border-rose-100 bg-white/70 p-4 shadow-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-rose-900">Bereich auswählen</p>
                    <p className="text-xs text-rose-600">
                      Wechsle zwischen den Auswertungsbereichen, um schneller zu den passenden Charts zu springen.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-500">Auswertungen</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {ANALYTICS_SECTION_OPTIONS.map((section) => {
                    const Icon = section.icon;
                    const active = analyticsActiveSection === section.key;
                    return (
                      <button
                        key={section.key}
                        type="button"
                        onClick={() => setAnalyticsActiveSection(section.key)}
                        className={cn(
                          "flex h-full w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400",
                          active
                            ? "border-rose-300 bg-white shadow-sm"
                            : "border-rose-100 bg-white/70 hover:border-rose-200 hover:bg-white"
                        )}
                        aria-pressed={active}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-10 w-10 items-center justify-center rounded-full",
                            active ? "bg-rose-100 text-rose-600" : "bg-rose-50 text-rose-500"
                          )}
                        >
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold text-rose-900">{section.label}</span>
                          <span className="text-xs text-rose-600">{section.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {analyticsActiveSection === "progress" ? (
                <div className="space-y-6">
              <Section
                title="Dein Fortschritt"
                description="Trends aus deinem täglichen Check-in"
                completionEnabled={false}
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-rose-600">
                    <span>Zeitraum</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {analyticsRangeOptions.map((range) => (
                        <Button
                          key={range}
                          type="button"
                          size="sm"
                          variant={analyticsRangeDays === range ? "secondary" : "ghost"}
                          onClick={() => setAnalyticsRangeDays(range)}
                        >
                          {range} Tage
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {trendMetricOptions.map((metric) => {
                      const active = visibleTrendMetrics.includes(metric.key);
                      return (
                        <Button
                          key={metric.key}
                          type="button"
                          size="sm"
                          variant={active ? "secondary" : "outline"}
                          className="flex items-center gap-2"
                          onClick={() => toggleTrendMetric(metric.key)}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: metric.color }}
                            aria-hidden="true"
                          />
                          {metric.label}
                        </Button>
                      );
                    })}
                  </div>
                  <div className="h-72 w-full">
                    {analyticsTrendData.length ? (
                      <ResponsiveContainer>
                        <ComposedChart data={analyticsTrendData} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#fecdd3" />
                          <XAxis
                            dataKey="date"
                            stroke="#fb7185"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value: string | number) =>
                              typeof value === "string" ? formatShortGermanDate(value) : ""
                            }
                          />
                          <YAxis yAxisId="left" domain={[0, 10]} stroke="#fb7185" tick={{ fontSize: 12 }} />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            domain={[0, analyticsTrendMaxSteps]}
                            stroke="#6366f1"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value: number) => value.toLocaleString("de-DE")}
                            allowDecimals={false}
                            hide={!visibleTrendMetrics.includes("steps")}
                          />
                          <Tooltip content={AnalyticsTrendTooltip} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          {trendMetricOptions.map((metric) => {
                            if (!visibleTrendMetrics.includes(metric.key)) return null;
                            if (metric.type === "area") {
                              return (
                                <Area
                                  key={metric.key}
                                  type="monotone"
                                  dataKey={metric.key}
                                  yAxisId={metric.yAxisId}
                                  name={metric.label}
                                  stroke={metric.color}
                                  fill={metric.color}
                                  fillOpacity={0.18}
                                  strokeWidth={2}
                                  connectNulls
                                  isAnimationActive={false}
                                />
                              );
                            }
                            return (
                              <Line
                                key={metric.key}
                                type="monotone"
                                dataKey={metric.key}
                                yAxisId={metric.yAxisId}
                                name={metric.label}
                                stroke={metric.color}
                                strokeWidth={2}
                                dot={{ r: 2 }}
                                connectNulls
                                isAnimationActive={false}
                              />
                            );
                          })}
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-xl border border-rose-100 bg-rose-50/60 text-sm text-rose-600">
                        Noch keine Daten vorhanden. Starte mit deinem Daily Check-in!
                      </div>
                    )}
                  </div>
                </div>
              </Section>

              <Section
                title="Menstruationsvergleich"
                description="Aktuelle Periode im Vergleich zum letzten Zyklus (PBAC & Intensität)."
                completionEnabled={false}
              >
                {menstruationComparison ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-rose-600">
                      <span>
                        Aktueller Zyklus ab {formatShortGermanDate(menstruationComparison.currentStartDate)}
                      </span>
                      {menstruationComparison.previousStartDate ? (
                        <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
                          <PeriodIcon className="h-3.5 w-3.5" />
                          Vergleich ab {formatShortGermanDate(menstruationComparison.previousStartDate)}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                          <PeriodIcon className="h-3.5 w-3.5" />
                          Noch kein vorheriger Zyklus dokumentiert
                        </span>
                      )}
                    </div>
                    <div className="h-64 w-full overflow-hidden rounded-2xl border border-rose-100 bg-white/80 p-3 shadow-sm">
                      <ResponsiveContainer>
                        <ComposedChart
                          data={menstruationComparison.data}
                          margin={{ top: 16, right: 24, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#fecdd3" />
                          <XAxis
                            dataKey="cycleDay"
                            stroke="#fb7185"
                            tick={{ fontSize: 12 }}
                            label={{ value: "Zyklustag", position: "insideBottom", offset: -6, fill: "#fb7185" }}
                          />
                          <YAxis stroke="#fb7185" tick={{ fontSize: 12 }} allowDecimals={false} />
                          <Tooltip content={MenstruationComparisonTooltip} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Area
                            type="monotone"
                            dataKey="currentPBAC"
                            name="Aktueller Zyklus"
                            stroke="#fb7185"
                            fill="#fb7185"
                            fillOpacity={0.16}
                            strokeWidth={2}
                            connectNulls
                            isAnimationActive={false}
                          />
                          {menstruationComparison.previousStartDate ? (
                            <Area
                              type="monotone"
                              dataKey="previousPBAC"
                              name="Letzter Zyklus"
                              stroke="#6366f1"
                              fill="#6366f1"
                              fillOpacity={0.16}
                              strokeWidth={2}
                              connectNulls
                              isAnimationActive={false}
                            />
                          ) : null}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  <p className="text-xs text-rose-600">
                    PBAC-Werte und dokumentierte Blutungen werden nach Zyklustag gegenübergestellt; fehlende Tage bleiben leer.
                  </p>
                </div>
              ) : (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-sm text-rose-700 shadow-sm">
                    <p className="font-semibold text-rose-900">Noch keine Periode dokumentiert.</p>
                    <p className="mt-1 text-rose-700">
                      Trage den Start deiner Periode ein, damit aktuelle und vergangene Zyklen miteinander verglichen werden können.
                    </p>
                  </div>
                )}
              </Section>

              <Section
                title="Zeit-Korrelation"
                description="Symptome und Schmerzarten im Zyklusverlauf"
                completionEnabled={false}
              >
                {timeCorrelationHeatStrips?.hasData ? (
                  <div className="space-y-4">
                    {/* Toggle controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-rose-600">
                      <span>Ausrichtung</span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={timeCorrelationAlignment === "period" ? "secondary" : "ghost"}
                          onClick={() => setTimeCorrelationAlignment("period")}
                        >
                          Periodenstart
                        </Button>
                        <Button
                          size="sm"
                          variant={timeCorrelationAlignment === "ovulation" ? "secondary" : "ghost"}
                          onClick={() => setTimeCorrelationAlignment("ovulation")}
                        >
                          Eisprung
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-rose-600">
                      <span>Ansicht</span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={timeCorrelationView === "last" ? "secondary" : "ghost"}
                          onClick={() => setTimeCorrelationView("last")}
                        >
                          Letzter Zyklus
                        </Button>
                        <Button
                          size="sm"
                          variant={timeCorrelationView === "overlay" ? "secondary" : "ghost"}
                          onClick={() => setTimeCorrelationView("overlay")}
                        >
                          Alle Zyklen ({timeCorrelationHeatStrips.cycleCount})
                        </Button>
                      </div>
                    </div>
                    {/* Heat strips with integrated cycle data */}
                    <div className="rounded-2xl border border-rose-100 bg-white/80 shadow-sm p-2">
                      {/* Tooltip display */}
                      {correlationTooltip && (
                        <div
                          className="mb-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800"
                          onClick={() => setCorrelationTooltip(null)}
                        >
                          <div className="font-medium">{correlationTooltip.label} · Tag {correlationTooltip.day}</div>
                          <div>{correlationTooltip.value}</div>
                          {correlationTooltip.details && <div className="text-rose-600 mt-0.5">{correlationTooltip.details}</div>}
                        </div>
                      )}
                      {/* Day header */}
                      <div className="flex items-center mb-2 sticky top-0 bg-white/80">
                        <span className="w-14 shrink-0 text-[9px] font-medium text-rose-600">
                          {timeCorrelationAlignment === "period" ? "Tag" : "Ov±"}
                        </span>
                        <div className="flex flex-1 min-w-0">
                          {timeCorrelationHeatStrips.dayRange.map((day) => {
                            const isOvulation = day === timeCorrelationHeatStrips.ovulationDay;
                            const showLabel = timeCorrelationAlignment === "period"
                              ? day === 1 || day % 5 === 0
                              : day === 0 || day % 5 === 0;
                            return (
                              <span
                                key={day}
                                className={cn(
                                  "flex-1 min-w-0 text-center text-[6px]",
                                  isOvulation
                                    ? "font-bold text-amber-600"
                                    : showLabel
                                      ? "text-rose-500"
                                      : "text-rose-300"
                                )}
                              >
                                {isOvulation
                                  ? "•"
                                  : showLabel
                                    ? (timeCorrelationAlignment === "ovulation" && day > 0 ? `+${day}` : day)
                                    : ""}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Blutung section - main chart with distinctive styling */}
                      <div className="text-[9px] text-red-600 font-bold mb-1 mt-2">Blutung</div>
                      <div
                        className={cn(
                          "flex items-center mb-0.5",
                          timeCorrelationView === "overlay" && "cursor-pointer hover:bg-red-50/50 rounded"
                        )}
                        onClick={() => {
                          if (timeCorrelationView === "overlay") {
                            setBleedingCyclesExpanded(!bleedingCyclesExpanded);
                          }
                        }}
                      >
                        <span className="w-14 shrink-0 text-[9px] text-red-700 font-medium truncate flex items-center gap-0.5">
                          {timeCorrelationView === "overlay" && (
                            <ChevronRight
                              className={cn(
                                "h-2.5 w-2.5 transition-transform shrink-0",
                                bleedingCyclesExpanded && "rotate-90"
                              )}
                            />
                          )}
                          <span>{timeCorrelationView === "overlay" ? "Ø" : "Periode"}</span>
                        </span>
                        <div className="flex flex-1 min-w-0">
                          {timeCorrelationHeatStrips.dayRange.map((day) => {
                            const dayData = timeCorrelationHeatStrips.topGraphData.find(
                              (d) => d.alignedDay === day
                            );
                            const value = dayData?.bleedingValue ?? 0;
                            const isOvulation = dayData?.isOvulation ?? false;
                            const isFertile = dayData?.isFertile ?? false;
                            // Color scale for bleeding (PBAC 0-100+)
                            const bgColor =
                              value === 0
                                ? isFertile
                                  ? "#dcfce7" // pale green for fertile window
                                  : "#f5f5f5"
                                : value <= 5
                                  ? "#fee2e2"
                                  : value <= 15
                                    ? "#fecaca"
                                    : value <= 30
                                      ? "#fca5a5"
                                      : value <= 50
                                        ? "#f87171"
                                        : "#ef4444";
                            return (
                              <div
                                key={day}
                                className={cn(
                                  "h-3 flex-1 min-w-0 rounded-[1px] cursor-pointer",
                                  isOvulation && "ring-1 ring-amber-400"
                                )}
                                style={{ backgroundColor: bgColor }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCorrelationTooltip({
                                    day,
                                    label: timeCorrelationView === "overlay" ? "Periode (Ø)" : "Periode",
                                    value: value > 0 ? `PBAC ${value.toFixed(0)}` : "Keine Blutung",
                                    details: isOvulation ? "Eisprung" : isFertile ? "Fruchtbares Fenster" : undefined
                                  });
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                      {/* Expanded individual cycle rows */}
                      {bleedingCyclesExpanded && timeCorrelationView === "overlay" &&
                        timeCorrelationHeatStrips.cycleBleedingRows.map((cycle) => (
                          <div key={cycle.cycleIndex} className="flex items-center mb-0.5 ml-2">
                            <span className="w-12 shrink-0 text-[7px] text-red-400 truncate">
                              {new Date(cycle.startDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                            </span>
                            <div className="flex flex-1 min-w-0">
                              {timeCorrelationHeatStrips.dayRange.map((day) => {
                                const dayData = cycle.values.get(day);
                                const value = dayData?.bleedingValue ?? 0;
                                const isOvulation = dayData?.isOvulation ?? false;
                                const isFertile = dayData?.isFertile ?? false;
                                const bgColor =
                                  value === 0
                                    ? isFertile
                                      ? "#dcfce7"
                                      : "#f5f5f5"
                                    : value <= 5
                                      ? "#fee2e2"
                                      : value <= 15
                                        ? "#fecaca"
                                        : value <= 30
                                          ? "#fca5a5"
                                          : value <= 50
                                            ? "#f87171"
                                            : "#ef4444";
                                return (
                                  <div
                                    key={day}
                                    className={cn(
                                      "h-2 flex-1 min-w-0 rounded-[1px] cursor-pointer",
                                      isOvulation && "ring-1 ring-amber-400"
                                    )}
                                    style={{ backgroundColor: bgColor }}
                                    onClick={() => setCorrelationTooltip({
                                      day,
                                      label: `Zyklus ${new Date(cycle.startDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}`,
                                      value: value > 0 ? `PBAC ${value.toFixed(0)}` : "Keine Blutung",
                                      details: isOvulation ? "Eisprung" : isFertile ? "Fruchtbares Fenster" : undefined
                                    })}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        ))}

                      {/* Symptom rows */}
                      <div className="text-[9px] text-rose-500 font-medium mb-1 mt-3">Symptome</div>
                      {timeCorrelationHeatStrips.symptomRows.map((row) => (
                        <div key={row.key}>
                          {/* Aggregate row */}
                          <div
                            className={cn(
                              "flex items-center mb-0.5",
                              timeCorrelationView === "overlay" && "cursor-pointer hover:bg-rose-50/50 rounded"
                            )}
                            onClick={() => {
                              if (timeCorrelationView === "overlay") {
                                setSymptomCyclesExpanded(prev => ({ ...prev, [row.key]: !prev[row.key] }));
                              }
                            }}
                          >
                            <span className="w-14 shrink-0 text-[8px] text-rose-600 truncate flex items-center gap-0.5">
                              {timeCorrelationView === "overlay" && (
                                <ChevronRight
                                  className={cn(
                                    "h-2.5 w-2.5 transition-transform shrink-0",
                                    symptomCyclesExpanded[row.key] && "rotate-90"
                                  )}
                                />
                              )}
                              <span>{row.label}</span>
                            </span>
                            <div className="flex flex-1 min-w-0">
                              {timeCorrelationHeatStrips.dayRange.map((day) => {
                                const value = row.values.get(day) ?? null;
                                const bgColor =
                                  value === null
                                    ? "#f5f5f5"
                                    : value <= 2
                                      ? "#fce7f3"
                                      : value <= 4
                                        ? "#fbcfe8"
                                        : value <= 6
                                          ? "#f9a8d4"
                                          : value <= 8
                                            ? "#f472b6"
                                            : "#ec4899";
                                return (
                                  <div
                                    key={day}
                                    className="h-2.5 flex-1 min-w-0 rounded-[1px] cursor-pointer"
                                    style={{ backgroundColor: bgColor }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCorrelationTooltip({
                                        day,
                                        label: timeCorrelationView === "overlay" ? `${row.label} (Ø)` : row.label,
                                        value: value !== null ? `${value.toFixed(1)}/10` : "Keine Daten"
                                      });
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                          {/* Expanded individual cycle rows */}
                          {symptomCyclesExpanded[row.key] && timeCorrelationView === "overlay" &&
                            timeCorrelationHeatStrips.cycleSymptomRows.map((cycle) => (
                              <div key={cycle.cycleIndex} className="flex items-center mb-0.5 ml-2">
                                <span className="w-12 shrink-0 text-[7px] text-rose-400 truncate">
                                  {new Date(cycle.startDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                                </span>
                                <div className="flex flex-1 min-w-0">
                                  {timeCorrelationHeatStrips.dayRange.map((day) => {
                                    const value = cycle.symptomValues.get(row.key as SymptomKey)?.get(day) ?? null;
                                    const bgColor =
                                      value === null
                                        ? "#f5f5f5"
                                        : value <= 2
                                          ? "#fce7f3"
                                          : value <= 4
                                            ? "#fbcfe8"
                                            : value <= 6
                                              ? "#f9a8d4"
                                              : value <= 8
                                                ? "#f472b6"
                                                : "#ec4899";
                                    return (
                                      <div
                                        key={day}
                                        className="h-2 flex-1 min-w-0 rounded-[1px] cursor-pointer"
                                        style={{ backgroundColor: bgColor }}
                                        onClick={() => setCorrelationTooltip({
                                          day,
                                          label: `${row.label} - ${new Date(cycle.startDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}`,
                                          value: value !== null ? `${value.toFixed(1)}/10` : "Keine Daten"
                                        })}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                        </div>
                      ))}

                      {/* Separator */}
                      <div className="h-px bg-rose-100 my-2" />

                      {/* Pain location groups */}
                      <div className="text-[9px] text-purple-500 font-medium mb-1">Schmerzorte</div>
                      {/* Gesamt (total) row - max pain across all locations */}
                      <div>
                        <div
                          className={cn(
                            "flex items-center mb-0.5",
                            timeCorrelationView === "overlay" && "cursor-pointer hover:bg-purple-50/50 rounded"
                          )}
                          onClick={() => {
                            if (timeCorrelationView === "overlay") {
                              setGesamtCyclesExpanded(!gesamtCyclesExpanded);
                            }
                          }}
                        >
                          <span className="w-14 shrink-0 text-[8px] text-purple-700 font-bold truncate flex items-center gap-0.5">
                            {timeCorrelationView === "overlay" && (
                              <ChevronRight
                                className={cn(
                                  "h-2.5 w-2.5 transition-transform shrink-0",
                                  gesamtCyclesExpanded && "rotate-90"
                                )}
                              />
                            )}
                            <span>Gesamt</span>
                          </span>
                          <div className="flex flex-1 min-w-0">
                            {timeCorrelationHeatStrips.dayRange.map((day) => {
                              const value = timeCorrelationHeatStrips.gesamtPainValues.get(day) ?? null;
                              const bgColor =
                                value === null
                                  ? "#f5f5f5"
                                  : value <= 2
                                    ? "#f3e8ff"
                                    : value <= 4
                                      ? "#e9d5ff"
                                      : value <= 6
                                        ? "#d8b4fe"
                                        : value <= 8
                                          ? "#c084fc"
                                          : "#a855f7";
                              return (
                                <div
                                  key={day}
                                  className="h-2.5 flex-1 min-w-0 rounded-[1px] cursor-pointer"
                                  style={{ backgroundColor: bgColor }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCorrelationTooltip({
                                      day,
                                      label: timeCorrelationView === "overlay" ? "Gesamt (Ø)" : "Gesamt",
                                      value: value !== null ? `${value.toFixed(1)}/10 (max)` : "Keine Daten"
                                    });
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>
                        {/* Expanded individual cycle rows */}
                        {gesamtCyclesExpanded && timeCorrelationView === "overlay" &&
                          timeCorrelationHeatStrips.cycleGesamtRows.map((cycle) => (
                            <div key={cycle.cycleIndex} className="flex items-center mb-0.5 ml-2">
                              <span className="w-12 shrink-0 text-[7px] text-purple-400 truncate">
                                {new Date(cycle.startDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                              </span>
                              <div className="flex flex-1 min-w-0">
                                {timeCorrelationHeatStrips.dayRange.map((day) => {
                                  const value = cycle.values.get(day) ?? null;
                                  const bgColor =
                                    value === null
                                      ? "#f5f5f5"
                                      : value <= 2
                                        ? "#f3e8ff"
                                        : value <= 4
                                          ? "#e9d5ff"
                                          : value <= 6
                                            ? "#d8b4fe"
                                            : value <= 8
                                              ? "#c084fc"
                                              : "#a855f7";
                                  return (
                                    <div
                                      key={day}
                                      className="h-2 flex-1 min-w-0 rounded-[1px] cursor-pointer"
                                      style={{ backgroundColor: bgColor }}
                                      onClick={() => setCorrelationTooltip({
                                        day,
                                        label: `Gesamt - ${new Date(cycle.startDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}`,
                                        value: value !== null ? `${value.toFixed(1)}/10 (max)` : "Keine Daten"
                                      })}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                      </div>
                      {timeCorrelationHeatStrips.locationGroups.map((group) => {
                        const isExpanded = expandedLocationGroups.has(group.id);
                        const hasData = Array.from(group.values.values()).some((v) => v !== null);
                        const hasChildren = group.children.length > 0;

                        if (!hasData) return null;

                        return (
                          <div key={group.id}>
                            {/* Group row */}
                            <div
                              className={cn(
                                "flex items-center mb-0.5",
                                hasChildren && "cursor-pointer hover:bg-purple-50/50 rounded"
                              )}
                              onClick={() => {
                                if (hasChildren) {
                                  setExpandedLocationGroups((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(group.id)) {
                                      next.delete(group.id);
                                    } else {
                                      next.add(group.id);
                                    }
                                    return next;
                                  });
                                }
                              }}
                            >
                              <span
                                className="w-14 shrink-0 text-[8px] text-purple-600 truncate flex items-center gap-0.5"
                                title={group.label}
                              >
                                {hasChildren && (
                                  <ChevronRight
                                    className={cn(
                                      "h-2.5 w-2.5 transition-transform shrink-0",
                                      isExpanded && "rotate-90"
                                    )}
                                  />
                                )}
                                <span className={hasChildren ? "" : "ml-3"}>{group.label}</span>
                              </span>
                              <div className="flex flex-1 min-w-0">
                                {timeCorrelationHeatStrips.dayRange.map((day) => {
                                  const value = group.values.get(day) ?? null;
                                  const bgColor =
                                    value === null
                                      ? "#f5f5f5"
                                      : value <= 2
                                        ? "#f3e8ff"
                                        : value <= 4
                                          ? "#e9d5ff"
                                          : value <= 6
                                            ? "#d8b4fe"
                                            : value <= 8
                                              ? "#c084fc"
                                              : "#a855f7";
                                  return (
                                    <div
                                      key={day}
                                      className="h-2.5 flex-1 min-w-0 rounded-[1px] cursor-pointer"
                                      style={{ backgroundColor: bgColor }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCorrelationTooltip({
                                          day,
                                          label: group.label,
                                          value: value !== null ? `${value.toFixed(1)}/10` : "Keine Daten"
                                        });
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </div>

                            {/* Expanded child rows */}
                            {isExpanded &&
                              group.children.map((child) => (
                                <div
                                  key={child.id}
                                  className="flex items-center mb-0.5 ml-2"
                                >
                                  <span className="w-12 shrink-0 text-[7px] text-purple-400 truncate">
                                    {child.label}
                                  </span>
                                  <div className="flex flex-1 min-w-0">
                                    {timeCorrelationHeatStrips.dayRange.map((day) => {
                                      const value = child.values.get(day) ?? null;
                                      const bgColor =
                                        value === null
                                          ? "#f5f5f5"
                                          : value <= 2
                                            ? "#f3e8ff"
                                            : value <= 4
                                              ? "#e9d5ff"
                                              : value <= 6
                                                ? "#d8b4fe"
                                                : value <= 8
                                                  ? "#c084fc"
                                                  : "#a855f7";
                                      return (
                                        <div
                                          key={day}
                                          className="h-2 flex-1 min-w-0 rounded-[1px] cursor-pointer"
                                          style={{ backgroundColor: bgColor }}
                                          onClick={() => setCorrelationTooltip({
                                            day,
                                            label: child.label,
                                            value: value !== null ? `${value.toFixed(1)}/10` : "Keine Daten"
                                          })}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                          </div>
                        );
                      })}

                      {/* Legend */}
                      <div className="mt-4 pt-3 border-t border-rose-100">
                        <div className="flex flex-wrap items-center gap-4 text-[10px] text-rose-600">
                          <span className="font-medium">Intensität:</span>
                          <div className="flex items-center gap-1">
                            <div className="h-3 w-3 rounded-sm bg-gray-100" />
                            <span>Keine Daten</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: "#fce7f3" }} />
                            <span>Gering</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: "#f9a8d4" }} />
                            <span>Mittel</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: "#ec4899" }} />
                            <span>Stark</span>
                          </div>
                        </div>
                        {timeCorrelationView === "overlay" && (
                          <p className="mt-2 text-[10px] text-rose-500">
                            Durchschnittswerte aus {timeCorrelationHeatStrips.cycleCount} Zyklen
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-sm text-rose-700 shadow-sm">
                    <p className="font-semibold text-rose-900">Noch keine Korrelationsdaten vorhanden.</p>
                    <p className="mt-1 text-rose-700">
                      Dokumentiere mindestens einen vollständigen Zyklus mit Symptomen und Schmerzen, um Korrelationen zu sehen.
                    </p>
                  </div>
                )}
              </Section>
              </div>
              ) : null}

              {analyticsActiveSection === "tracking" ? (
                <div className="space-y-6">

              <Section
                title="Medikation der letzten 7 Tage"
                description="Eine Kapsel pro dokumentiertem Eintrag – inklusive Rescue-Dosen."
                completionEnabled={false}
              >
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-rose-600">
                      <span>Heute und die letzten 6 Tage</span>
                      <span className="flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold text-sky-700">
                        <Pill className="h-3.5 w-3.5 text-sky-600" />
                        Rescue-Dosen
                      </span>
                    </div>
                  <div className="overflow-hidden rounded-2xl border border-rose-100 bg-white/80 p-3 shadow-sm">
                    <div className="flex items-end justify-between gap-2">
                      {medicationLast7Days.map((day) => {
                          const pills = [...new Array(day.rescueCount).fill("rescue" as const)];
                          const label = `${day.label}: ${day.rescueCount}x dokumentiert`;
                        return (
                          <div
                            key={day.date}
                            className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center"
                            aria-label={label}
                            title={day.tooltip}
                          >
                            <div className="text-[11px] font-semibold leading-tight text-rose-600">{day.label}</div>
                            <div className="flex h-24 w-full items-end justify-center">
                              {pills.length ? (
                                <div className="flex flex-col-reverse items-center justify-start gap-[6px]">
                                  {pills.map((type, index) => (
                                    <Pill
                                      key={`${day.date}-${type}-${index}`}
                                      className={cn(
                                        "h-4 w-4 drop-shadow-sm",
                                        type === "rescue" ? "text-sky-600" : "text-rose-500"
                                      )}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <span className="text-sm text-rose-300">–</span>
                              )}
                            </div>
                            <div className="text-[11px] text-rose-700">
                              {day.rescueCount === 1 ? "1×" : `${day.rescueCount}×`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-xs text-rose-600">
                    {totalMedicationsLast7Days
                      ? `${totalMedicationsLast7Days} dokumentierte Dosen in den letzten 7 Tagen.`
                      : "Keine Medikamente in den letzten 7 Tagen eingetragen."}
                  </p>
                </div>
              </Section>

              <Section
                title="Check-in Momentum"
                description="Wie konsequent du in den letzten Wochen dokumentiert hast"
                completionEnabled={false}
              >
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm shadow-sm">
                      <p className="text-xs font-semibold uppercase text-emerald-600">Aktuelle Serie</p>
                      <p className="mt-2 text-2xl font-bold text-emerald-800">{currentStreak} Tage</p>
                      <p className="mt-1 text-xs text-emerald-700">Längste Serie: {longestStreak} Tage</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm shadow-sm">
                      <p className="text-xs font-semibold uppercase text-amber-600">Check-ins im Zeitraum</p>
                      <p className="mt-2 text-2xl font-bold text-amber-800">
                        {checkInCount} / {checkInHistory.length}
                      </p>
                      <p className="mt-1 text-xs text-amber-700">{completionRate}% erledigt</p>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm shadow-sm">
                      <p className="text-xs font-semibold uppercase text-rose-600">Schmerz-Trend</p>
                      <p className="mt-2 text-2xl font-bold text-rose-800">
                        {typeof painRecentAvg === "number" ? painRecentAvg.toFixed(1) : "–"} NRS
                      </p>
                      <p className="mt-1 text-xs text-rose-600">{painTrendText}</p>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    {checkInHistory.length ? (
                      <ResponsiveContainer>
                        <ComposedChart data={checkInHistory} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#fecdd3" />
                          <XAxis
                            dataKey="date"
                            stroke="#fb7185"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value: string | number) =>
                              typeof value === "string" ? formatShortGermanDate(value) : ""
                            }
                          />
                          <YAxis
                            yAxisId="checkIn"
                            domain={[0, 1.2]}
                            stroke="#fb7185"
                            tick={{ fontSize: 12 }}
                            ticks={[0, 1]}
                            tickFormatter={(value: number) => (value >= 1 ? "Ja" : "Nein")}
                          />
                          <YAxis yAxisId="pain" domain={[0, 10]} stroke="#1d4ed8" tick={{ fontSize: 12 }} />
                          <Tooltip content={CheckInHistoryTooltip} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar
                            yAxisId="checkIn"
                            dataKey="checkIn"
                            name="Check-in erledigt"
                            radius={[6, 6, 0, 0]}
                          >
                            {checkInHistory.map((item) => (
                              <Cell key={item.date} fill={item.checkIn ? "#fb7185" : "#fecdd3"} />
                            ))}
                          </Bar>
                          <Line
                            yAxisId="pain"
                            type="monotone"
                            dataKey="pain"
                            name="Schmerz (NRS)"
                            stroke="#1d4ed8"
                            strokeWidth={2}
                            dot={{ r: 2 }}
                            connectNulls
                            isAnimationActive={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-xl border border-rose-100 bg-rose-50/60 text-sm text-rose-600">
                        Noch keine Check-ins im ausgewählten Zeitraum.
                      </div>
                    )}
                  </div>
                </div>
              </Section>

              </div>
              ) : null}

              {analyticsActiveSection === "correlations" ? (
                <div className="space-y-6">
                  <Section
                    title="Schmerz & Blutung"
                    description="Zusammenhänge zwischen Schmerzintensität und Blutungsstärke"
                    completionEnabled={false}
                  >
                    <div className="space-y-6">
                      {/* Day-of-Period Pain Pattern */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100">
                            <span className="text-sm font-bold text-rose-600">1</span>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-rose-800">Schmerz nach Periodentag</h4>
                            <p className="text-xs text-rose-500">Durchschnittlicher Schmerz pro Tag der Blutung</p>
                          </div>
                        </div>
                        {dayOfPeriodPain ? (
                          <div className="rounded-xl border border-rose-100 bg-white/80 p-4">
                            <div className="h-48 w-full">
                              <ResponsiveContainer>
                                <BarChart data={dayOfPeriodPain} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#fecdd3" vertical={false} />
                                  <XAxis
                                    dataKey="label"
                                    stroke="#fb7185"
                                    tick={{ fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                  />
                                  <YAxis
                                    domain={[0, 10]}
                                    stroke="#fb7185"
                                    tick={{ fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={32}
                                  />
                                  <Tooltip
                                    content={({ active, payload }) => {
                                      if (!active || !payload?.length) return null;
                                      const data = payload[0].payload as { label: string; avgPain: number; count: number };
                                      return (
                                        <div className="rounded-lg border border-rose-200 bg-white p-2 text-xs shadow-sm">
                                          <p className="font-semibold text-rose-800">{data.label}</p>
                                          <p className="text-rose-600">Ø Schmerz: {data.avgPain}</p>
                                          <p className="text-rose-500">Datenpunkte: {data.count}</p>
                                        </div>
                                      );
                                    }}
                                  />
                                  <Bar dataKey="avgPain" fill="#fb7185" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                    {dayOfPeriodPain.map((entry, index) => (
                                      <Cell
                                        key={`cell-${index}`}
                                        fill={entry.avgPain >= 7 ? "#e11d48" : entry.avgPain >= 4 ? "#fb7185" : "#fda4af"}
                                      />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            <p className="mt-2 text-center text-xs text-rose-500">
                              Höchster Schmerz: Tag {dayOfPeriodPain.reduce((max, d) => (d.avgPain > max.avgPain ? d : max)).day}
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/40 p-4 text-center text-xs text-rose-600">
                            Trage Schmerz an mindestens 2 Blutungstagen ein, um das Muster zu sehen.
                          </div>
                        )}
                      </div>

                      {/* Pain vs PBAC Scatter */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100">
                            <span className="text-sm font-bold text-rose-600">2</span>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-rose-800">PBAC-Score & Schmerz</h4>
                            <p className="text-xs text-rose-500">Zusammenhang zwischen Blutungsstärke und Schmerz</p>
                          </div>
                        </div>
                        {painBleedingScatter ? (
                          <div className="rounded-xl border border-rose-100 bg-white/80 p-4">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                  Math.abs(painBleedingScatter.r) >= 0.5
                                    ? "bg-emerald-100 text-emerald-700"
                                    : Math.abs(painBleedingScatter.r) >= 0.3
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {painBleedingScatter.interpretation}
                              </span>
                              <span className="text-xs text-rose-500">
                                r = {painBleedingScatter.r} (n={painBleedingScatter.n})
                              </span>
                            </div>
                            <div className="h-52 w-full">
                              <ResponsiveContainer>
                                <ScatterChart margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#fecdd3" />
                                  <XAxis
                                    type="number"
                                    dataKey="x"
                                    name="PBAC"
                                    stroke="#fb7185"
                                    tick={{ fontSize: 11 }}
                                    axisLine={false}
                                    label={{ value: "PBAC", position: "bottom", offset: -4, fontSize: 10, fill: "#fb7185" }}
                                  />
                                  <YAxis
                                    type="number"
                                    dataKey="y"
                                    name="Schmerz"
                                    domain={[0, 10]}
                                    stroke="#fb7185"
                                    tick={{ fontSize: 11 }}
                                    axisLine={false}
                                    width={32}
                                    label={{
                                      value: "NRS",
                                      angle: -90,
                                      position: "insideLeft",
                                      offset: 16,
                                      fontSize: 10,
                                      fill: "#fb7185",
                                    }}
                                  />
                                  <Tooltip
                                    content={({ active, payload }) => {
                                      if (!active || !payload?.length) return null;
                                      const point = payload[0].payload as { x: number; y: number; date: string };
                                      return (
                                        <div className="rounded-lg border border-rose-200 bg-white p-2 text-xs shadow-sm">
                                          <p className="font-semibold text-rose-800">{formatShortGermanDate(point.date)}</p>
                                          <p className="text-rose-600">PBAC: {point.x}</p>
                                          <p className="text-rose-600">Schmerz: {point.y}</p>
                                        </div>
                                      );
                                    }}
                                  />
                                  <Scatter data={painBleedingScatter.points} fill="#fb7185" fillOpacity={0.7} />
                                  <ReferenceLine
                                    segment={[
                                      painBleedingScatter.trendLine.start,
                                      painBleedingScatter.trendLine.end,
                                    ]}
                                    stroke="#e11d48"
                                    strokeWidth={2}
                                    strokeDasharray="4 4"
                                  />
                                </ScatterChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/40 p-4 text-center text-xs text-rose-600">
                            Trage PBAC-Werte und Schmerz an mindestens 3 Blutungstagen ein.
                          </div>
                        )}
                      </div>

                      {/* Cycle Comparison Strips */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100">
                            <span className="text-sm font-bold text-rose-600">3</span>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-rose-800">Zyklusvergleich</h4>
                            <p className="text-xs text-rose-500">Schmerz- und Blutungsmuster der letzten Perioden</p>
                          </div>
                        </div>
                        {cycleStrips ? (
                          <div className="space-y-2 rounded-xl border border-rose-100 bg-white/80 p-4">
                            <div className="mb-3 flex items-center justify-between text-[10px] text-rose-400">
                              <span>Start</span>
                              <div className="flex gap-3">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((d) => (
                                  <span key={d} className="w-5 text-center">
                                    {d}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {cycleStrips.map((cycle) => (
                              <div key={cycle.startDate} className="flex items-center gap-2">
                                <span className="w-16 shrink-0 text-[10px] text-rose-500">
                                  {formatShortGermanDate(cycle.startDate)}
                                </span>
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((dayNum) => {
                                    const dayData = cycle.days.find((d) => d.cycleDay === dayNum);
                                    if (!dayData) {
                                      return (
                                        <div
                                          key={dayNum}
                                          className="h-6 w-5 rounded border border-dashed border-rose-100 bg-rose-50/30"
                                          title={`Tag ${dayNum}: Keine Daten`}
                                        />
                                      );
                                    }
                                    const painLevel = dayData.pain ?? 0;
                                    const bgColor =
                                      painLevel >= 7
                                        ? "bg-rose-600"
                                        : painLevel >= 5
                                          ? "bg-rose-400"
                                          : painLevel >= 3
                                            ? "bg-rose-300"
                                            : painLevel > 0
                                              ? "bg-rose-200"
                                              : "bg-rose-100";
                                    const ringColor = dayData.isBleeding ? "ring-2 ring-rose-500 ring-offset-1" : "";
                                    return (
                                      <div
                                        key={dayNum}
                                        className={`h-6 w-5 rounded ${bgColor} ${ringColor}`}
                                        title={`Tag ${dayNum}: Schmerz ${dayData.pain ?? "–"}, PBAC ${dayData.pbac ?? "–"}`}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                            <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[10px] text-rose-500">
                              <span className="flex items-center gap-1">
                                <span className="h-3 w-3 rounded bg-rose-100" /> 0–2
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="h-3 w-3 rounded bg-rose-300" /> 3–4
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="h-3 w-3 rounded bg-rose-400" /> 5–6
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="h-3 w-3 rounded bg-rose-600" /> 7–10
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="h-3 w-3 rounded bg-rose-200 ring-2 ring-rose-500 ring-offset-1" /> Blutung
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/40 p-4 text-center text-xs text-rose-600">
                            Dokumentiere mindestens eine Periode, um den Vergleich zu sehen.
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="mt-4 text-[11px] text-rose-500">
                      Hinweis: Diese Auswertungen dienen der Orientierung und ersetzen keine ärztliche Beratung.
                    </p>
                  </Section>
                </div>
              ) : null}
            </div>
          </SectionScopeContext.Provider>
        </TabsContent>
        <TabsContent value="weekly" className="space-y-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium text-amber-900">{weeklyBannerText}</p>
            {weeklyReportsError ? (
              <p className="mt-2 text-xs text-amber-700">{weeklyReportsError}</p>
            ) : null}
          </div>
          <SectionScopeContext.Provider value={`weekly:${weeklyScopeIsoWeek}`}>
          {weeklyReportsReady ? (
            <WeeklyTabShell
              dailyEntries={derivedDailyEntries}
              currentIsoWeek={currentIsoWeek}
              onSelectionChange={setWeeklyIsoWeek}
            />
          ) : (
            <div className="rounded-xl border border-rose-100 bg-white/80 p-4 text-sm text-rose-700">
              Wöchentliche Daten werden geladen …
            </div>
          )}
          </SectionScopeContext.Provider>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <SectionScopeContext.Provider value={`monthly:${monthlyDraft.month}`}>
          <Section
            title="Monatliche Fragebögen"
            description="Lebensqualität (EHP-5), Stimmung (PHQ-9), Angst (GAD-7) und optionale PROMIS-T-Scores"
            aside={<Calendar size={16} className="text-rose-500" />}
            variant="plain"
            completionEnabled={false}
          >
            <div className="grid gap-6">
              <Labeled label="Monat (YYYY-MM)" htmlFor="monthly-month">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex w-full max-w-xl items-center justify-between gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 shadow-sm">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={goToPreviousMonth}
                      aria-label="Vorheriger Monat"
                      className="text-rose-500 hover:text-rose-700"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <CalendarDays className="h-6 w-6 flex-shrink-0 text-rose-500" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-rose-400">Ausgewählter Monat</p>
                        <p className="truncate text-sm font-semibold text-rose-700">
                          {selectedMonthLabel ?? "Bitte Monat wählen"}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={goToNextMonth}
                      aria-label="Nächster Monat"
                      className="text-rose-500 hover:text-rose-700"
                      disabled={!canGoToNextMonth}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-rose-400" aria-hidden="true" />
                    <Input
                      id="monthly-month"
                      type="month"
                      value={monthlyDraft.month}
                      onChange={(event) => setMonthlyDraft((prev) => ({ ...prev, month: event.target.value }))}
                      className="w-full max-w-[11rem]"
                      max={currentMonth}
                      aria-label="Monat direkt auswählen"
                    />
                  </div>
                </div>
                {hasEntryForSelectedMonth && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
                    <div>
                      <p className="font-semibold">Für diesen Monat wurden bereits Angaben gespeichert.</p>
                      <p className="text-xs text-amber-600">Beim Speichern werden die bestehenden Daten aktualisiert.</p>
                    </div>
                  </div>
                )}
                {renderIssuesForPath("month")}
              </Labeled>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
                  <TermHeadline termKey="ehp5" />
                  <p className="text-xs text-rose-600">{TERMS.ehp5.help}</p>
                  {EHP5_ITEMS.map((item, index) => {
                    const value = monthlyDraft.qol?.ehp5Items?.[index];
                    const selectValue = value !== undefined ? String(value) : "unset";
                    return (
                      <Labeled
                        key={item}
                        label={`EHP-5 ${index + 1}: ${item}`}
                        tech="Antwort 0–4"
                        help="0 = gar nicht, 4 = immer"
                        htmlFor={`ehp5-${index}`}
                      >
                        <Select
                          value={selectValue}
                          onValueChange={(val) => handleEhp5ItemChange(index, val === "unset" ? undefined : Number(val))}
                        >
                          <SelectTrigger id={`ehp5-${index}`}>
                            <SelectValue placeholder="0–4 auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unset">Keine Angabe</SelectItem>
                            {SCALE_OPTIONS_0_4.map((option) => (
                              <SelectItem key={option} value={String(option)}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {renderIssuesForPath(`qol.ehp5Items[${index}]`)}
                      </Labeled>
                    );
                  })}
                  <div className="rounded border border-rose-100 bg-white p-3 text-sm text-rose-700">
                    <p>Summe: {monthlyDraft.qol?.ehp5Total ?? "–"}</p>
                    <p>Transform (0–100): {monthlyDraft.qol?.ehp5Transformed ?? "–"}</p>
                    <div className="space-y-1 text-xs text-rose-600">
                      {renderIssuesForPath("qol.ehp5Total")}
                      {renderIssuesForPath("qol.ehp5Transformed")}
                    </div>
                  </div>
                </div>
                <div className="space-y-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
                  <TermHeadline termKey="phq9" />
                  <p className="text-xs text-rose-600">{TERMS.phq9.help}</p>
                  {PHQ9_ITEMS.map((item, index) => {
                    const value = monthlyDraft.mental?.phq9Items?.[index];
                    const selectValue = value !== undefined ? String(value) : "unset";
                    return (
                      <Labeled
                        key={item}
                        label={`PHQ-9 ${index + 1}: ${item}`}
                        tech="Antwort 0–3"
                        help="0 = überhaupt nicht, 3 = fast jeden Tag"
                        htmlFor={`phq-${index}`}
                      >
                        <Select
                          value={selectValue}
                          onValueChange={(val) => handlePhqItemChange(index, val === "unset" ? undefined : Number(val))}
                        >
                          <SelectTrigger id={`phq-${index}`}>
                            <SelectValue placeholder="0–3 auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unset">Keine Angabe</SelectItem>
                            {SCALE_OPTIONS_0_3.map((option) => (
                              <SelectItem key={option} value={String(option)}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {renderIssuesForPath(`mental.phq9Items[${index}]`)}
                      </Labeled>
                    );
                  })}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-rose-100 bg-white p-3 text-sm text-rose-700">
                    <div>
                      <p>Summe: {monthlyDraft.mental?.phq9 ?? "–"}</p>
                      <div className="space-y-1 text-xs text-rose-600">
                        {renderIssuesForPath("mental.phq9")}
                        {renderIssuesForPath("mental.phq9Severity")}
                      </div>
                    </div>
                    {phqSeverity ? (
                      <Badge className={cn("text-xs", severityBadgeClass(phqSeverity))}>{severityLabel(phqSeverity)}</Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
                  <TermHeadline termKey="gad7" />
                  <p className="text-xs text-rose-600">{TERMS.gad7.help}</p>
                  {GAD7_ITEMS.map((item, index) => {
                    const value = monthlyDraft.mental?.gad7Items?.[index];
                    const selectValue = value !== undefined ? String(value) : "unset";
                    return (
                      <Labeled
                        key={item}
                        label={`GAD-7 ${index + 1}: ${item}`}
                        tech="Antwort 0–3"
                        help="0 = überhaupt nicht, 3 = fast jeden Tag"
                        htmlFor={`gad-${index}`}
                      >
                        <Select
                          value={selectValue}
                          onValueChange={(val) => handleGadItemChange(index, val === "unset" ? undefined : Number(val))}
                        >
                          <SelectTrigger id={`gad-${index}`}>
                            <SelectValue placeholder="0–3 auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unset">Keine Angabe</SelectItem>
                            {SCALE_OPTIONS_0_3.map((option) => (
                              <SelectItem key={option} value={String(option)}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {renderIssuesForPath(`mental.gad7Items[${index}]`)}
                      </Labeled>
                    );
                  })}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-rose-100 bg-white p-3 text-sm text-rose-700">
                    <div>
                      <p>Summe: {monthlyDraft.mental?.gad7 ?? "–"}</p>
                      <div className="space-y-1 text-xs text-rose-600">
                        {renderIssuesForPath("mental.gad7")}
                        {renderIssuesForPath("mental.gad7Severity")}
                      </div>
                    </div>
                    {gadSeverity ? (
                      <Badge className={cn("text-xs", severityBadgeClass(gadSeverity))}>{severityLabel(gadSeverity)}</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
                  <p className="font-medium text-rose-800">PROMIS T-Scores</p>
                  <TermField termKey="promis_fatigue" htmlFor="promis-fatigue">
                    <Input
                      id="promis-fatigue"
                      type="number"
                      min={0}
                      max={100}
                      value={monthlyDraft.promis?.fatigueT ?? ""}
                      onChange={(event) =>
                        setMonthlyDraft((prev) => ({
                          ...prev,
                          promis: { ...(prev.promis ?? {}), fatigueT: event.target.value ? Number(event.target.value) : undefined },
                        }))
                      }
                    />
                    {renderIssuesForPath("promis.fatigueT")}
                  </TermField>
                  <TermField termKey="promis_painInt" htmlFor="promis-pain">
                    <Input
                      id="promis-pain"
                      type="number"
                      min={0}
                      max={100}
                      value={monthlyDraft.promis?.painInterferenceT ?? ""}
                      onChange={(event) =>
                        setMonthlyDraft((prev) => ({
                          ...prev,
                          promis: {
                            ...(prev.promis ?? {}),
                            painInterferenceT: event.target.value ? Number(event.target.value) : undefined,
                          },
                        }))
                      }
                    />
                    {renderIssuesForPath("promis.painInterferenceT")}
                  </TermField>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" onClick={handleMonthlySubmit}>
                Monat speichern
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  downloadFile(
                    `endo-monthly-${today}.json`,
                    JSON.stringify(monthlyEntries, null, 2),
                    "application/json"
                  )
                }
              >
                <Download size={16} className="mr-2" /> Export
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  downloadFile(
                    `endo-monthly-${today}.csv`,
                    toCsv(
                      monthlyEntries.map((entry) => ({
                        Monat: entry.month,
                        [`${TERMS.ehp5.label} Summe`]: entry.qol?.ehp5Total ?? "",
                        [`${TERMS.ehp5.label} Transform`]: entry.qol?.ehp5Transformed ?? "",
                        [`${TERMS.phq9.label}`]: entry.mental?.phq9 ?? "",
                        [`${TERMS.phq9.label} Ampel`]: entry.mental?.phq9Severity ?? "",
                        [`${TERMS.gad7.label}`]: entry.mental?.gad7 ?? "",
                        [`${TERMS.gad7.label} Ampel`]: entry.mental?.gad7Severity ?? "",
                        [`${TERMS.promis_fatigue.label}`]: entry.promis?.fatigueT ?? "",
                        [`${TERMS.promis_painInt.label}`]: entry.promis?.painInterferenceT ?? "",
                      }))
                    ),
                    "text/csv"
                  )
                }
              >
                <Download size={16} className="mr-2" /> CSV
              </Button>
            </div>
          </Section>
          <Section title="Verlauf" description="EHP-5 & psychische Scores" completionEnabled={false}>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart
                  data={monthlyEntries.map((entry) => ({
                    month: entry.month,
                    ehp5: entry.qol?.ehp5Total ?? null,
                    phq9: entry.mental?.phq9 ?? null,
                    gad7: entry.mental?.gad7 ?? null,
                  }))}
                  margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                  <XAxis dataKey="month" stroke="#fb7185" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#f43f5e" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="ehp5" stroke="#f43f5e" strokeWidth={2} name={TERMS.ehp5.label} />
                  <Line type="monotone" dataKey="phq9" stroke="#6366f1" strokeWidth={2} name={TERMS.phq9.label} />
                  <Line type="monotone" dataKey="gad7" stroke="#22c55e" strokeWidth={2} name={TERMS.gad7.label} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>
          </SectionScopeContext.Provider>
        </TabsContent>
              </Tabs>
            </div>
          )}
        </main>
      </SectionCompletionContext.Provider>
      {bleedingQuickAddNotice && BleedingQuickAddNoticeIcon ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-4 z-[55] flex justify-center px-4 sm:inset-auto sm:right-6 sm:top-6 sm:justify-end sm:px-0"
          aria-live="polite"
        >
          <div
            key={bleedingQuickAddNotice.id}
            className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-rose-100/80 bg-white/90 px-4 py-3 text-sm text-rose-900 shadow-[0_12px_45px_rgba(190,24,93,0.25)] backdrop-blur-lg transition sm:w-80"
            role="status"
          >
            <span
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl",
                PBAC_SATURATION_ICON_CLASSES[bleedingQuickAddNotice.saturation]
              )}
              aria-hidden
            >
              <BleedingQuickAddNoticeIcon className="h-6 w-6" aria-hidden />
            </span>
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Hinzugefügt
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-rose-900">{bleedingQuickAddNotice.label}</span>
                <span className="text-xs font-semibold text-rose-500">
                  +{bleedingQuickAddNotice.score} PBAC
                </span>
              </div>
              <span className="text-[11px] uppercase tracking-wide text-rose-400">Periode</span>
            </div>
          </div>
        </div>
      ) : null}
      {painQuickAddOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-rose-950/40 px-4 py-6 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Schmerz schnell erfassen"
          onClick={handlePainQuickClose}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-3xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Schmerz</p>
                <p className="text-lg font-semibold text-rose-900">
                  {painQuickContext === "module" ? "Schmerz hinzufügen" : "Shortcut"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {painQuickStep > 1 ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handlePainQuickBack();
                    }}
                    className="rounded-full border border-rose-100 p-2 text-rose-500 transition hover:border-rose-200 hover:text-rose-700"
                    aria-label="Zurück"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePainQuickClose();
                  }}
                  className="rounded-full border border-rose-100 p-2 text-rose-500 transition hover:border-rose-200 hover:text-rose-700"
                  aria-label="Schließen"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1" aria-hidden>
              {[1, 2, 3].map((step) => (
                <span
                  key={`pain-step-${step}`}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    painQuickStep >= step ? "bg-rose-500" : "bg-rose-100"
                  )}
                />
              ))}
            </div>
            {(quickPainRegionLabel || quickPainQualityLabel || painQuickTimeLabel) && (
              <div className="flex flex-wrap gap-2 text-xs text-rose-500">
                {quickPainRegionLabel ? (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-600">{quickPainRegionLabel}</span>
                ) : null}
                {painQuickQualities.map((quality) => (
                  <span key={quality} className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-600">
                    {quality}
                  </span>
                ))}
                {!painQuickQualities.length && quickPainQualityLabel ? (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-600">{quickPainQualityLabel}</span>
                ) : null}
                {painQuickTimeLabel ? (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-600">{painQuickTimeLabel}</span>
                ) : null}
              </div>
            )}
            {painQuickStep === 1 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Ort</p>
                <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                  {BODY_REGION_GROUPS.map((group) => (
                    <div key={group.id} className="rounded-2xl border border-rose-100 bg-rose-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-400">
                        {group.label}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-1.5 text-left text-xs">
                        {group.regions.map((region) => {
                          const isSelected = painQuickRegion === region.id;
                          return (
                            <button
                              key={region.id}
                              type="button"
                              onClick={() => handlePainQuickRegionSelect(region.id)}
                              className={cn(
                                "rounded-xl border px-2 py-1.5 text-left transition",
                                isSelected
                                  ? "border-rose-400 bg-white text-rose-800 shadow"
                                  : "border-transparent bg-white/80 text-rose-600 hover:border-rose-200"
                              )}
                            >
                              {region.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {painQuickStep === 2 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Art</p>
                <div className="grid grid-cols-2 gap-1.5 text-sm">
                  {quickPainQualityOptions.map((quality) => {
                    const isSelected = painQuickQualities.includes(quality);
                    return (
                      <button
                        key={quality}
                        type="button"
                        onClick={() => handlePainQuickQualitySelect(quality)}
                        className={cn(
                          "rounded-xl border px-3 py-1.5 text-left transition",
                          isSelected
                            ? "border-rose-400 bg-white text-rose-800 shadow"
                            : "border-transparent bg-rose-50 text-rose-600 hover:border-rose-200"
                        )}
                      >
                        {quality}
                      </button>
                    );
                  })}
                </div>
                <div className="text-right">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPainQuickStep(3)}
                    disabled={!painQuickQualities.length}
                  >
                    weiter
                  </Button>
                </div>
              </div>
            ) : null}
            {painQuickStep === 3 ? (
              <div className="space-y-4">
                {painQuickContext === "module" ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Zeitraum</p>
                    <div className="grid grid-cols-3 gap-1.5 text-sm">
                      {PAIN_TIMES_OF_DAY.map((time) => {
                        const isSelected = painQuickTimesOfDay.includes(time);
                        return (
                          <button
                            key={time}
                            type="button"
                            onClick={() => handlePainQuickTimeToggle(time)}
                            className={cn(
                              "rounded-xl border px-3 py-1.5 text-left transition",
                              isSelected
                                ? "border-rose-400 bg-white text-rose-800 shadow"
                                : "border-transparent bg-rose-50 text-rose-600 hover:border-rose-200",
                            )}
                          >
                            {PAIN_TIME_OF_DAY_LABEL[time]}
                          </button>
                        );
                      })}
                    </div>
                    {!painQuickTimesOfDay.length ? (
                      <p className="text-[11px] text-rose-400">Bitte mindestens einen Zeitraum auswählen.</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-rose-600">Zeitpunkt wird automatisch mit Zeitstempel erfasst.</p>
                )}
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Stärke</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Slider
                      min={0}
                      max={10}
                      step={1}
                      value={[painQuickIntensity]}
                      onValueChange={([value]) => setPainQuickIntensity(value ?? 0)}
                      aria-label="Schmerzstärke"
                    />
                    <div className="flex justify-between text-[11px] text-rose-400">
                      <span>0</span>
                      <span>10</span>
                    </div>
                  </div>
                  <SliderValueDisplay value={painQuickIntensity} />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={handlePainQuickConfirm}
                  disabled={!painQuickRegion || !painQuickQualities.length || (painQuickContext === "module" && painQuickTimesOfDay.length === 0)}
                >
                  speichern
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {bleedingQuickAddOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-rose-950/40 px-4 py-6 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Produkt zur Periode hinzufügen"
          onClick={() => setBleedingQuickAddOpen(false)}
        >
          <div
            className="w-full max-w-md space-y-5 rounded-3xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                  Periode & Blutung
                </p>
                <p className="text-lg font-semibold text-rose-900">Produkt hinzufügen</p>
              </div>
              <button
                type="button"
                onClick={() => setBleedingQuickAddOpen(false)}
                className="rounded-full border border-rose-100 p-2 text-rose-500 transition hover:border-rose-200 hover:text-rose-700"
                aria-label="Schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {effectiveBleedingTrackingMethod === "pbac_extended" ? (
              <ExtendedBleedingEntryForm
                settings={productSettings}
                onAddEntry={(entry) => {
                  // Ensure we're editing today's draft before adding entry
                  if (dailyDraft.date !== today) {
                    selectDailyDate(today);
                  }
                  handleAddExtendedBleedingEntry(entry);
                  setBleedingQuickAddOpen(false);
                }}
              />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {PBAC_PRODUCT_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleBleedingQuickAddSelect(item.id)}
                      className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-white/90 p-3 text-left text-rose-900 shadow-sm transition hover:border-rose-300"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                        <item.Icon className="h-7 w-7" aria-hidden />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className="text-xs text-rose-500">+{item.score} PBAC</p>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-rose-500">Die Auswahl wird direkt für heute gezählt.</p>
              </>
            )}
          </div>
        </div>
      ) : null}
      {pendingDismissCheckIn ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-rose-950/40 px-4 py-6">
          <div
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Check-in ausfallen lassen"
          >
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-rose-900">Diesen Check-in ausfallen lassen?</h2>
              <p className="text-sm text-rose-700">{pendingDismissCheckIn.label}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  handleFillCheckIn(pendingDismissCheckIn.type);
                }}
                className="sm:w-auto"
              >
                ausfüllen
              </Button>
              <Button
                type="button"
                onClick={() => dismissCheckIn(pendingDismissCheckIn.key)}
                className="sm:w-auto"
              >
                ausfallen lassen
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingOverviewConfirm ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-rose-950/40 px-4 py-6">
          <div
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Änderungen speichern oder verwerfen"
          >
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-rose-900">Änderungen übernehmen?</h2>
              <p className="text-sm text-rose-700">
                {pendingOverviewConfirm.action === "change-date"
                  ? "Beim Wechsel des Tages würden ungespeicherte Änderungen verloren gehen. Möchtest du sie speichern oder verwerfen?"
                  : "In der Tagesübersicht liegen ungespeicherte Änderungen vor. Möchtest du sie speichern oder verwerfen?"}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={handleOverviewConfirmCancel} className="sm:w-auto">
                Abbrechen
              </Button>
              <Button variant="outline" onClick={handleOverviewConfirmDiscard} className="sm:w-auto">
                Verwerfen
              </Button>
              <Button onClick={handleOverviewConfirmSave} className="sm:w-auto">
                Speichern
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingCategoryConfirm ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-rose-950/40 px-4 py-6">
          <div
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Änderungen speichern oder verwerfen"
          >
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-rose-900">Änderungen übernehmen?</h2>
              <p className="text-sm text-rose-700">
                {pendingCategoryTitle
                  ? `In „${pendingCategoryTitle}“ wurden Änderungen vorgenommen.`
                  : "Es liegen Änderungen vor."}
                {" "}Möchtest du sie speichern oder verwerfen?
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={handleCategoryConfirmCancel} className="sm:w-auto">
                Abbrechen
              </Button>
              <Button
                variant="outline"
                onClick={handleCategoryConfirmDiscard}
                className="sm:w-auto"
              >
                Verwerfen
              </Button>
              <Button onClick={handleCategoryConfirmSave} className="sm:w-auto">
                Speichern
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
