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
import type { ChangeEvent, ReactNode } from "react";
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
  ScatterChart,
  Scatter,
  Area,
  ComposedChart,
  ReferenceDot,
  ReferenceLine,
} from "recharts";
import type { DotProps, TooltipProps } from "recharts";
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  HardDrive,
  Home,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Upload,
} from "lucide-react";

import { DailyEntry, FeatureFlags, MonthlyEntry } from "@/lib/types";
import { TERMS } from "@/lib/terms";
import type { ModuleTerms, TermDescriptor, TermKey } from "@/lib/terms";
import { validateDailyEntry, validateMonthlyEntry, type ValidationIssue } from "@/lib/validation";
import InfoTip from "@/components/InfoTip";
import { Labeled } from "@/components/Labeled";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { SliderValueDisplay } from "@/components/ui/slider-value-display";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Checkbox from "@/components/ui/checkbox";

import { cn } from "@/lib/utils";
import { touchLastActive } from "@/lib/persistence";
import { usePersistentState } from "@/lib/usePersistentState";
import WeeklyTabShell from "@/components/weekly/WeeklyTabShell";
import {
  listWeeklyReports,
  replaceWeeklyReports,
  type WeeklyReport,
  type PromptAnswers,
} from "@/lib/weekly/reports";
import { normalizeWpai, type WeeklyWpai } from "@/lib/weekly/wpai";
import { isoWeekToDate } from "@/lib/isoWeek";

const DETAIL_TOOLBAR_FALLBACK_HEIGHT = 96;

type SymptomKey = keyof DailyEntry["symptoms"];

const SYMPTOM_TERMS: Record<SymptomKey, TermDescriptor> = {
  dysmenorrhea: TERMS.dysmenorrhea,
  deepDyspareunia: TERMS.deepDyspareunia,
  pelvicPainNonMenses: TERMS.pelvicPainNonMenses,
  dyschezia: TERMS.dyschezia,
  dysuria: TERMS.dysuria,
  fatigue: TERMS.fatigue,
  bloating: TERMS.bloating,
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type BackupPayload = {
  version: number;
  exportedAt: string;
  dailyEntries: DailyEntry[];
  weeklyReports: WeeklyReport[];
  monthlyEntries: MonthlyEntry[];
  featureFlags: FeatureFlags;
};

const BASE_PAIN_QUALITIES = [
  "krampfend",
  "stechend",
  "brennend",
  "dumpf",
  "ziehend",
  "anders",
] as const;

const MIGRAINE_PAIN_QUALITIES = ["Migräne", "Migräne mit Aura"] as const;

const PAIN_QUALITIES: DailyEntry["painQuality"] = [...BASE_PAIN_QUALITIES] as DailyEntry["painQuality"];
const HEAD_PAIN_QUALITIES: DailyEntry["painQuality"] = [
  ...BASE_PAIN_QUALITIES,
  ...MIGRAINE_PAIN_QUALITIES,
] as DailyEntry["painQuality"];
const ALL_PAIN_QUALITIES: DailyEntry["painQuality"] = HEAD_PAIN_QUALITIES;

const HEAD_REGION_ID = "head";
const MIGRAINE_LABEL = "Migräne";
const MIGRAINE_WITH_AURA_LABEL = "Migräne mit Aura";
const MIGRAINE_QUALITY_SET = new Set<string>(MIGRAINE_PAIN_QUALITIES);
type OvulationPainSide = Exclude<NonNullable<DailyEntry["ovulationPain"]>["side"], undefined>;

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

const collectPainRegionQualities = (
  regions: NonNullable<DailyEntry["painRegions"]>
): DailyEntry["painQuality"] => {
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

type DailyCategoryId =
  | "overview"
  | "pain"
  | "symptoms"
  | "bleeding"
  | "medication"
  | "sleep"
  | "bowelBladder"
  | "notes"
  | "optional";

const DAILY_CATEGORY_KEYS: Exclude<DailyCategoryId, "overview">[] = [
  "pain",
  "symptoms",
  "bleeding",
  "medication",
  "sleep",
  "bowelBladder",
  "notes",
  "optional",
];

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

const REGION_TO_GROUP_ID: Record<string, string> = BODY_REGION_GROUPS.reduce(
  (acc, group) => {
    group.regions.forEach((region) => {
      acc[region.id] = group.id;
    });
    return acc;
  },
  {} as Record<string, string>
);

const ABDOMEN_REGION_IDS = new Set(
  (BODY_REGION_GROUPS.find((group) => group.id === "abdomen")?.regions ?? []).map((region) => region.id)
);

const clampScore = (value: number | undefined | null): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(10, Math.round(value)));
};

