import type { PbacCounts, ExtendedPbacData } from "./pbac";

export type ID = string;

export interface FeatureFlags {
  moduleUrinary?: boolean;
  moduleHeadache?: boolean;
  moduleDizziness?: boolean;
  billingMethod?: boolean;
}

export type PainGranularity = "tag" | "dritteltag";
export type PainTimeOfDay = "morgens" | "mittags" | "abends";
export type PainQuality =
  | "krampfend"
  | "stechend"
  | "brennend"
  | "dumpf"
  | "ziehend"
  | "anders"
  | "Migräne"
  | "Migräne mit Aura";

export type QuickPainEvent = {
  id: number;
  date: string;
  timestamp: string;
  regionId: ID;
  intensity: number;
  qualities: PainQuality[];
  /**
   * @deprecated Nur für Alt-Daten. Bitte stattdessen "qualities" verwenden.
   */
  quality?: PainQuality | null;
  timeOfDay?: PainTimeOfDay[];
  granularity?: PainGranularity;
};

export interface DailyEntry {
  date: string; // ISO YYYY-MM-DD

  // Neu:
  painRegions?: Array<{
    regionId: ID;
    nrs: number;
    qualities: DailyEntry["painQuality"];
    time?: string;
    timeOfDay?: PainTimeOfDay[];
    granularity?: PainGranularity;
  }>;

  impactNRS?: number;
  painNRS: number; // 0–10
  painQuality: PainQuality[];
  painMapRegionIds: ID[];
  quickPainEvents?: QuickPainEvent[];
  bleeding: {
    isBleeding: boolean;
    pbacScore?: number; // >=0 when isBleeding
    clots?: boolean;
    flooding?: boolean;
  };
  pbacCounts?: PbacCounts;
  extendedPbacData?: ExtendedPbacData;
  symptoms: {
    dysmenorrhea?: { present: boolean; score?: number };
    deepDyspareunia?: { present: boolean; score?: number };
    pelvicPainNonMenses?: { present: boolean; score?: number };
    dyschezia?: { present: boolean; score?: number };
    dysuria?: { present: boolean; score?: number };
    fatigue?: { present: boolean; score?: number };
    bloating?: { present: boolean; score?: number };
  };
  rescueMeds?: { name: string; doseMg?: number; time?: string }[];

  sleep?: { hours?: number; quality?: number; awakenings?: number };
  gi?: { bristolType?: 1 | 2 | 3 | 4 | 5 | 6 | 7 };
  urinary?: { freqPerDay?: number; urgency?: number };

  activity?: { steps?: number; activeMinutes?: number }; // optional, Hilfsmittel
  exploratory?: { hrvRmssdMs?: number }; // optional, Hilfsmittel

  ovulation?: {
    lhTestDone?: boolean; // optional, Hilfsmittel
    lhPositive?: boolean; // optional, Hilfsmittel
    lhTime?: string; // ISO datetime
    bbtCelsius?: number; // optional, Hilfsmittel
  };

  ovulationPain?: {
    side?: "links" | "rechts" | "beidseitig" | "unsicher";
    intensity?: number;
  };

  urinaryOpt?: {
    present?: boolean;
    urgency?: number;
    leaksCount?: number;
    nocturia?: number;
    padsCount?: number;
  };

  headacheOpt?: {
    present?: boolean;
    nrs?: number;
    aura?: boolean;
    meds?: { name: string; doseMg?: number; time?: string }[];
  };

  dizzinessOpt?: {
    present?: boolean;
    nrs?: number;
    orthostatic?: boolean;
  };

  cervixMucus?: {
    observation?: "dry" | "moist" | "wet" | "slippery";
    appearance?: "none" | "sticky" | "creamy" | "eggWhite";
  };

  notesTags?: string[];
  notesFree?: string;
}

export interface WeeklyEntry {
  isoWeek: string; // e.g. 2025-W41
  function?: {
    wpaiAbsenteeismPct?: number; // 0–100
    wpaiPresenteeismPct?: number; // 0–100
    wpaiOverallPct?: number; // 0–100
  };
}

export interface MonthlyEntry {
  month: string; // YYYY-MM
  qol?: { ehp5Items?: (number | undefined)[]; ehp5Total?: number; ehp5Transformed?: number };
  mental?: {
    phq9Items?: (number | undefined)[];
    phq9?: number;
    phq9Severity?: "mild" | "moderat" | "hoch";
    gad7Items?: (number | undefined)[];
    gad7?: number;
    gad7Severity?: "mild" | "moderat" | "hoch";
  };
  promis?: { fatigueT?: number; painInterferenceT?: number };
}
