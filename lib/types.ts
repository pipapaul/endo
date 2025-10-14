export type ID = string;

export interface DailyEntry {
  date: string; // ISO YYYY-MM-DD
  painNRS: number; // 0–10
  painQuality: ("krampfend" | "stechend" | "brennend" | "dumpf" | "ziehend" | "anders")[];
  painMapRegionIds: ID[];
  bleeding: {
    isBleeding: boolean;
    pbacScore?: number; // >=0 when isBleeding
    clots?: boolean;
  };
  symptoms: {
    dysmenorrhea?: { present: boolean; score?: number };
    deepDyspareunia?: { present: boolean; score?: number };
    pelvicPainNonMenses?: { present: boolean; score?: number };
    dyschezia?: { present: boolean; score?: number };
    dysuria?: { present: boolean; score?: number };
    fatigue?: { present: boolean; score?: number };
    bloating?: { present: boolean; score?: number };
  };
  meds: { name: string; doseMg?: number; times?: string[] }[];
  rescueDosesCount?: number;

  sleep?: { hours?: number; quality?: number; awakenings?: number };
  gi?: { bristolType?: 1 | 2 | 3 | 4 | 5 | 6 | 7; bowelPain?: number };
  urinary?: { freqPerDay?: number; urgency?: number; pain?: number };
  sexual?: { fsfiTotal?: number };

  activity?: { steps?: number; activeMinutes?: number }; // optional, Hilfsmittel
  exploratory?: { hrvRmssdMs?: number }; // optional, Hilfsmittel

  ovulation?: {
    lhTestDone?: boolean; // optional, Hilfsmittel
    lhPositive?: boolean; // optional, Hilfsmittel
    lhTime?: string; // ISO datetime
    bbtCelsius?: number; // optional, Hilfsmittel
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
  qol?: { ehp5Total?: number; ehp5Subscales?: Record<string, number> };
  mental?: { phq9?: number; gad7?: number };
  promis?: { fatigueT?: number; painInterferenceT?: number };
}
