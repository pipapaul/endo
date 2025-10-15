export type Nrs = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type FlowMode = "quick" | "detail" | "weekly" | "monthly";

export type BodyZoneId =
  | "uterus"
  | "pelvis_left"
  | "pelvis_right"
  | "sacrum"
  | "rectal"
  | "vaginal"
  | "thigh_left"
  | "thigh_right";

export interface SymptomDefinition {
  id: string;
  label: string;
  hint?: string;
}

export interface SymptomEntry {
  id: string;
  label: string;
  intensity: Nrs;
}

export type PbacProductKind = "pad" | "tampon" | "cup";
export type PbacFillLevel = "low" | "mid" | "high";

export interface PbacProductUsage {
  kind: PbacProductKind;
  fill: PbacFillLevel;
  quantity?: number;
}

export interface PbacDayInfo {
  products: PbacProductUsage[];
  clots?: "none" | "small" | "large";
  flooding?: boolean;
  dayScore: number;
}

export interface MedicationEntry {
  id: string;
  name: string;
  dose?: string;
  ts: number;
}

export interface BowelInfo {
  bristol?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  dyschezia?: boolean;
}

export interface BladderInfo {
  dysuria?: boolean;
}

export interface DayEntry {
  id: string;
  date: string; // ISO YYYY-MM-DD
  mode: Exclude<FlowMode, "weekly" | "monthly">;
  nrs?: Nrs;
  pbac?: PbacDayInfo;
  zones?: BodyZoneId[];
  symptoms?: SymptomEntry[];
  medication?: MedicationEntry[];
  sleep?: Nrs;
  bowel?: BowelInfo;
  bladder?: BladderInfo;
  triggerTags?: string[];
  helped?: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WeekEntry {
  id: string;
  isoWeek: string; // e.g. 2024-W19
  helped?: string[];
  triggerTags?: string[];
  interventions?: Array<{
    id: string;
    label: string;
    helpfulness: Nrs;
  }>;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MonthEntry {
  id: string;
  month: string; // YYYY-MM
  pbacTotal?: number;
  ehp5?: number[]; // five Likert items 0-4
  createdAt: number;
  updatedAt: number;
}

export interface ConsentState {
  fsfi?: boolean;
  lastUpdated: number;
}

export interface Settings {
  language: "de";
  quickMode: boolean;
  encryption?: {
    enabled: boolean;
    salt?: string;
    iv?: string;
  };
  privacy: {
    localOnly: true;
  };
  fsfiOptIn?: boolean;
  pinLock?: {
    enabled: boolean;
    hint?: string;
  };
}

export interface TrendPoint {
  date: string;
  nrs?: number;
  pbac?: number;
  cycleDay?: number;
}

export interface CorrelationResult {
  variableX: string;
  variableY: string;
  r: number;
  p: number;
  n: number;
  reliable: boolean;
}

export type ExportPdfType = "arzt-1pager" | "pbac" | "timeline6m";

export interface StoredKey {
  id: string;
  createdAt: number;
  algorithm: string;
}
