import type { ComponentType, SVGProps } from "react";

import { Activity, Flame, TrendingUp } from "lucide-react";

import type { DailyEntry, FeatureFlags, MonthlyEntry } from "@/lib/types";
import type { TermDescriptor, ModuleTerms } from "@/lib/terms";
import { TERMS } from "@/lib/terms";
import type { WeeklyReport } from "@/lib/weekly/reports";

export const DETAIL_TOOLBAR_FALLBACK_HEIGHT = 96;

export type SymptomKey = keyof DailyEntry["symptoms"];

export const SYMPTOM_TERMS: Record<SymptomKey, TermDescriptor> = {
  dysmenorrhea: TERMS.dysmenorrhea,
  deepDyspareunia: TERMS.deepDyspareunia,
  pelvicPainNonMenses: TERMS.pelvicPainNonMenses,
  dyschezia: TERMS.dyschezia,
  dysuria: TERMS.dysuria,
  fatigue: TERMS.fatigue,
  bloating: TERMS.bloating,
};

export type TrendMetricKey = "pain" | "impact" | "symptomAverage" | "sleepQuality" | "steps";

export type AnalyticsSectionKey = "progress" | "tracking" | "correlations";

export type AnalyticsSectionOption = {
  key: AnalyticsSectionKey;
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const ANALYTICS_SECTION_OPTIONS: AnalyticsSectionOption[] = [
  {
    key: "progress",
    label: "Verlauf & Zyklus",
    description: "Trends und Periodenvergleich",
    icon: TrendingUp,
  },
  {
    key: "tracking",
    label: "Dokumentation",
    description: "Medikation und Check-ins",
    icon: Activity,
  },
  {
    key: "correlations",
    label: "Zusammenhänge",
    description: "Korrelationen entdecken",
    icon: Flame,
  },
];

export type PendingCheckInType = "daily" | "weekly" | "monthly";

export type PendingCheckIn = {
  key: string;
  type: PendingCheckInType;
  label: string;
  description: string;
};

export type PendingOverviewConfirm =
  | { action: "change-date"; targetDate: string; options?: { manual?: boolean } }
  | { action: "go-home" };

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type BackupPayload = {
  version: number;
  exportedAt: string;
  dailyEntries: DailyEntry[];
  weeklyReports: WeeklyReport[];
  monthlyEntries: MonthlyEntry[];
  featureFlags: FeatureFlags;
};

export const BASE_PAIN_QUALITIES = [
  "krampfend",
  "stechend",
  "brennend",
  "dumpf",
  "ziehend",
  "anders",
] as const;

export const MIGRAINE_PAIN_QUALITIES = ["Migräne", "Migräne mit Aura"] as const;

export const MIGRAINE_LABEL = "Migräne";
export const MIGRAINE_WITH_AURA_LABEL = "Migräne mit Aura";
export const MIGRAINE_QUALITY_SET = new Set<string>(MIGRAINE_PAIN_QUALITIES);

export const PAIN_QUALITIES: DailyEntry["painQuality"] = [...BASE_PAIN_QUALITIES] as DailyEntry["painQuality"];
export const HEAD_PAIN_QUALITIES: DailyEntry["painQuality"] = [
  ...BASE_PAIN_QUALITIES,
  ...MIGRAINE_PAIN_QUALITIES,
] as DailyEntry["painQuality"];

export const MODULE_TERMS: ModuleTerms = {
  urinaryOpt: TERMS.urinaryOpt,
  headacheOpt: TERMS.headacheOpt,
  dizzinessOpt: TERMS.dizzinessOpt,
};