const computeMaxPainIntensity = (entry: DailyEntry): number | null => {
  const intensities: number[] = [];
  const impact = clampScore(entry.impactNRS);
  if (impact !== null) {
    intensities.push(impact);
  }
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
  if (!intensities.length) {
    return null;
  }
  return Math.max(...intensities);
};

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
  const result: DailyEntry = { ...entry, symptoms };

  if (entry.bleeding.isBleeding) {
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

const PBAC_PRODUCT_ITEMS = [
  { id: "pad_light", label: "Binde – leicht", score: 1, product: "pad", saturation: "light" },
  { id: "pad_medium", label: "Binde – mittel", score: 5, product: "pad", saturation: "medium" },
  { id: "pad_heavy", label: "Binde – stark", score: 20, product: "pad", saturation: "heavy" },
  { id: "tampon_light", label: "Tampon – leicht", score: 1, product: "tampon", saturation: "light" },
  { id: "tampon_medium", label: "Tampon – mittel", score: 5, product: "tampon", saturation: "medium" },
  { id: "tampon_heavy", label: "Tampon – stark", score: 10, product: "tampon", saturation: "heavy" },
] as const;

const PBAC_CLOT_ITEMS = [
  { id: "clot_small", label: "Koagel <2 cm", score: 1 },
  { id: "clot_large", label: "Koagel ≥2 cm", score: 5 },
] as const;

const PBAC_ITEMS = [...PBAC_PRODUCT_ITEMS, ...PBAC_CLOT_ITEMS] as const;

type PbacCounts = Record<(typeof PBAC_ITEMS)[number]["id"], number>;

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

const PBAC_DEFAULT_COUNTS = PBAC_ITEMS.reduce<PbacCounts>((acc, item) => {
  acc[item.id] = 0;
  return acc;
}, {} as PbacCounts);

type TrackableDailyCategoryId = "pain" | "symptoms" | "bleeding" | "medication" | "sleep" | "bowelBladder";

const TRACKED_DAILY_CATEGORY_IDS: TrackableDailyCategoryId[] = [
  "pain",
  "symptoms",
  "bleeding",
  "medication",
  "sleep",
  "bowelBladder",
];

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
  const sortedKeys = Object.keys(counts).sort();
  return sortedKeys.reduce((acc, key) => {
    acc[key as keyof PbacCounts] = counts[key as keyof PbacCounts];
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
      return {
        entry: {
          bleeding: {
            isBleeding: Boolean(entry.bleeding?.isBleeding),
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
          meds: (entry.meds ?? []).map((med) => ({
            name: med.name,
            doseMg: typeof med.doseMg === "number" ? med.doseMg : null,
            times: [...(med.times ?? [])],
          })),
          rescueDosesCount:
            typeof entry.rescueDosesCount === "number" ? entry.rescueDosesCount : null,
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
            meds?: DailyEntry["meds"];
            rescueDosesCount?: number | null;
          }
        | undefined;
      if (data?.meds) {
        nextEntry.meds = data.meds.map((med) => ({
          name: med.name,
          doseMg: typeof med.doseMg === "number" ? med.doseMg : undefined,
          times: [...(med.times ?? [])],
        }));
      }
      if (data) {
        nextEntry.rescueDosesCount =
          typeof data.rescueDosesCount === "number" ? data.rescueDosesCount : undefined;
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
              ? { bristolType: bristolType as DailyEntry["gi"]["bristolType"] }
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
  }

  if (snapshot.featureFlags && categoryId !== "symptoms" && categoryId !== "bowelBladder") {
    Object.entries(snapshot.featureFlags).forEach(([key, value]) => {
      nextFeatureFlags[key as keyof FeatureFlags] = Boolean(value);
    });
  }

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
  pbacScore: number | null;
  isBleeding: boolean;
  ovulationPositive: boolean;
  ovulationPainIntensity: number | null;
};

type CycleOverviewData = {
  startDate: string;
  points: CycleOverviewPoint[];
};

const CYCLE_OVERVIEW_MAX_DAYS = 30;

const formatShortGermanDate = (iso: string) => {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  return parsed.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
};

const describeBleedingLevel = (point: CycleOverviewPoint) => {
  if (!point.isBleeding) {
    return { label: "keine Blutung", value: 0 };
  }
  const score = point.pbacScore ?? 0;
  if (score >= 100) {
    return { label: "starke Blutung", value: 9 };
  }
  if (score >= 50) {
    return { label: "mittlere Blutung", value: 7 };
  }
  if (score > 0) {
    return { label: "leichte Blutung", value: 5 };
  }
  return { label: "Blutung ohne PBAC", value: 3 };
};

type CycleOverviewChartPoint = CycleOverviewPoint & {
  bleedingLabel: string;
  bleedingValue: number;
  cycleDayLabel: string;
  cycleDayValue: number | null;
  dateLabel: string;
  painValue: number;
  isCurrentDay: boolean;
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
      <circle cx={cx} cy={cy} r={4} fill="#be123c" stroke="#fff" strokeWidth={2} />
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

const CycleOverviewMiniChart = ({ data }: { data: CycleOverviewData }) => {
  const bleedingGradientId = useId();
  const todayIso = useMemo(() => formatDate(new Date()), []);
  const chartPoints = useMemo<CycleOverviewChartPoint[]>(() => {
    return data.points.slice(0, CYCLE_OVERVIEW_MAX_DAYS).map((point) => {
      const bleeding = describeBleedingLevel(point);
      const painValue = Number.isFinite(point.painNRS)
        ? Math.max(0, Math.min(10, Number(point.painNRS)))
        : 0;

      return {
        ...point,
        bleedingLabel: bleeding.label,
        bleedingValue: bleeding.value,
        cycleDayLabel: point.cycleDay ? `ZT ${point.cycleDay}` : "ZT –",
        cycleDayValue: point.cycleDay ?? null,
        dateLabel: formatShortGermanDate(point.date),
        painValue,
        isCurrentDay: point.date === todayIso,
      };
    });
  }, [data.points, todayIso]);

  const renderTooltip = useCallback(
    (props: TooltipProps<number, string>) => {
      if (!props.active || !props.payload?.length) {
        return null;
      }

      const payload = props.payload[0].payload as CycleOverviewChartPoint;

      return (
        <div className="rounded-lg border border-rose-100 bg-white p-3 text-xs text-rose-700 shadow-sm">
          <p className="font-semibold text-rose-900">{payload.dateLabel}</p>
          <p className="mt-1">ZT {payload.cycleDay ?? "–"}</p>
          <p>Schmerz: {payload.painNRS}/10</p>
          <p>Blutung: {payload.bleedingLabel}</p>
          {payload.pbacScore !== null ? <p>PBAC: {payload.pbacScore}</p> : null}
          {payload.ovulationPositive ? <p>Eisprung markiert</p> : null}
        </div>
      );
    },
    []
  );

  if (!chartPoints.length) {
    return null;
  }

  return (
    <section aria-label="Aktueller Zyklus">
      <div className="mx-auto h-36 w-[80vw] max-w-full sm:h-44">
        <ResponsiveContainer>
          <ComposedChart data={chartPoints} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={bleedingGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#fbcfe8" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="cycleDayValue"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#fb7185", fontSize: 12, fontWeight: 600 }}
              tickFormatter={(value: number | null) =>
                typeof value === "number" && Number.isFinite(value) ? `ZT ${value}` : ""
              }
              minTickGap={6}
            />
            <YAxis domain={[0, 10]} hide />
            <Tooltip
              cursor={{ stroke: "#fb7185", strokeOpacity: 0.2, strokeWidth: 1 }}
              content={renderTooltip}
            />
            <Area
              type="monotone"
              dataKey="bleedingValue"
              fill={`url(#${bleedingGradientId})`}
              stroke="#fb7185"
              strokeWidth={1}
              fillOpacity={1}
              name="Blutung"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="painValue"
              stroke="#be123c"
              strokeWidth={2}
              dot={<PainDot />}
              activeDot={{ r: 5, stroke: "#be123c", fill: "#fff", strokeWidth: 2 }}
              name="Schmerz"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
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

  bleeding: { isBleeding: false },
  symptoms: {},
  meds: [],
  ovulation: {},
});

const createEmptyMonthlyEntry = (month: string): MonthlyEntry => ({
  month,
  qol: {},
  mental: {},
  promis: {},
});

const SectionScopeContext = createContext<string | number | null>(null);

type SectionCompletionState = Record<string, Record<string, boolean>>;
type SectionRegistryState = Record<string, Record<string, true>>;

type SectionCompletionContextValue = {
  getCompletion: (scope: string | number | null, key: string) => boolean;
  setCompletion: (scope: string | number | null, key: string, completed: boolean) => void;
  registerSection: (scope: string | number | null, key: string) => void;
  unregisterSection: (scope: string | number | null, key: string) => void;
};

const SectionCompletionContext = createContext<SectionCompletionContextValue | null>(null);

function Section({
  title,
  description,
  aside,
  children,
  completionEnabled = true,
  variant = "card",
  onComplete,
  hideHeader = false,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
  completionEnabled?: boolean;
  variant?: "card" | "plain";
  onComplete?: () => void;
  hideHeader?: boolean;
}) {
  const scope = useContext(SectionScopeContext);
  const completionContext = useContext(SectionCompletionContext);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiPieces = useMemo(
    () =>
      CONFETTI_PIECES.map((piece, index) => ({
        ...piece,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      })),
    []
  );

  const completedFromContext = useMemo(() => {
    if (!completionEnabled) return false;
    if (!completionContext) return false;
    if (scope === null || scope === undefined) return false;
    return completionContext.getCompletion(scope, title);
  }, [completionContext, completionEnabled, scope, title]);

  useEffect(() => {
    if (!completionEnabled) return;
    if (!completionContext) return;
    if (scope === null || scope === undefined) return;
    completionContext.registerSection(scope, title);
    return () => {
      completionContext.unregisterSection(scope, title);
    };
  }, [completionContext, completionEnabled, scope, title]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const cancelTimeout = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    if (!completionEnabled) {
      cancelTimeout();
      setIsCompleted(false);
      setShowConfetti(false);
      return;
    }

    if (!completedFromContext) {
      cancelTimeout();
      setIsCompleted(false);
      setShowConfetti(false);
      return;
    }

    setIsCompleted(true);
  }, [completedFromContext, completionEnabled]);

  const handleComplete = () => {
    if (!completionEnabled || isCompleted || showConfetti) return;
    setIsCompleted(true);
    if (completionContext && scope !== null && scope !== undefined) {
      completionContext.setCompletion(scope, title, true);
    }
    setShowConfetti(true);
    timeoutRef.current = window.setTimeout(() => {
      setShowConfetti(false);
      if (onComplete) {
        onComplete();
      }
      timeoutRef.current = null;
    }, 400);
  };

  return (
    <section
      ref={cardRef}
      data-section-card
      data-section-completed={isCompleted ? "true" : "false"}
      className={cn(
        "relative",
        variant === "card"
          ? "space-y-4 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm transition-colors sm:p-6"
          : "space-y-4 sm:space-y-5",
        variant === "card" && isCompleted ? "border-amber-200 shadow-md" : null
      )}
    >
      {!hideHeader ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-rose-900">{title}</h2>
            {description && <p className="text-sm text-rose-600">{description}</p>}
          </div>
          {aside ? <div className="flex-shrink-0 sm:self-start">{aside}</div> : null}
        </div>
      ) : null}
      <div className="space-y-4">
        {children}
        {completionEnabled ? (
          <div className="flex justify-end pt-2">
            <div className="relative inline-flex">
              {completionEnabled && showConfetti ? (
                <div className="pointer-events-none absolute -inset-x-4 -inset-y-3 overflow-visible">
                  {confettiPieces.map((piece, index) => (
                    <span
                      key={index}
                      className="confetti-piece absolute h-3 w-3 rounded-sm"
                      style={{
                        left: piece.left,
                        top: piece.top,
                        backgroundColor: piece.color,
                        animationDelay: `${piece.delay}ms`,
                      }}
                    />
                  ))}
                </div>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className={cn(isCompleted ? "cursor-default" : "")}
                onClick={handleComplete}
                disabled={isCompleted}
              >
                {isCompleted ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Erledigt
                  </span>
                ) : (
                  "Fertig"
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TermField({ termKey, htmlFor, children }: { termKey: TermKey; htmlFor?: string; children: ReactNode }) {
  const term: TermDescriptor = TERMS[termKey];
  const meta = term.optional ? (
    <Badge className="bg-amber-100 text-amber-800">
      {term.deviceNeeded ? `Optional (Hilfsmittel nötig: ${term.deviceNeeded})` : "Optional"}
    </Badge>
  ) : null;
  return (
    <Labeled label={term.label} tech={term.tech} help={term.help} htmlFor={htmlFor} meta={meta}>
      {children}
    </Labeled>
  );
}

function TermHeadline({ termKey }: { termKey: TermKey }) {
  const term: TermDescriptor = TERMS[termKey];
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-rose-900">
      <span>{term.label}</span>
      {term.optional ? (
        <Badge className="bg-amber-100 text-amber-800">
          {term.deviceNeeded ? `Optional (Hilfsmittel nötig: ${term.deviceNeeded})` : "Optional"}
        </Badge>
      ) : null}
      {term.help ? <InfoTip tech={term.tech ?? term.label} help={term.help} /> : null}
    </div>
  );
}

function ScoreInput({
  id,
  label,
  termKey,
  tech,
  help,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  disabled = false,
}: {
  id: string;
  label: string;
  termKey?: TermKey;
  tech?: string;
  help?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  const rangeDescriptionId = `${id}-range-hint`;
  const content = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
      <div className="flex flex-1 flex-col gap-1">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={([v]) => {
            if (!disabled) {
              onChange(v);
            }
          }}
          id={id}
          aria-describedby={rangeDescriptionId}
          disabled={disabled}
        />
        <div
          id={rangeDescriptionId}
          className="flex justify-between text-xs text-rose-600"
        >
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
      <SliderValueDisplay value={value} className="sm:self-stretch" />
    </div>
  );
  if (termKey) {
    return (
      <TermField termKey={termKey} htmlFor={id}>
        {content}
      </TermField>
    );
  }
  return (
    <Labeled label={label} tech={tech} help={help} htmlFor={id}>
      {content}
    </Labeled>
  );
}

function MultiSelectChips({
  options,
  value,
  onToggle,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onToggle: (next: string[]) => void;
}) {
  const toggle = (option: string) => {
    const set = new Set(value);
    if (set.has(option)) {
      set.delete(option);
    } else {
      set.add(option);
    }
    onToggle(Array.from(set));
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => toggle(option.value)}
          aria-pressed={value.includes(option.value)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2",
            value.includes(option.value)
              ? "border-rose-500 bg-rose-500 text-white shadow-sm"
              : "border-rose-200 bg-white text-rose-700 hover:border-rose-400 hover:bg-rose-50"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const MODULE_TERMS: ModuleTerms = {
  urinaryOpt: TERMS.urinaryOpt,
  headacheOpt: TERMS.headacheOpt,
  dizzinessOpt: TERMS.dizzinessOpt,
};

const CONFETTI_COLORS = ["#fb7185", "#f97316", "#facc15", "#4ade80", "#38bdf8"] as const;

const CONFETTI_VERTICAL_POSITIONS = ["20%", "50%", "80%"] as const;

const CONFETTI_PIECES = Array.from({ length: 8 }, (_, index) => ({
  left: `${5 + index * 12}%`,
  top: CONFETTI_VERTICAL_POSITIONS[index % CONFETTI_VERTICAL_POSITIONS.length],
  delay: index * 30,
}));

const SYMPTOM_MODULE_TOGGLES: Array<{
  key: keyof FeatureFlags;
  label: string;
  term: TermDescriptor;
}> = [{ key: "moduleDizziness", label: "Schwindel", term: MODULE_TERMS.dizzinessOpt.present }];

function ModuleToggleRow({
  label,
  tech,
  help,
  checked,
  onCheckedChange,
  className,
}: {
  label: string;
  tech?: string;
  help: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-rose-100 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-rose-900">
        <span>{label}</span>
        <InfoTip tech={tech ?? label} help={help} />
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function NrsInput({ id, value, onChange }: { id: string; value: number; onChange: (value: number) => void }) {
  const rangeDescriptionId = `${id}-nrs-range`;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
      <div className="flex flex-1 flex-col gap-1">
        <Slider
          id={id}
          value={[value]}
          min={0}
          max={10}
          step={1}
          aria-describedby={rangeDescriptionId}
          onValueChange={([next]) => onChange(Math.max(0, Math.min(10, Math.round(next))))}
        />
        <div id={rangeDescriptionId} className="flex justify-between text-xs text-rose-600">
          <span>0 Kein Schmerz</span>
          <span>10 Stärkster Schmerz</span>
        </div>
      </div>
      <SliderValueDisplay value={value} className="sm:self-stretch" />
    </div>
  );
}

function NumberField({
  id,
  value,
  min = 0,
  onChange,
}: {
  id: string;
  value: number | undefined;
  min?: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <Input
      id={id}
      type="number"
      min={min}
      value={value ?? ""}
      onChange={(event) => {
        if (event.target.value === "") {
          onChange(undefined);
          return;
        }
        const parsed = Number(event.target.value);
        if (Number.isNaN(parsed)) {
          onChange(undefined);
          return;
        }
        onChange(Math.max(min, Math.round(parsed)));
      }}
    />
  );
}

function InlineNotice({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
      <p className="font-semibold text-amber-900">{title}</p>
      <p className="mt-1 text-amber-700">{text}</p>
    </div>
  );
}

function normalizeImportedDailyEntry(entry: DailyEntry & Record<string, unknown>): DailyEntry {
  const clone: DailyEntry = { ...entry };
  const extra = clone as unknown as Record<string, unknown>;

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

  if (clone.impactNRS === undefined || clone.impactNRS === null) {
    if (typeof clone.painNRS === "number") {
      clone.impactNRS = clone.painNRS;
    }
  }

  return applyAutomatedPainSymptoms(clone);
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

function BodyMap({
  value,
  onChange,
  renderRegionCard,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  renderRegionCard: (regionId: string) => ReactNode;
}) {
  return (
    <div className="space-y-3">
      {BODY_REGION_GROUPS.map((group) => {
        const selectedCount = group.regions.filter((region) => value.includes(region.id)).length;
        return (
          <details
            key={group.id}
            id={`body-map-group-${group.id}`}
            className="group rounded-lg border border-rose-100 bg-rose-50 text-rose-700 [&[open]>summary]:border-b [&[open]>summary]:bg-rose-100"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-rose-800 [&::-webkit-details-marker]:hidden">
              <span>{group.label}</span>
              <span className="text-xs font-normal text-rose-500">
                {selectedCount > 0 ? `${selectedCount} ausgewählt` : "Auswählen"}
              </span>
            </summary>
            <div className="border-t border-rose-100 bg-white px-3 py-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.regions.map((region) => {
                  const isSelected = value.includes(region.id);
                  return (
                    <button
                      key={region.id}
                      type="button"
                      onClick={() => {
                        const set = new Set(value);
                        if (set.has(region.id)) {
                          set.delete(region.id);
                        } else {
                          set.add(region.id);
                        }
                        onChange(Array.from(set));
                      }}
                      className={cn(
                        "w-full rounded-md border px-3 py-2 text-left text-sm transition",
                        isSelected
                          ? "border-rose-400 bg-rose-100 text-rose-700"
                          : "border-rose-100 bg-white text-rose-600 hover:border-rose-300 hover:bg-rose-50"
                      )}
                    >
                      {region.label}
                    </button>
                  );
                })}
              </div>
              {(() => {
                const cards = group.regions
                  .filter((region) => value.includes(region.id))
                  .map((region) => ({ id: region.id, node: renderRegionCard(region.id) }))
                  .filter((entry): entry is { id: string; node: ReactNode } => Boolean(entry.node));
                if (cards.length === 0) {
                  return null;
                }
                return (
                  <div className="mt-3 space-y-3">
                    {cards.map((entry) => (
                      <div key={entry.id}>{entry.node}</div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </details>
        );
      })}
    </div>
  );
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

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as {
    date: string;
    cycleDay: number | null;
    weekday: string;
    pain: number;
    pbac: number | null;
    symptomAverage: number | null;
    sleepQuality: number | null;
  };
  return (
    <div className="rounded-lg border border-rose-200 bg-white p-3 text-xs text-rose-700 shadow-sm">
      <p className="font-semibold text-rose-800">{data.date}</p>
      <p>Zyklustag: {data.cycleDay ?? "–"}</p>
      <p>Wochentag: {data.weekday}</p>
      <p>{TERMS.nrs.label}: {data.pain}</p>
      <p>{TERMS.pbac.label}: {data.pbac ?? "–"}</p>
      <p>Symptom-Schnitt: {data.symptomAverage?.toFixed(1) ?? "–"}</p>
      <p>{TERMS.sleep_quality.label}: {data.sleepQuality ?? "–"}</p>
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

function dateToIsoWeek(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNr);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function monthToDate(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

function parseIsoWeekKey(isoWeek: string): { year: number; week: number } | null {
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week)) return null;
  return { year, week };
}

function formatIsoWeekCompactLabel(isoWeek: string | null): string | null {
  if (!isoWeek) return null;
  const parts = parseIsoWeekKey(isoWeek);
  if (!parts) return null;
  const start = isoWeekToDate(parts.year, parts.week);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const startLabel = start.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  const endLabel = end.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return `KW ${String(parts.week).padStart(2, "0")} · ${startLabel}–${endLabel}`;
}

function computePearson(pairs: { x: number; y: number }[]) {
  if (pairs.length < 2) return null;
  const n = pairs.length;
  const sumX = pairs.reduce((sum, pair) => sum + pair.x, 0);
  const sumY = pairs.reduce((sum, pair) => sum + pair.y, 0);
  const sumX2 = pairs.reduce((sum, pair) => sum + pair.x * pair.x, 0);
  const sumY2 = pairs.reduce((sum, pair) => sum + pair.y * pair.y, 0);
  const sumXY = pairs.reduce((sum, pair) => sum + pair.x * pair.y, 0);
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  if (!denominator) return null;
  return numerator / denominator;
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
  const derivedDailyEntries = useMemo(
    () => dailyEntries.map((entry) => applyAutomatedPainSymptoms(entry)),
    [dailyEntries]
  );
  const [sectionCompletionState, setSectionCompletionState, sectionCompletionStorage] =
    usePersistentState<SectionCompletionState>("endo.sectionCompletion.v1", {});
  const [sectionRegistry, setSectionRegistry] = useState<SectionRegistryState>({});

  const [dailyDraft, setDailyDraft, dailyDraftStorage] =
    usePersistentState<DailyEntry>("endo.draft.daily.v1", defaultDailyDraft);
  const [lastSavedDailySnapshot, setLastSavedDailySnapshot] = useState<DailyEntry>(() => createEmptyDailyEntry(today));
  const [pbacCounts, setPbacCounts] = useState<PbacCounts>({ ...PBAC_DEFAULT_COUNTS });
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
  const [trendXAxisMode, setTrendXAxisMode] = useState<"date" | "cycleDay">("date");
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
  const previousDailyCategoryCompletionRef = useRef<Record<TrackableDailyCategoryId, boolean>>({});

  const isBirthdayGreetingDay = () => {
    const now = new Date();
    return now.getFullYear() === 2025 && now.getMonth() === 10 && now.getDate() === 10;
  };
  const [showBirthdayGreeting, setShowBirthdayGreeting] = useState(isBirthdayGreetingDay);
  const [pendingCategoryConfirm, setPendingCategoryConfirm] =
    useState<TrackableDailyCategoryId | null>(null);
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
  ];
  const storageReady = storageMetas.every((meta) => meta.ready);
  const storageErrors = storageMetas.map((meta) => meta.error).filter(Boolean) as string[];
  const storageDrivers = Array.from(new Set(storageMetas.map((meta) => meta.driverLabel)));
  const usesIndexedDb = storageMetas.every((meta) => meta.driver === "indexeddb");
  const hasMemoryFallback = storageMetas.some((meta) => meta.driver === "memory");
  const storageUnavailable = storageMetas.some((meta) => meta.driver === "unavailable");

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

  const sectionCompletionContextValue = useMemo<SectionCompletionContextValue>(
    () => ({
      getCompletion: (scope, key) => {
        if (scope === null || scope === undefined) return false;
        const scopeKey = String(scope);
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
    [sectionCompletionState, setSectionCompletionState, setSectionRegistry]
  );

  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [detailToolbarHeight, setDetailToolbarHeight] = useState<number>(DETAIL_TOOLBAR_FALLBACK_HEIGHT);
  const [activeView, setActiveView] = useState<"home" | "daily" | "weekly" | "monthly" | "analytics">("home");
  const [dailyActiveCategory, setDailyActiveCategory] = useState<DailyCategoryId>("overview");
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [persistWarning, setPersistWarning] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const isDailyDirty = useMemo(
    () => JSON.stringify(dailyDraft) !== JSON.stringify(lastSavedDailySnapshot),
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

  const selectDailyDate = useCallback(
    (targetDate: string, options?: { manual?: boolean }) => {
      if (options?.manual) {
        manualDailySelectionRef.current = true;
      }
      const existingEntry = derivedDailyEntries.find((entry) => entry.date === targetDate);
      const baseEntry = existingEntry ?? createEmptyDailyEntry(targetDate);
      const clonedEntry =
        typeof structuredClone === "function"
          ? structuredClone(baseEntry)
          : (JSON.parse(JSON.stringify(baseEntry)) as DailyEntry);
      setDailyDraft(clonedEntry);
      setLastSavedDailySnapshot(clonedEntry);
    },
    [derivedDailyEntries, setDailyDraft, setLastSavedDailySnapshot]
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
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [dailyDraft.date]);

  const annotatedDailyEntries = useMemo(() => {
    const sorted = derivedDailyEntries.slice().sort((a, b) => a.date.localeCompare(b.date));
    let cycleDay: number | null = null;
    let previousDate: Date | null = null;
    let previousBleeding = false;
    return sorted.map((entry) => {
      const currentDate = new Date(entry.date);
      const diffDays = previousDate
        ? Math.round((currentDate.getTime() - previousDate.getTime()) / 86_400_000)
        : 0;
      if (cycleDay !== null && diffDays > 0) {
        cycleDay += diffDays;
      }
      const isBleeding = entry.bleeding.isBleeding;
      const bleedingStartsToday = isBleeding && (!previousBleeding || diffDays > 1 || cycleDay === null);
      if (bleedingStartsToday) {
        cycleDay = 1;
      }
      const assignedCycleDay = cycleDay;
      const weekday = currentDate.toLocaleDateString("de-DE", { weekday: "short" });
      const symptomScores = Object.values(entry.symptoms ?? {}).flatMap((symptom) => {
        if (!symptom || !symptom.present) return [] as number[];
        return typeof symptom.score === "number" ? [symptom.score] : [];
      });
      const symptomAverage = symptomScores.length
        ? symptomScores.reduce((sum, value) => sum + value, 0) / symptomScores.length
        : null;
      previousDate = currentDate;
      previousBleeding = isBleeding;
      return { entry, cycleDay: assignedCycleDay, weekday, symptomAverage };
    });
  }, [derivedDailyEntries]);

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
    let cycleDay: number | null = null;
    let previousDate: Date | null = null;
    let previousBleeding = false;
    for (const entry of sorted) {
      const currentDate = new Date(entry.date);
      if (Number.isNaN(currentDate.getTime())) {
        continue;
      }
      const diffDays = previousDate
        ? Math.round((currentDate.getTime() - previousDate.getTime()) / 86_400_000)
        : 0;
      if (cycleDay !== null && diffDays > 0) {
        cycleDay += diffDays;
      }
      const isBleeding = entry.bleeding.isBleeding;
      const bleedingStartsToday = isBleeding && (!previousBleeding || diffDays > 1 || cycleDay === null);
      if (bleedingStartsToday) {
        cycleDay = 1;
      }
      if (entry.date === dailyDraft.date) {
        return cycleDay;
      }
      previousDate = currentDate;
      previousBleeding = isBleeding;
    }
    return cycleDay;
  }, [derivedDailyEntries, dailyDraft, isDailyDirty]);

  const cycleOverview = useMemo((): CycleOverviewData | null => {
    if (!annotatedDailyEntries.length) {
      return null;
    }

    const enriched: CycleOverviewPoint[] = annotatedDailyEntries.map(({ entry, cycleDay }) => ({
      date: entry.date,
      cycleDay: cycleDay ?? null,
      painNRS: entry.painNRS ?? 0,
      pbacScore: entry.bleeding?.pbacScore ?? null,
      isBleeding: entry.bleeding?.isBleeding ?? false,
      ovulationPositive: Boolean(entry.ovulation?.lhPositive || entry.ovulationPain?.intensity),
      ovulationPainIntensity: entry.ovulationPain?.intensity ?? null,
    }));

    const latestStartIndex = enriched.reduce((acc, point, index) => {
      if (point.cycleDay === 1 && point.date <= today) {
        return index;
      }
      return acc;
    }, -1);

    if (latestStartIndex === -1) {
      return null;
    }

    let slice = enriched
      .slice(latestStartIndex, latestStartIndex + CYCLE_OVERVIEW_MAX_DAYS)
      .filter((point) => point.date <= today);
    if (!slice.length) {
      slice = [enriched[latestStartIndex]];
    }

    return {
      startDate: enriched[latestStartIndex].date,
      points: slice,
    };
  }, [annotatedDailyEntries, today]);

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

  const selectedMonthLabel = useMemo(() => {
    const monthDate = monthToDate(monthlyDraft.month);
    if (!monthDate) return null;
    return monthDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  }, [monthlyDraft.month]);

  const dailyToolbarLabel = useMemo(() => {
    const parsed = parseIsoDate(dailyDraft.date);
    const dateLabel = parsed
      ? parsed.toLocaleDateString("de-DE", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
        })
      : null;
    const categoryLabels: Record<DailyCategoryId, string> = {
      overview: "Check-in Übersicht",
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
    if (baseLabel && dateLabel) {
      return `${baseLabel} · ${dateLabel}`;
    }
    return baseLabel ?? dateLabel;
  }, [dailyActiveCategory, dailyDraft.date]);

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

  const activeScopeKey = useMemo(() => {
    if (activeView === "daily") {
      return dailyDraft.date ? `daily:${dailyDraft.date}` : null;
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
  }, [activeView, currentMonth, dailyDraft.date, monthlyDraft.month, weeklyScopeIsoWeek]);

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

  const goToPreviousDay = useCallback(() => {
    const base = parseIsoDate(dailyDraft.date || today);
    if (!base) return;
    base.setDate(base.getDate() - 1);
    selectDailyDate(formatDate(base), { manual: true });
  }, [dailyDraft.date, selectDailyDate, today]);

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
    selectDailyDate(nextDate, { manual: true });
  }, [dailyDraft.date, selectDailyDate, today]);

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

  const pbacFlooding = dailyDraft.bleeding.flooding ?? false;
  const pbacScore = useMemo(() => computePbacScore(pbacCounts, pbacFlooding), [pbacCounts, pbacFlooding]);
  const currentPbacForNotice = dailyDraft.bleeding.isBleeding ? pbacScore : dailyDraft.bleeding.pbacScore ?? 0;
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
    if (!dailyDraft.bleeding.isBleeding) {
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
  }, [dailyDraft.bleeding.isBleeding, pbacScore, setDailyDraft]);

  useEffect(() => {
    const existingEntry = derivedDailyEntries.find((entry) => entry.date === dailyDraft.date);
    if (!existingEntry) return;
    const serializedExisting = JSON.stringify(existingEntry);
    if (serializedExisting === JSON.stringify(lastSavedDailySnapshot)) {
      return;
    }
    if (serializedExisting === JSON.stringify(dailyDraft)) {
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

  const updatePainRegionsFromSelection = useCallback(
    (selectedIds: string[]) => {
      setDailyDraft((prev) => {
        const existing = prev.painRegions ?? [];
        const nextList: NonNullable<DailyEntry["painRegions"]> = [];

        selectedIds.forEach((id) => {
          const found = existing.find((region) => region.regionId === id);
          if (found) {
            nextList.push(found);
          } else {
            nextList.push({ regionId: id, nrs: 0, qualities: [] });
          }
        });

        return buildDailyDraftWithPainRegions(prev, nextList);
      });
    },
    [setDailyDraft]
  );

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

  const focusPainRegion = useCallback((regionId: string) => {
    if (typeof document === "undefined") return;
    const groupId = REGION_TO_GROUP_ID[regionId];
    if (groupId) {
      const groupElement = document.getElementById(`body-map-group-${groupId}`) as HTMLDetailsElement | null;
      if (groupElement) {
        groupElement.open = true;
      }
    }
    const target = document.getElementById(`body-map-region-${regionId}`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      try {
        target.focus({ preventScroll: true });
      } catch (_error) {
        target.focus();
      }
    }
  }, []);

  const handleDailySubmit = () => {
    const payload: DailyEntry = {
      ...dailyDraft,
      painQuality: dailyDraft.painQuality,
      bleeding: dailyDraft.bleeding.isBleeding
        ? {
            isBleeding: true,
            pbacScore,
            clots: dailyDraft.bleeding.clots ?? false,
            flooding: dailyDraft.bleeding.flooding ?? false,
          }
        : { isBleeding: false },
      meds: dailyDraft.meds.filter((med) => med.name.trim().length > 0),
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

    if (typeof syncedDraft.impactNRS === "number") {
      syncedDraft.painNRS = syncedDraft.impactNRS;
    }

    const automatedDraft = applyAutomatedPainSymptoms(syncedDraft);

    const validationIssues = validateDailyEntry(automatedDraft);
    setIssues(validationIssues);
    if (validationIssues.length) {
      setInfoMessage("Bitte prüfe die markierten Felder.");
      return;
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
    setActiveView("home");
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
          if (normalizedDaily.some((entry) => validateDailyEntry(entry).length > 0)) {
            throw new Error("invalid");
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
        } catch {
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
      const maxPbac = dailyFiltered.reduce((max, entry) => Math.max(max, entry.bleeding.pbacScore ?? 0), 0);
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

  const showWeeklyReminderBadge =
    storageReady && weeklyReportsReady && isSunday && !hasWeeklyReportForCurrentWeek;
  const showMonthlyReminderBadge =
    storageReady && isMonthlyReminderDue && !hasMonthlyEntryForCurrentMonth;

  const weeklyBannerText = isSunday
    ? "Es ist Sonntag. Zeit für deinen wöchentlichen Check In."
    : "Fülle diese Fragen möglichst jeden Sonntag aus.";

  const trendWindowStartIso = useMemo(() => {
    if (!todayDate) {
      return null;
    }
    const threshold = new Date(todayDate);
    threshold.setDate(threshold.getDate() - 30);
    return formatDate(threshold);
  }, [todayDate]);

  const { painTrendData, painTrendCycleStarts } = useMemo(() => {
    const thresholdIso = trendWindowStartIso;
    const filteredEntries = thresholdIso
      ? annotatedDailyEntries.filter(({ entry }) => entry.date >= thresholdIso)
      : annotatedDailyEntries;
    const effectiveEntries = filteredEntries.length > 0 ? filteredEntries : annotatedDailyEntries;
    const mapped = effectiveEntries.map(({ entry, cycleDay, weekday, symptomAverage }) => ({
      date: entry.date,
      cycleDay,
      cycleLabel: cycleDay ? `ZT ${cycleDay}` : "–",
      weekday,
      pain: entry.painNRS,
      pbac: entry.bleeding.pbacScore ?? null,
      symptomAverage,
      sleepQuality: entry.sleep?.quality ?? null,
    }));
    return {
      painTrendData: mapped,
      painTrendCycleStarts: mapped.filter((item) => item.cycleDay === 1),
    };
  }, [annotatedDailyEntries, trendWindowStartIso]);

  const renderIssuesForPath = (path: string) =>
    issues.filter((issue) => issue.path === path).map((issue) => (
      <p key={issue.message} className="text-xs text-rose-600">
        {issue.message}
      </p>
    ));

  const renderPainRegionCard = (regionId: string) => {
    const regions = dailyDraft.painRegions ?? [];
    const regionIndex = regions.findIndex((region) => region.regionId === regionId);
    if (regionIndex === -1) {
      return null;
    }
    const region = regions[regionIndex];
    const qualityChoices = region.regionId === HEAD_REGION_ID ? HEAD_PAIN_QUALITIES : PAIN_QUALITIES;
    return (
      <div
        id={`body-map-region-${region.regionId}`}
        tabIndex={-1}
        className="space-y-3 rounded-lg border border-rose-100 bg-white p-4"
      >
        <p className="font-medium text-rose-800">Schmerzen in: {getRegionLabel(region.regionId)}</p>
        {renderIssuesForPath(`painRegions[${regionIndex}].regionId`)}
        <div className="space-y-2">
          <Label className="text-xs text-rose-600" htmlFor={`region-nrs-${region.regionId}`}>
            Intensität (0–10)
          </Label>
          <NrsInput
            id={`region-nrs-${region.regionId}`}
            value={region.nrs}
            onChange={(value) => {
              setDailyDraft((prev) => {
                const nextRegions = (prev.painRegions ?? []).map((r) =>
                  r.regionId === region.regionId
                    ? {
                        ...r,
                        nrs: Math.max(0, Math.min(10, Math.round(value))),
                      }
                    : r
                ) as NonNullable<DailyEntry["painRegions"]>;
                return buildDailyDraftWithPainRegions(prev, nextRegions);
              });
            }}
          />
          {renderIssuesForPath(`painRegions[${regionIndex}].nrs`)}
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-rose-600">Schmerzcharakter in dieser Region</Label>
          <MultiSelectChips
            options={qualityChoices.map((quality) => ({ value: quality, label: quality }))}
            value={region.qualities}
            onToggle={(next) => {
              setDailyDraft((prev) => {
                const updatedQualities =
                  region.regionId === HEAD_REGION_ID
                    ? sanitizeHeadRegionQualities(next as DailyEntry["painQuality"])
                    : (next as DailyEntry["painQuality"]);
                const nextRegions = (prev.painRegions ?? []).map((r) =>
                  r.regionId === region.regionId
                    ? {
                        ...r,
                        qualities: updatedQualities,
                      }
                    : r
                ) as NonNullable<DailyEntry["painRegions"]>;
                return buildDailyDraftWithPainRegions(prev, nextRegions);
              });
            }}
          />
          {renderIssuesForPath(`painRegions[${regionIndex}].qualities`)}
          {(region.qualities ?? []).map((_, qualityIndex) =>
            renderIssuesForPath(`painRegions[${regionIndex}].qualities[${qualityIndex}]`)
          )}
        </div>
      </div>
    );
  };

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
      if (typeof entry.bleeding.pbacScore === "number") {
        current.pbacSum += entry.bleeding.pbacScore;
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
    const todayEntry = annotatedDailyEntries.find(({ entry }) => entry.date === today);
    return todayEntry?.cycleDay ?? null;
  }, [annotatedDailyEntries, today]);

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

  const weekdayOverlay = useMemo(() => {
    const order = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    const bucket = new Map<string, { painSum: number; count: number }>();
    annotatedDailyEntries.forEach(({ entry, weekday }) => {
      if (!weekday) return;
      const current = bucket.get(weekday) ?? { painSum: 0, count: 0 };
      current.painSum += entry.painNRS;
      current.count += 1;
      bucket.set(weekday, current);
    });
    return order
      .filter((day) => bucket.has(day))
      .map((day) => {
        const stats = bucket.get(day)!;
        return { weekday: day, painAvg: Number((stats.painSum / stats.count).toFixed(1)) };
      });
  }, [annotatedDailyEntries]);

  const correlations = useMemo(() => {
    const sleepPairs = annotatedDailyEntries
      .map(({ entry }) => ({ x: entry.sleep?.quality, y: entry.painNRS }))
      .filter((pair): pair is { x: number; y: number } => typeof pair.x === "number");
    const stepsPairs = derivedDailyEntries
      .filter((entry) => typeof entry.activity?.steps === "number")
      .map((entry) => ({ x: entry.activity!.steps as number, y: entry.painNRS }));
    return {
      sleep: { r: computePearson(sleepPairs), n: sleepPairs.length },
      steps: { r: computePearson(stepsPairs), n: stepsPairs.length },
    };
  }, [annotatedDailyEntries, derivedDailyEntries]);

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

  const urinaryTrendData = useMemo(() => {
    if (!activeUrinary) return [] as Array<{ date: string; cycleDay: number | null; urgency: number | null }>;
    return annotatedDailyEntries.map(({ entry, cycleDay }) => ({
      date: entry.date,
      cycleDay,
      urgency: typeof entry.urinaryOpt?.urgency === "number" ? entry.urinaryOpt.urgency : null,
    }));
  }, [annotatedDailyEntries, activeUrinary]);

  const urinaryMonthlyRates = useMemo(() => {
    if (!activeUrinary) return [] as Array<{ month: string; leakRate: number }>;
    const bucket = new Map<string, { days: number; leakDays: number }>();
    dailyEntries.forEach((entry) => {
      if (!entry.urinaryOpt) return;
      const month = entry.date.slice(0, 7);
      const stats = bucket.get(month) ?? { days: 0, leakDays: 0 };
      stats.days += 1;
      if ((entry.urinaryOpt.leaksCount ?? 0) > 0) {
        stats.leakDays += 1;
      }
      bucket.set(month, stats);
    });
    return Array.from(bucket.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, stats]) => ({
        month,
        leakRate: stats.days ? Number(((stats.leakDays / stats.days) * 100).toFixed(1)) : 0,
      }));
  }, [dailyEntries, activeUrinary]);

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

  const headacheTrendData = useMemo(() => {
    if (!activeHeadache) return [] as Array<{ date: string; cycleDay: number | null; nrs: number | null }>;
    return annotatedDailyEntries.map(({ entry, cycleDay }) => ({
      date: entry.date,
      cycleDay,
      nrs:
        entry.headacheOpt?.present && typeof entry.headacheOpt.nrs === "number" ? entry.headacheOpt.nrs : null,
    }));
  }, [annotatedDailyEntries, activeHeadache]);

  const headacheMonthlyRates = useMemo(() => {
    if (!activeHeadache) return [] as Array<{ month: string; rate: number }>;
    const bucket = new Map<string, { days: number; headacheDays: number }>();
    dailyEntries.forEach((entry) => {
      if (!entry.headacheOpt) return;
      const month = entry.date.slice(0, 7);
      const stats = bucket.get(month) ?? { days: 0, headacheDays: 0 };
      stats.days += 1;
      if (entry.headacheOpt.present) {
        stats.headacheDays += 1;
      }
      bucket.set(month, stats);
    });
    return Array.from(bucket.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, stats]) => ({
        month,
        rate: stats.days ? Number(((stats.headacheDays / stats.days) * 100).toFixed(1)) : 0,
      }));
  }, [dailyEntries, activeHeadache]);

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

  const dizzinessTrendData = useMemo(() => {
    if (!activeDizziness) return [] as Array<{ date: string; cycleDay: number | null; nrs: number | null }>;
    return annotatedDailyEntries.map(({ entry, cycleDay }) => ({
      date: entry.date,
      cycleDay,
      nrs:
        entry.dizzinessOpt?.present && typeof entry.dizzinessOpt.nrs === "number" ? entry.dizzinessOpt.nrs : null,
    }));
  }, [annotatedDailyEntries, activeDizziness]);

  const dizzinessScatterData = useMemo(() => {
    if (!activeDizziness) return [] as Array<{ date: string; pbac: number; nrs: number }>;
    return dailyEntries
      .filter((entry) => entry.dizzinessOpt?.present && typeof entry.dizzinessOpt.nrs === "number")
      .map((entry) => ({
        date: entry.date,
        pbac: entry.bleeding.pbacScore ?? 0,
        nrs: entry.dizzinessOpt!.nrs!,
      }));
  }, [dailyEntries, activeDizziness]);

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

  const dailyScopeKey = dailyDraft.date ? `daily:${dailyDraft.date}` : null;

  const dailyCategoryCompletionTitles: Partial<
    Record<Exclude<DailyCategoryId, "overview">, string>
  > = useMemo(
    () => ({
      pain: "Schmerzen",
      symptoms: "Typische Endometriose-Symptome",
      bleeding: "Periode und Blutung",
      medication: TERMS.meds.label,
      sleep: "Schlaf",
      bowelBladder: "Darm & Blase",
    }),
    []
  );

  const dailySectionCompletion: Record<string, boolean> = useMemo(
    () => (dailyScopeKey ? sectionCompletionState[dailyScopeKey] ?? {} : {}),
    [dailyScopeKey, sectionCompletionState]
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

  const toggleCategoryCompletion = useCallback(
    (categoryId: Exclude<DailyCategoryId, "overview">) => {
      if (!dailyScopeKey) return;
      const sectionTitle = dailyCategoryCompletionTitles[categoryId];
      if (!sectionTitle) return;
      const isCompleted = dailyCategoryCompletion[categoryId] ?? false;
      sectionCompletionContextValue.setCompletion(dailyScopeKey, sectionTitle, !isCompleted);
    },
    [
      dailyCategoryCompletion,
      dailyCategoryCompletionTitles,
      dailyScopeKey,
      sectionCompletionContextValue,
    ]
  );

  const handleQuickNoPain = useCallback(() => {
    setDailyDraft((prev) => ({
      ...prev,
      painRegions: [],
      painMapRegionIds: [],
      painQuality: [],
      painNRS: 0,
      impactNRS: 0,
    }));
    toggleCategoryCompletion("pain");
  }, [setDailyDraft, toggleCategoryCompletion]);

  const handleQuickNoSymptoms = useCallback(() => {
    setDailyDraft((prev) => {
      const existing = prev.symptoms ?? {};
      const cleared: DailyEntry["symptoms"] = {};
      (Object.keys(existing) as SymptomKey[]).forEach((key) => {
        cleared[key] = { present: false };
      });
      return { ...prev, symptoms: cleared };
    });
    toggleCategoryCompletion("symptoms");
  }, [setDailyDraft, toggleCategoryCompletion]);

  const handleQuickNoBleeding = useCallback(() => {
    setDailyDraft((prev) => ({
      ...prev,
      bleeding: { isBleeding: false },
    }));
    setPbacCounts({ ...PBAC_DEFAULT_COUNTS });
    toggleCategoryCompletion("bleeding");
  }, [setDailyDraft, setPbacCounts, toggleCategoryCompletion]);

  const handleQuickNoMedication = useCallback(() => {
    setDailyDraft((prev) => ({
      ...prev,
      meds: [],
      rescueDosesCount: undefined,
    }));
    toggleCategoryCompletion("medication");
  }, [setDailyDraft, toggleCategoryCompletion]);

  const dailyCategoryButtons = useMemo(
    () =>
      [
        {
          id: "pain" as const,
          title: "Schmerzen",
          description: "Körperkarte, Intensität & Auswirkungen",
          quickActions: [{ label: "Keine Schmerzen", onClick: handleQuickNoPain }],
        },
        {
          id: "symptoms" as const,
          title: "Symptome",
          description: "Typische Endometriose-Symptome dokumentieren",
          quickActions: [{ label: "Keine Symptome", onClick: handleQuickNoSymptoms }],
        },
        {
          id: "bleeding" as const,
          title: "Periode und Blutung",
          description: "Blutung, PBAC-Score & Begleitsymptome",
          quickActions: [{ label: "Keine Periode", onClick: handleQuickNoBleeding }],
        },
        {
          id: "medication" as const,
          title: TERMS.meds.label,
          description: "Eingenommene Medikamente & Hilfen",
          quickActions: [{ label: "Keine Medikamente", onClick: handleQuickNoMedication }],
        },
        { id: "sleep" as const, title: "Schlaf", description: "Dauer, Qualität & Aufwachphasen" },
        {
          id: "bowelBladder" as const,
          title: "Darm & Blase",
          description: "Verdauung & Blase im Blick behalten",
        },
        { id: "notes" as const, title: "Notizen & Tags", description: "Freitextnotizen und Tags ergänzen" },
        {
          id: "optional" as const,
          title: "Optionale Werte",
          description: "Hilfsmittel- & Wearable-Daten erfassen",
        },
      ] satisfies Array<{
        id: Exclude<DailyCategoryId, "overview">;
        title: string;
        description: string;
        quickActions?: Array<{ label: string; onClick: () => void }>;
      }>,
    [handleQuickNoBleeding, handleQuickNoMedication, handleQuickNoPain, handleQuickNoSymptoms]
  );

  useEffect(() => {
    if (previousDailyScopeRef.current === dailyScopeKey) {
      return;
    }
    previousDailyScopeRef.current = dailyScopeKey;
    setDailyCategorySnapshots({});
    setDailyCategoryDirtyState({});
    previousDailyCategoryCompletionRef.current = {} as Record<TrackableDailyCategoryId, boolean>;
  }, [dailyScopeKey]);

  useEffect(() => {
    if (!dailyScopeKey) {
      previousDailyCategoryCompletionRef.current = {} as Record<TrackableDailyCategoryId, boolean>;
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
  }, [dailyCategoryCompletion, dailyDraft, dailyScopeKey, featureFlags, pbacCounts]);

  useEffect(() => {
    if (!dailyScopeKey) {
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
      const currentString = JSON.stringify(currentSnapshot);
      const completed = dailyCategoryCompletion[categoryId] ?? false;
      const wasDirty = Boolean(dailyCategoryDirtyState[categoryId]);
      if (completed) {
        if (currentString !== snapshotString && !wasDirty) {
          const sectionTitle = dailyCategoryCompletionTitles[categoryId];
          if (sectionTitle) {
            sectionCompletionContextValue.setCompletion(dailyScopeKey, sectionTitle, false);
          }
          dirtyUpdates.push([categoryId, true]);
        } else if (currentString === snapshotString && wasDirty) {
          dirtyUpdates.push([categoryId, false]);
        }
      } else {
        const isDirty = currentString !== snapshotString;
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
    dailyScopeKey,
    featureFlags,
    pbacCounts,
    sectionCompletionContextValue,
  ]);

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
    if (dailyScopeKey) {
      const sectionTitle = dailyCategoryCompletionTitles[categoryId];
      if (sectionTitle) {
        sectionCompletionContextValue.setCompletion(dailyScopeKey, sectionTitle, true);
      }
    }
    setPendingCategoryConfirm(null);
    setDailyActiveCategory("overview");
  }, [
    dailyCategoryCompletionTitles,
    dailyDraft,
    dailyScopeKey,
    featureFlags,
    pbacCounts,
    pendingCategoryConfirm,
    sectionCompletionContextValue,
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
    if (dailyScopeKey) {
      const sectionTitle = dailyCategoryCompletionTitles[categoryId];
      if (sectionTitle) {
        sectionCompletionContextValue.setCompletion(dailyScopeKey, sectionTitle, true);
      }
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
    dailyCategoryCompletionTitles,
    dailyCategorySnapshots,
    dailyDraft,
    dailyScopeKey,
    featureFlags,
    pbacCounts,
    pendingCategoryConfirm,
    setDailyDraft,
    setFeatureFlags,
    setPbacCounts,
    sectionCompletionContextValue,
  ]);

  const dailyCategorySummaries = useMemo(
    () => {
      const entry = dailyDraft;
      const summaries: Partial<Record<Exclude<DailyCategoryId, "overview">, string[]>> = {};

      const painRegions = entry.painRegions ?? [];
      const painLines: string[] = [];
      if (painRegions.length) {
        const regionLabels = painRegions.map((region) => getRegionLabel(region.regionId));
        painLines.push(`Bereiche: ${formatList(regionLabels, 3)}`);
        const intensities = painRegions
          .map((region) => (typeof region.nrs === "number" ? region.nrs : null))
          .filter((value): value is number => value !== null);
        if (intensities.length) {
          painLines.push(`Max. Intensität: ${Math.max(...intensities)}/10`);
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
          ovulationParts.push(`Intensität ${rounded}/10`);
        }
        painLines.push(`${TERMS.ovulationPain.label}: ${ovulationParts.join(" · ")}`);
      }
      if (typeof entry.impactNRS === "number" && (painRegions.length || entry.impactNRS > 0)) {
        painLines.push(`Belastung: ${entry.impactNRS}/10`);
      }
      if (!painLines.length) {
        painLines.push("Keine Schmerzen dokumentiert.");
      }
      summaries.pain = painLines;

      const symptomEntries = Object.entries(entry.symptoms ?? {}) as Array<[
        SymptomKey,
        { present?: boolean; score?: number }
      ]>;
      const presentSymptoms = symptomEntries.filter(([, value]) => value?.present);
      const symptomLines: string[] = [];
      if (presentSymptoms.length) {
        const labels = presentSymptoms.map(([key, value]) => {
          const descriptor = SYMPTOM_TERMS[key];
          const label = descriptor?.label ?? key;
          return typeof value?.score === "number" ? `${label} (${value.score}/10)` : label;
        });
        symptomLines.push(`Vorhanden: ${formatList(labels, 3)}`);
      } else {
        symptomLines.push("Keine Symptome markiert.");
      }
      summaries.symptoms = symptomLines;

      const bleedLines: string[] = [];
      if (entry.bleeding?.isBleeding) {
        const pbac = entry.bleeding.pbacScore ?? 0;
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
      const meds = entry.meds ?? [];
      const medNames = meds.map((med) => med.name).filter((name): name is string => Boolean(name));
      if (medNames.length) {
        medicationLines.push(`Regelmäßig: ${formatList(medNames, 3)}`);
      }
      if (typeof entry.rescueDosesCount === "number") {
        medicationLines.push(`Rescue-Dosen: ${entry.rescueDosesCount}`);
      }
      if (!medicationLines.length) {
        medicationLines.push("Keine Medikamente eingetragen.");
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
    [dailyDraft]
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

  const detailToolbar = !isHomeView ? (
    <>
      <header
        ref={detailToolbarRef}
        className="fixed inset-x-0 top-0 z-40 border-b border-rose-100 bg-white/90 shadow-sm backdrop-blur supports-[backdrop-filter:none]:bg-white"
        style={{ backgroundColor: "var(--endo-bg, #fff)" }}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (activeView === "daily" && dailyActiveCategory !== "overview") {
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
                setActiveView("home");
              }}
              className="flex items-center gap-2 text-rose-700 hover:text-rose-800"
            >
              <ChevronLeft className="h-4 w-4" /> Zurück
            </Button>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
              {toolbarLabel ? (
                <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">{toolbarLabel}</span>
              ) : null}
              {showScopeProgressCounter ? (
                <span className="rounded-full bg-rose-200 px-3 py-1 text-rose-800">{`${activeScopeProgress.completed}/${activeScopeProgress.total}`}</span>
              ) : null}
            </div>
          </div>
          {infoMessage ? <p className="text-xs text-rose-600 sm:text-sm">{infoMessage}</p> : null}
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
                <h1 className="text-3xl font-semibold text-rose-900">Endometriose Symptomtracker</h1>
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
                </div>
                {infoMessage && <p className="text-sm font-medium text-rose-600">{infoMessage}</p>}
              </header>
              {cycleOverview ? <CycleOverviewMiniChart data={cycleOverview} /> : null}
              <div className="grid gap-3 sm:grid-cols-3">
                <Button
                  type="button"
                  onClick={() => {
                    setDailyActiveCategory("overview");
                    setActiveView("daily");
                  }}
                  className="h-auto w-full flex-col items-start justify-start gap-2 rounded-2xl bg-rose-600 px-6 py-5 text-left text-white shadow-lg transition hover:bg-rose-500 sm:col-span-3 lg:col-span-2"
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
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <Tabs defaultValue="daily" value={currentDataView} className="w-full">
                <TabsContent value="daily" className="space-y-6">
                  <SectionScopeContext.Provider value={`daily:${dailyDraft.date}`}>
          <Section
            title="Tagescheck-in"
            variant="plain"
            completionEnabled={false}
            hideHeader
          >
            <div className="space-y-6">
              <div className={cn("space-y-6", dailyActiveCategory === "overview" ? "" : "hidden")}>
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
                            <button
                              type="button"
                              onClick={openDailyDatePicker}
                              className="flex flex-1 items-center gap-3 overflow-hidden rounded-xl border border-rose-100 bg-white px-3 py-2 text-left text-sm font-medium text-rose-700 shadow-inner transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                              aria-label="Datum auswählen"
                            >
                              <Calendar className="h-4 w-4 flex-shrink-0 text-rose-400" aria-hidden="true" />
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-semibold text-rose-900 sm:text-base">
                                  {selectedDateLabel ?? "Bitte Datum wählen"}
                                </span>
                                {selectedCycleDay !== null && (
                                  <Badge className="pointer-events-none flex-shrink-0 bg-rose-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                                    ZT {selectedCycleDay}
                                  </Badge>
                                )}
                              </div>
                            </button>
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
                            <Input
                              ref={dailyDateInputRef}
                              type="date"
                              value={dailyDraft.date}
                              onChange={(event) => selectDailyDate(event.target.value, { manual: true })}
                              className="sr-only"
                              max={today}
                              aria-hidden="true"
                              tabIndex={-1}
                            />
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
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-rose-800">Kategorien</p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {dailyCategoryButtons.map((category) => {
                      const isCompleted = dailyCategoryCompletion[category.id] ?? false;
                      const summaryLines = dailyCategorySummaries[category.id] ?? [];
                      return (
                        <div
                          key={category.id}
                          className={cn(
                            "group rounded-2xl border p-4 shadow-sm transition hover:shadow-md",
                            isCompleted
                              ? "border-amber-200 bg-amber-50 hover:border-amber-300"
                              : "border-rose-100 bg-white/80 hover:border-rose-200"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setDailyActiveCategory(category.id)}
                            className="flex w-full items-start justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-rose-900">{category.title}</p>
                              <p className="mt-1 text-xs text-rose-600">{category.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {isCompleted ? (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                  <span className="sr-only">Bereits abgeschlossen</span>
                                </span>
                              ) : null}
                              <ChevronRight className="h-4 w-4 text-rose-400 transition group-hover:text-rose-500" aria-hidden="true" />
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
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    action.onClick();
                                  }}
                                >
                                  {action.label}
                                </Button>
                              ))}
                            </div>
                          ) : null}
                          {isCompleted && summaryLines.length ? (
                            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                              <p className="font-semibold uppercase tracking-wide text-amber-700">Kurzüberblick</p>
                              <ul className="mt-2 space-y-1 text-amber-800">
                                {summaryLines.map((line, index) => (
                                  <li key={index}>{line}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={handleDailySubmit} disabled={!isDailyDirty}>
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
              <div className={cn("space-y-6", dailyActiveCategory === "pain" ? "" : "hidden")}> 
                <Section
                  title="Schmerzen"
                  description="Zuerst betroffene Körperbereiche wählen, anschließend Intensität und Schmerzart je Region erfassen"
                  onComplete={() => setDailyActiveCategory("overview")}
                >
                  <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="space-y-6">
                      <TermField termKey="bodyMap">
                        <BodyMap
                          value={(dailyDraft.painRegions ?? []).map((region) => region.regionId)}
                          onChange={updatePainRegionsFromSelection}
                          renderRegionCard={renderPainRegionCard}
                        />
                        {renderIssuesForPath("painRegions")}
                        {renderIssuesForPath("painMapRegionIds")}
                      </TermField>
                    </div>

                    <div className="space-y-4">
                      <details
                        className="group rounded-lg border border-rose-100 bg-rose-50 text-rose-700 [&[open]>summary]:border-b [&[open]>summary]:bg-rose-100"
                        open={deepDyspareuniaCardOpen}
                        onToggle={(event) => setDeepDyspareuniaCardOpen(event.currentTarget.open)}
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-rose-800 [&::-webkit-details-marker]:hidden">
                          <span>{TERMS.deepDyspareunia.label}</span>
                          <span className="text-xs font-normal text-rose-500">{deepDyspareuniaSummary}</span>
                        </summary>
                        <div className="space-y-3 border-t border-rose-100 bg-white px-3 py-3 text-rose-700">
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
                        className="group rounded-lg border border-rose-100 bg-rose-50 text-rose-700 [&[open]>summary]:border-b [&[open]>summary]:bg-rose-100"
                        open={ovulationPainCardOpen}
                        onToggle={(event) => setOvulationPainCardOpen(event.currentTarget.open)}
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-rose-800 [&::-webkit-details-marker]:hidden">
                          <span>{TERMS.ovulationPain.label}</span>
                          <span className="text-xs font-normal text-rose-500">{ovulationPainSummary}</span>
                        </summary>
                        <div className="space-y-3 border-t border-rose-100 bg-white px-3 py-3 text-rose-700">
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
                          />
                        </div>
                      </TermField>
                      {renderIssuesForPath("impactNRS")}
                    </div>
                  </div>
                </Section>
              </div>

              <div className={cn("space-y-6", dailyActiveCategory === "symptoms" ? "" : "hidden")}> 
                <Section
                  title="Typische Endometriose-Symptome"
                  description="Je Symptom: Ja/Nein plus Stärke auf der 0–10 Skala"
                  onComplete={() => setDailyActiveCategory("overview")}
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
                  </div>
                </Section>
              </div>

              <div className={cn("space-y-6", dailyActiveCategory === "bleeding" ? "" : "hidden")}> 
                <Section
                  title="Periode und Blutung"
                  onComplete={() => setDailyActiveCategory("overview")}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <TermHeadline termKey="bleeding_active" />
                    <Switch
                      checked={dailyDraft.bleeding.isBleeding}
                      onCheckedChange={(checked) => {
                        setDailyDraft((prev) =>
                          checked
                            ? { ...prev, bleeding: { isBleeding: true, clots: false, flooding: false, pbacScore } }
                            : { ...prev, bleeding: { isBleeding: false } }
                        );
                        if (!checked) {
                          setPbacCounts({ ...PBAC_DEFAULT_COUNTS });
                        }
                      }}
                    />
                  </div>
                  {dailyDraft.bleeding.isBleeding && (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        <span>PBAC-Assistent</span>
                        <span>Aktueller Score: {pbacScore}</span>
                      </div>
                      <div className="space-y-4">
                        <TermHeadline termKey="pbac" />
                        <p className="text-sm text-rose-600">
                          Dokumentiere, wie viele Produkte du heute verwendet hast. Alle Angaben lassen sich jederzeit anpassen.
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {PBAC_PRODUCT_ITEMS.map((item) => {
                            const value = pbacCounts[item.id] ?? 0;
                            const max = 12;
                            const sliderId = `${item.id}-slider`;
                            const sliderHintId = `${item.id}-slider-hint`;
                            const sliderWarningId = `${item.id}-slider-warning`;
                            const describedBy = value === max ? `${sliderHintId} ${sliderWarningId}` : sliderHintId;

                            return (
                              <Labeled
                                key={item.id}
                                label={item.label}
                                tech={TERMS.pbac.tech}
                                help={TERMS.pbac.help}
                                htmlFor={sliderId}
                              >
                                <div className="space-y-2">
                                  <Slider
                                    id={sliderId}
                                    min={0}
                                    max={max}
                                    step={1}
                                    value={[value]}
                                    onValueChange={([nextValue]) => {
                                      const clampedValue = Math.min(max, Math.max(0, nextValue ?? 0));
                                      setPbacCounts((prev) => {
                                        if (prev[item.id] === clampedValue) {
                                          return prev;
                                        }
                                        return { ...prev, [item.id]: clampedValue };
                                      });
                                    }}
                                    aria-describedby={describedBy}
                                  />
                                  <div id={sliderHintId} className="flex justify-between text-xs text-rose-600">
                                    <span>0</span>
                                    <span>{max}</span>
                                  </div>
                                  <SliderValueDisplay
                                    value={value}
                                    label="Aktuelle Anzahl"
                                    className="w-full sm:w-auto"
                                  />
                                  {value === max ? (
                                    <p id={sliderWarningId} className="text-sm font-medium text-rose-800">
                                      Bei mehr als zwölf bitte ärztlich abklären.
                                    </p>
                                  ) : null}
                                </div>
                              </Labeled>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <TermHeadline termKey="clots" />
                        <div className="grid gap-4 sm:grid-cols-2">
                          {PBAC_CLOT_ITEMS.map((item) => {
                            const value = pbacCounts[item.id] ?? 0;
                            const sliderId = `${item.id}-slider`;
                            const sliderHintId = `${item.id}-slider-hint`;
                            return (
                              <Labeled
                                key={item.id}
                                label={item.label}
                                tech={TERMS.pbac.tech}
                                help={TERMS.pbac.help}
                                htmlFor={sliderId}
                              >
                                <div className="space-y-2">
                                  <Slider
                                    id={sliderId}
                                    min={0}
                                    max={6}
                                    step={1}
                                    value={[value]}
                                    onValueChange={([nextValue]) => {
                                      const clampedValue = Math.min(6, Math.max(0, nextValue ?? 0));
                                      setPbacCounts((prev) => {
                                        if (prev[item.id] === clampedValue) {
                                          return prev;
                                        }
                                        return { ...prev, [item.id]: clampedValue };
                                      });
                                    }}
                                    aria-describedby={sliderHintId}
                                  />
                                  <div id={sliderHintId} className="flex justify-between text-xs text-rose-600">
                                    <span>0</span>
                                    <span>6</span>
                                  </div>
                                  <SliderValueDisplay value={value} label="Aktuelle Anzahl" className="w-full sm:w-auto" />
                                </div>
                              </Labeled>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <TermField termKey="flooding">
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={pbacFlooding}
                              onCheckedChange={(checked) =>
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  bleeding: { ...prev.bleeding, flooding: checked },
                                }))
                              }
                            />
                            <span className="text-sm text-rose-700">Flooding heute beobachtet?</span>
                          </div>
                          {renderIssuesForPath("bleeding.flooding")}
                        </TermField>
                        <div className="space-y-2 rounded border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
                          <p className="font-semibold text-rose-800">PBAC-Zusammenfassung</p>
                          <p className="text-sm">Score heute: {pbacScore}</p>
                          <div className="space-y-1">
                            {PBAC_PRODUCT_ITEMS.filter((item) => pbacCounts[item.id] > 0).map((item) => (
                              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                                <span>
                                  {pbacCounts[item.id]} × {item.label}
                                </span>
                                <span className="font-semibold text-rose-800">+{pbacCounts[item.id] * item.score}</span>
                              </div>
                            ))}
                            {PBAC_CLOT_ITEMS.filter((item) => pbacCounts[item.id] > 0).map((item) => (
                              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                                <span>
                                  {pbacCounts[item.id]} × {item.label}
                                </span>
                                <span className="font-semibold text-rose-800">+{pbacCounts[item.id] * item.score}</span>
                              </div>
                            ))}
                            {pbacFlooding ? (
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span>Flooding</span>
                                <span className="font-semibold text-rose-800">+{PBAC_FLOODING_SCORE}</span>
                              </div>
                            ) : null}
                            {PBAC_PRODUCT_ITEMS.every((item) => pbacCounts[item.id] === 0) &&
                            PBAC_CLOT_ITEMS.every((item) => pbacCounts[item.id] === 0) &&
                            !pbacFlooding ? (
                              <p className="text-rose-500">Noch keine PBAC-Daten erfasst.</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs text-rose-600">
                        {renderIssuesForPath("bleeding.pbacScore")}
                        {renderIssuesForPath("bleeding.clots")}
                      </div>
                    </div>
                  )}
                </Section>
              </div>

              <div className={cn("space-y-6", dailyActiveCategory === "medication" ? "" : "hidden")}> 
                <Section
                  title={TERMS.meds.label}
                  description="Eingenommene Medikamente & Hilfen des Tages"
                  onComplete={() => setDailyActiveCategory("overview")}
                >
                  <div className="grid gap-4">
                    <TermHeadline termKey="meds" />
                    {dailyDraft.meds.map((med, index) => (
                      <div key={index} className="grid gap-2 rounded-lg border border-rose-100 bg-rose-50 p-4">
                        <div className="grid gap-1">
                          <Label htmlFor={`med-name-${index}`}>Präparat / Hilfe</Label>
                          <Input
                            id={`med-name-${index}`}
                            value={med.name}
                            onChange={(event) => {
                              const updated = [...dailyDraft.meds];
                              updated[index] = { ...updated[index], name: event.target.value };
                              setDailyDraft((prev) => ({ ...prev, meds: updated }));
                            }}
                          />
                          {renderIssuesForPath(`meds[${index}].name`)}
                        </div>
                        <div className="grid gap-1 sm:grid-cols-2">
                          <div>
                            <Label htmlFor={`med-dose-${index}`}>Dosis (mg)</Label>
                            <Input
                              id={`med-dose-${index}`}
                              type="number"
                              min={0}
                              value={med.doseMg ?? ""}
                              onChange={(event) => {
                                const updated = [...dailyDraft.meds];
                                const nextValue = event.target.value ? Number(event.target.value) : undefined;
                                updated[index] = { ...updated[index], doseMg: nextValue };
                                setDailyDraft((prev) => ({ ...prev, meds: updated }));
                              }}
                            />
                            {renderIssuesForPath(`meds[${index}].doseMg`)}
                          </div>
                          <div>
                            <Label htmlFor={`med-times-${index}`}>Einnahmezeiten (HH:MM, kommasepariert)</Label>
                            <Input
                              id={`med-times-${index}`}
                              placeholder="08:00, 14:00"
                              value={(med.times ?? []).join(", ")}
                              onChange={(event) => {
                                const times = event.target.value
                                  .split(",")
                                  .map((value) => value.trim())
                                  .filter(Boolean);
                                const updated = [...dailyDraft.meds];
                                updated[index] = { ...updated[index], times };
                                setDailyDraft((prev) => ({ ...prev, meds: updated }));
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-xs text-rose-600"
                            onClick={() => {
                              setDailyDraft((prev) => ({
                                ...prev,
                                meds: prev.meds.filter((_, i) => i !== index),
                              }));
                            }}
                          >
                            Entfernen
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      className="justify-start"
                      onClick={() =>
                        setDailyDraft((prev) => ({
                          ...prev,
                          meds: [...prev.meds, { name: "", doseMg: undefined, times: [] }],
                        }))
                      }
                    >
                      + Medikament oder Hilfe ergänzen
                    </Button>
                    <div className="grid gap-2">
                      <TermField termKey="rescue" htmlFor="rescue-count">
                        <Input
                          id="rescue-count"
                          type="number"
                          min={0}
                          step={1}
                          value={dailyDraft.rescueDosesCount ?? ""}
                          onChange={(event) =>
                            setDailyDraft((prev) => ({
                              ...prev,
                              rescueDosesCount: event.target.value ? Number(event.target.value) : undefined,
                            }))
                          }
                        />
                        {renderIssuesForPath("rescueDosesCount")}
                      </TermField>
                    </div>
                  </div>
                </Section>
              </div>

              <div className={cn("space-y-6", dailyActiveCategory === "sleep" ? "" : "hidden")}> 
                <Section
                  title="Schlaf"
                  description="Kurzabfrage ohne Hilfsmittel"
                  onComplete={() => setDailyActiveCategory("overview")}
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
                  onComplete={() => setDailyActiveCategory("overview")}
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
                  <div className="space-y-3 rounded-lg border border-rose-100 bg-white p-4">
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
                          tech={MODULE_TERMS.dizzinessOpt.present.tech ?? MODULE_TERMS.dizzinessOpt.present.label}
                          help={MODULE_TERMS.dizzinessOpt.present.help}
                        />
                      </label>
                    </div>
                    {renderIssuesForPath("dizzinessOpt.present")}
                    {dailyDraft.dizzinessOpt?.present && (
                      <div className="space-y-3">
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
                            tech={MODULE_TERMS.dizzinessOpt.orthostatic.tech ?? MODULE_TERMS.dizzinessOpt.orthostatic.label}
                            help={MODULE_TERMS.dizzinessOpt.orthostatic.help}
                          />
                        </label>
                        {renderIssuesForPath("dizzinessOpt.orthostatic")}
                      </div>
                    )}
                  </div>
                </Section>
              </div>

              <div className={cn("space-y-6", dailyActiveCategory === "notes" ? "" : "hidden")}>
                <Section
                  title="Notizen & Tags"
                  description="Freitext oder wiederkehrende Muster markieren"
                  completionEnabled={false}
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
                  aside={
                    <Switch
                      checked={sensorsVisible}
                      onCheckedChange={setSensorsVisible}
                      aria-label="Hilfsmittel-Optionen"
                    />
                  }
                  completionEnabled={false}
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
            <div className="space-y-4">
              <Section
                title="Trend"
                description={`${TERMS.nrs.label}, ${TERMS.pbac.label} sowie Symptom- und Schlafverlauf`}
                completionEnabled={false}
              >
                <div className="flex justify-end gap-2 text-xs text-rose-600">
                  <span>Achse:</span>
                  <Button
                    type="button"
                    variant={trendXAxisMode === "date" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setTrendXAxisMode("date")}
                  >
                    Datum
                  </Button>
                  <Button
                    type="button"
                    variant={trendXAxisMode === "cycleDay" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setTrendXAxisMode("cycleDay")}
                  >
                    Zyklustag
                  </Button>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer>
                    <LineChart data={painTrendData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                      <XAxis
                        dataKey={trendXAxisMode === "date" ? "date" : "cycleLabel"}
                        stroke="#fb7185"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis yAxisId="left" domain={[0, 10]} stroke="#f43f5e" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 300]} stroke="#6366f1" tick={{ fontSize: 12 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {painTrendCycleStarts.map((item) => {
                        const xValue = trendXAxisMode === "date" ? item.date : item.cycleLabel;
                        return (
                          <ReferenceLine
                            key={`cycle-start-line-${item.date}`}
                            x={xValue}
                            stroke="#ef4444"
                            strokeDasharray="4 2"
                            isFront
                          />
                        );
                      })}
                      {painTrendCycleStarts.map((item) => {
                        const xValue = trendXAxisMode === "date" ? item.date : item.cycleLabel;
                        return (
                          <ReferenceDot
                            key={`cycle-start-dot-${item.date}`}
                            x={xValue}
                            y={9.5}
                            yAxisId="left"
                            isFront
                            shape={<CycleStartDrop />}
                          />
                        );
                      })}
                      <Line
                        type="monotone"
                        dataKey="pain"
                        stroke="#f43f5e"
                        strokeWidth={2}
                        name={`${TERMS.nrs.label} (NRS)`}
                        yAxisId="left"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="pbac"
                        stroke="#6366f1"
                        strokeWidth={2}
                        name={`${TERMS.pbac.label}`}
                        yAxisId="right"
                        connectNulls={false}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="symptomAverage"
                        stroke="#f97316"
                        strokeWidth={1.5}
                        name="Symptom-Schnitt"
                        yAxisId="left"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="sleepQuality"
                        stroke="#22c55e"
                        strokeWidth={1.5}
                        name={TERMS.sleep_quality.label}
                        yAxisId="left"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              {activeUrinary && urinaryTrendData.length > 0 && (
                <Section title="Blase/Drang Verlauf" description="Harndrang-NRS (0–10) an aktiven Tagen">
                  <div className="h-56 w-full">
                    <ResponsiveContainer>
                      <LineChart data={urinaryTrendData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                        <XAxis dataKey="date" stroke="#fb7185" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 10]} stroke="#f43f5e" tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="urgency" stroke="#f43f5e" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              )}

              {activeUrinary && urinaryMonthlyRates.length > 0 && (
                <Section title="Leckage-Rate" description="Anteil Tage mit Leckage pro Monat">
                  <div className="h-56 w-full">
                    <ResponsiveContainer>
                      <BarChart data={urinaryMonthlyRates} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                        <XAxis dataKey="month" stroke="#fb7185" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} stroke="#f43f5e" tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="leakRate" fill="#fb7185" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              )}

              {activeHeadache && headacheTrendData.length > 0 && (
                <Section title="Kopfschmerz/Migräne Verlauf" description="NRS nur an Kopfschmerztagen">
                  <div className="h-56 w-full">
                    <ResponsiveContainer>
                      <LineChart data={headacheTrendData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                        <XAxis dataKey="date" stroke="#fb7185" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 10]} stroke="#f43f5e" tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="nrs" stroke="#f43f5e" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              )}

              {activeHeadache && headacheMonthlyRates.length > 0 && (
                <Section title="Migränetage je Monat" description="Prozentualer Anteil mit Kopfschmerz/Migräne">
                  <div className="h-56 w-full">
                    <ResponsiveContainer>
                      <BarChart data={headacheMonthlyRates} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                        <XAxis dataKey="month" stroke="#fb7185" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} stroke="#f43f5e" tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="rate" fill="#fb7185" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              )}

              {activeDizziness && dizzinessTrendData.length > 0 && (
                <Section title="Schwindel-Verlauf" description="NRS 0–10 an Schwindeltagen">
                  <div className="h-56 w-full">
                    <ResponsiveContainer>
                      <LineChart data={dizzinessTrendData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                        <XAxis dataKey="date" stroke="#fb7185" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 10]} stroke="#f43f5e" tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="nrs" stroke="#f43f5e" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              )}

              {activeDizziness && dizzinessScatterData.length > 0 && (
                <Section
                  title="PBAC vs. Schwindel"
                  description="Streudiagramm: Blutungsstärke (PBAC) vs. Schwindel-NRS"
                >
                  <div className="h-56 w-full">
                    <ResponsiveContainer>
                      <ScatterChart margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                        <XAxis type="number" dataKey="pbac" name="PBAC" stroke="#fb7185" tick={{ fontSize: 12 }} />
                        <YAxis type="number" dataKey="nrs" name="Schwindel" domain={[0, 10]} stroke="#f43f5e" tick={{ fontSize: 12 }} />
                        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                        <Scatter data={dizzinessScatterData} fill="#22c55e" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              )}

              <Section
                title="Letzte Einträge"
                description="Kernmetriken kompakt"
                completionEnabled={false}
              >
                <div className="space-y-3">
                  {derivedDailyEntries
                    .slice()
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 7)
                    .map((entry) => (
                      <div key={entry.date} className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-rose-800">{entry.date}</span>
                          <span className="text-rose-600">NRS {entry.painNRS}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-rose-700">
                          <span>PBAC: {entry.bleeding.pbacScore ?? "–"}</span>
                          <span>Schlafqualität: {entry.sleep?.quality ?? "–"}</span>
                          <span>
                            Blasenschmerz:
                            {entry.symptoms?.dysuria?.present && typeof entry.symptoms.dysuria.score === "number"
                              ? entry.symptoms.dysuria.score
                              : "–"}
                          </span>
                          {activeUrinary && (
                            <span>Harndrang (Modul): {entry.urinaryOpt?.urgency ?? "–"}</span>
                          )}
                          {activeHeadache && (
                            <span>
                              Kopfschmerz (Modul):
                              {entry.headacheOpt?.present && typeof entry.headacheOpt.nrs === "number"
                                ? entry.headacheOpt.nrs
                                : "–"}
                            </span>
                          )}
                          {activeDizziness && (
                            <span>
                              Schwindel (Modul):
                              {entry.dizzinessOpt?.present && typeof entry.dizzinessOpt.nrs === "number"
                                ? entry.dizzinessOpt.nrs
                                : "–"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </Section>
              <Section
                title="Zyklus-Overlay"
                description="Durchschnittswerte je Zyklustag"
                completionEnabled={false}
              >
                <div className="max-h-64 space-y-2 overflow-y-auto text-xs text-rose-700">
                  {cycleOverlay.length === 0 && <p className="text-rose-500">Noch keine Zyklusdaten.</p>}
                  {cycleOverlay.map((row) => (
                    <div
                      key={row.cycleDay}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-100 bg-amber-50 px-2 py-1"
                    >
                      <span className="font-semibold text-rose-800">ZT {row.cycleDay}</span>
                      <span>{TERMS.nrs.label}: {row.painAvg.toFixed(1)}</span>
                      <span>Symptome: {row.symptomAvg?.toFixed(1) ?? "–"}</span>
                      <span>{TERMS.sleep_quality.label}: {row.sleepAvg?.toFixed(1) ?? "–"}</span>
                      <span>{TERMS.pbac.label}: {row.pbacAvg?.toFixed(1) ?? "–"}</span>
                      {activeUrinary && (
                        <span>{MODULE_TERMS.urinaryOpt.urgency.label}: {row.urgencyAvg?.toFixed(1) ?? "–"}</span>
                      )}
                      {activeHeadache && (
                        <span>
                          {MODULE_TERMS.headacheOpt.nrs.label}: {row.headacheAvg?.toFixed(1) ?? "–"}
                        </span>
                      )}
                      {activeDizziness && (
                        <span>
                          {MODULE_TERMS.dizzinessOpt.nrs.label}: {row.dizzinessAvg?.toFixed(1) ?? "–"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
              <Section
                title="Wochentag-Overlay"
                description="Durchschnittlicher NRS nach Wochentag"
                completionEnabled={false}
              >
                <div className="grid grid-cols-1 gap-2 text-xs text-rose-700 sm:grid-cols-2 lg:grid-cols-4">
                  {weekdayOverlay.map((row) => (
                    <div key={row.weekday} className="rounded border border-amber-100 bg-amber-50 px-2 py-1">
                      <p className="font-semibold text-rose-800">{row.weekday}</p>
                      <p>{TERMS.nrs.label}: {row.painAvg.toFixed(1)}</p>
                    </div>
                  ))}
                </div>
              </Section>
              <Section
                title="Explorative Korrelationen"
                description="Lokal berechnete Pearson-r Werte – keine medizinische Bewertung"
                completionEnabled={false}
              >
                <div className="space-y-2 text-xs text-rose-700">
                  <p>
                    Schlafqualität ↔ Schmerz: {correlations.sleep.r !== null ? correlations.sleep.r.toFixed(2) : "–"} (n={
                    correlations.sleep.n})
                  </p>
                  <p>
                    Schritte ↔ Schmerz: {correlations.steps.r !== null ? correlations.steps.r.toFixed(2) : "–"} (n={
                    correlations.steps.n})
                  </p>
                  <p className="text-[10px] text-rose-500">
                    Hinweis: nur zur Orientierung, Daten verlassen den Browser nicht.
                  </p>
                </div>
              </Section>
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
