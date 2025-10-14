"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "recharts";
import type { TooltipProps } from "recharts";
import { Calendar, Download, Upload } from "lucide-react";

import { DailyEntry, MonthlyEntry, WeeklyEntry } from "@/lib/types";
import { TERMS } from "@/lib/terms";
import type { TermDescriptor } from "@/lib/terms";
import {
  validateDailyEntry,
  validateMonthlyEntry,
  validateWeeklyEntry,
  type ValidationIssue,
} from "@/lib/validation";
import InfoTip from "@/components/InfoTip";
import { Labeled } from "@/components/Labeled";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";

type TermKey = keyof typeof TERMS;
type SymptomKey = keyof DailyEntry["symptoms"];

const PAIN_QUALITIES: DailyEntry["painQuality"] = [
  "krampfend",
  "stechend",
  "brennend",
  "dumpf",
  "ziehend",
  "anders",
];

const BODY_REGIONS: { id: string; label: string }[] = [
  { id: "pelvis_left", label: "Becken links" },
  { id: "pelvis_right", label: "Becken rechts" },
  { id: "uterus", label: "Uterus" },
  { id: "lower_back", label: "LWS / Kreuzbein" },
  { id: "upper_abdomen", label: "Oberbauch" },
  { id: "rectal", label: "Rektalbereich" },
  { id: "vaginal", label: "Vaginalbereich" },
  { id: "thigh_left", label: "Oberschenkel links" },
  { id: "thigh_right", label: "Oberschenkel rechts" },
];

const SYMPTOM_ITEMS: { key: SymptomKey; termKey: TermKey }[] = [
  { key: "dysmenorrhea", termKey: "dysmenorrhea" },
  { key: "deepDyspareunia", termKey: "deepDyspareunia" },
  { key: "pelvicPainNonMenses", termKey: "pelvicPainNonMenses" },
  { key: "dyschezia", termKey: "dyschezia" },
  { key: "dysuria", termKey: "dysuria" },
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

type PbacProductItem = (typeof PBAC_PRODUCT_ITEMS)[number];
type PbacProduct = PbacProductItem["product"];
type PbacSaturation = PbacProductItem["saturation"];
type PbacCounts = Record<(typeof PBAC_ITEMS)[number]["id"], number>;

const PBAC_PRODUCT_OPTIONS: { id: PbacProduct; label: string }[] = [
  { id: "pad", label: "Binde" },
  { id: "tampon", label: "Tampon" },
];

const PBAC_SATURATION_OPTIONS: { id: PbacSaturation; label: string }[] = [
  { id: "light", label: "leicht" },
  { id: "medium", label: "mittel" },
  { id: "heavy", label: "stark" },
];

const PBAC_FLOODING_SCORE = 5;

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

const BRISTOL_TYPES = [
  { value: 1, label: "Typ 1" },
  { value: 2, label: "Typ 2" },
  { value: 3, label: "Typ 3" },
  { value: 4, label: "Typ 4" },
  { value: 5, label: "Typ 5" },
  { value: 6, label: "Typ 6" },
  { value: 7, label: "Typ 7" },
] as const;

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createEmptyDailyEntry = (date: string): DailyEntry => ({
  date,
  painNRS: 0,
  painQuality: [],
  painMapRegionIds: [],
  bleeding: { isBleeding: false },
  symptoms: {},
  meds: [],
  ovulation: {},
});

const createEmptyWeeklyEntry = (isoWeek: string): WeeklyEntry => ({
  isoWeek,
  function: {
    wpaiAbsenteeismPct: undefined,
    wpaiPresenteeismPct: undefined,
    wpaiOverallPct: undefined,
  },
});

const createEmptyMonthlyEntry = (month: string): MonthlyEntry => ({
  month,
  qol: {},
  mental: {},
  promis: {},
});

function useLocalStorageState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    const stored = window.localStorage.getItem(key);
    if (!stored) return defaultValue;
    try {
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

function Section({ title, description, aside, children }: {
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="border border-rose-100 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold text-rose-900">{title}</CardTitle>
            {description && <p className="mt-1 text-sm text-rose-600">{description}</p>}
          </div>
          {aside}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
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
}) {
  const content = (
    <div className="flex items-center gap-4">
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} id={id} />
      <Input
        className="w-20"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
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
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition",
            value.includes(option.value)
              ? "border-rose-400 bg-rose-100 text-rose-700"
              : "border-rose-100 bg-white text-rose-600 hover:border-rose-200"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function BodyMap({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {BODY_REGIONS.map((region) => (
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
            "rounded-lg border px-3 py-2 text-left text-sm transition",
            value.includes(region.id)
              ? "border-rose-400 bg-rose-100 text-rose-700"
              : "border-rose-100 bg-rose-50 text-rose-600 hover:border-rose-300"
          )}
        >
          {region.label}
        </button>
      ))}
    </div>
  );
}

function computePbacScore(counts: PbacCounts, flooding: boolean) {
  const base = PBAC_ITEMS.reduce((total, item) => total + counts[item.id] * item.score, 0);
  return base + (flooding ? PBAC_FLOODING_SCORE : 0);
}

function findPbacProductItem(product: PbacProduct, saturation: PbacSaturation) {
  return PBAC_PRODUCT_ITEMS.find((item) => item.product === product && item.saturation === saturation);
}

function computeWpaiOverall(absenteeism?: number, presenteeism?: number) {
  if (typeof absenteeism !== "number" || typeof presenteeism !== "number") return undefined;
  const abs = Math.max(0, Math.min(100, absenteeism));
  const pre = Math.max(0, Math.min(100, presenteeism));
  const absFraction = abs / 100;
  const preFraction = pre / 100;
  const overall = Math.round((absFraction + (1 - absFraction) * preFraction) * 100);
  return Math.min(overall, 100);
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

function isoWeekToDate(isoWeek: string) {
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const fourthJan = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = fourthJan.getUTCDay() || 7;
  const monday = new Date(fourthJan);
  monday.setUTCDate(fourthJan.getUTCDate() - (dayOfWeek - 1) + (week - 1) * 7);
  return monday;
}

function monthToDate(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
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
  const [dailyEntries, setDailyEntries] = useLocalStorageState<DailyEntry[]>("endo.daily.v2", []);
  const [weeklyEntries, setWeeklyEntries] = useLocalStorageState<WeeklyEntry[]>("endo.weekly.v2", []);
  const [monthlyEntries, setMonthlyEntries] = useLocalStorageState<MonthlyEntry[]>("endo.monthly.v2", []);

  const [dailyDraft, setDailyDraft] = useState<DailyEntry>(() => createEmptyDailyEntry(today));
  const [pbacCounts, setPbacCounts] = useState<PbacCounts>({ ...PBAC_DEFAULT_COUNTS });
  const [pbacStep, setPbacStep] = useState(1);
  const [pbacSelection, setPbacSelection] = useState<{ product: PbacProduct | null; saturation: PbacSaturation | null }>(
    () => ({ product: null, saturation: null })
  );
  const [pbacCountDraft, setPbacCountDraft] = useState("0");
  const [fsfiOptIn, setFsfiOptIn] = useState(false);
  const [sensorsVisible, setSensorsVisible] = useState(false);
  const [exploratoryVisible, setExploratoryVisible] = useState(false);
  const [notesTagDraft, setNotesTagDraft] = useState("");
  const [painQualityOther, setPainQualityOther] = useState("");
  const [trendXAxisMode, setTrendXAxisMode] = useState<"date" | "cycleDay">("date");

  const [weeklyDraft, setWeeklyDraft] = useState<WeeklyEntry>(() => {
    const now = new Date();
    const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNr = (target.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const weekNumber =
      1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    const isoWeek = `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
    return createEmptyWeeklyEntry(isoWeek);
  });

  const [monthlyDraft, setMonthlyDraft] = useState<MonthlyEntry>(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return createEmptyMonthlyEntry(month);
  });

  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const pbacFlooding = dailyDraft.bleeding.flooding ?? false;
  const selectedPbacItem =
    pbacSelection.product && pbacSelection.saturation
      ? findPbacProductItem(pbacSelection.product, pbacSelection.saturation)
      : null;
  const pbacScore = useMemo(() => computePbacScore(pbacCounts, pbacFlooding), [pbacCounts, pbacFlooding]);
  const wpaiAbsenteeism = weeklyDraft.function?.wpaiAbsenteeismPct;
  const wpaiPresenteeism = weeklyDraft.function?.wpaiPresenteeismPct;
  const wpaiOverall = weeklyDraft.function?.wpaiOverallPct ?? computeWpaiOverall(wpaiAbsenteeism, wpaiPresenteeism);
  const phqSeverity = monthlyDraft.mental?.phq9Severity ?? mapPhqSeverity(monthlyDraft.mental?.phq9);
  const gadSeverity = monthlyDraft.mental?.gad7Severity ?? mapGadSeverity(monthlyDraft.mental?.gad7);

  useEffect(() => {
    if (dailyDraft.bleeding.isBleeding) {
      setDailyDraft((prev) => ({
        ...prev,
        bleeding: {
          ...prev.bleeding,
          pbacScore,
          clots: prev.bleeding.clots ?? false,
          flooding: prev.bleeding.flooding ?? false,
        },
      }));
    }
  }, [pbacScore, dailyDraft.bleeding.isBleeding]);

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

  const goToPbacProduct = (product: PbacProduct, saturation: PbacSaturation) => {
    const item = findPbacProductItem(product, saturation);
    if (!item) return;
    setPbacSelection({ product, saturation });
    setPbacCountDraft(String(pbacCounts[item.id] ?? 0));
    setPbacStep(3);
  };

  const commitPbacCount = () => {
    if (!selectedPbacItem) return;
    const parsed = Math.max(0, Math.round(Number(pbacCountDraft) || 0));
    setPbacCounts((prev) => {
      if (prev[selectedPbacItem.id] === parsed) {
        return prev;
      }
      return { ...prev, [selectedPbacItem.id]: parsed };
    });
    setPbacCountDraft(String(parsed));
  };

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

    const validationIssues = validateDailyEntry(payload);
    setIssues(validationIssues);
    if (validationIssues.length) {
      setInfoMessage("Bitte prüfe die markierten Felder.");
      return;
    }

    setDailyEntries((prev) => {
      const filtered = prev.filter((entry) => entry.date !== payload.date);
      return [...filtered, payload].sort((a, b) => a.date.localeCompare(b.date));
    });

    setInfoMessage("Tagescheck-in gespeichert.");
    setDailyDraft(createEmptyDailyEntry(today));
    setPbacCounts({ ...PBAC_DEFAULT_COUNTS });
    setPainQualityOther("");
    setNotesTagDraft("");
    setFsfiOptIn(false);
    setSensorsVisible(false);
    setExploratoryVisible(false);
    setIssues([]);
  };

  const handleWeeklySubmit = () => {
    const payloadFunction = weeklyDraft.function
      ? { ...weeklyDraft.function }
      : undefined;
    if (payloadFunction) {
      const computedOverall = computeWpaiOverall(
        payloadFunction.wpaiAbsenteeismPct,
        payloadFunction.wpaiPresenteeismPct
      );
      if (computedOverall !== undefined) {
        payloadFunction.wpaiOverallPct = computedOverall;
      } else {
        delete payloadFunction.wpaiOverallPct;
      }
    }
    const payload: WeeklyEntry = { ...weeklyDraft, function: payloadFunction };
    const validationIssues = validateWeeklyEntry(payload);
    setIssues(validationIssues);
    if (validationIssues.length) {
      setInfoMessage("WPAI-Eingaben prüfen.");
      return;
    }

    setWeeklyEntries((prev) => {
      const filtered = prev.filter((entry) => entry.isoWeek !== payload.isoWeek);
      return [...filtered, payload].sort((a, b) => a.isoWeek.localeCompare(b.isoWeek));
    });
    setInfoMessage("WPAI-Werte gespeichert.");
    setWeeklyDraft(createEmptyWeeklyEntry(payload.isoWeek));
    setIssues([]);
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

  const handleDailyImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const json = JSON.parse(text) as DailyEntry[];
        const valid = json.filter((entry) => validateDailyEntry(entry).length === 0);
        setDailyEntries(valid);
        setInfoMessage("Tagesdaten importiert.");
      } catch {
        setInfoMessage("Import fehlgeschlagen.");
      }
    });
  };

  const handleReportDownload = (months: number) => {
    const threshold = new Date();
    threshold.setHours(0, 0, 0, 0);
    threshold.setMonth(threshold.getMonth() - months);
    const thresholdIso = formatDate(threshold);
    const thresholdMonth = thresholdIso.slice(0, 7);
    const dailyFiltered = dailyEntries.filter((entry) => entry.date >= thresholdIso);
    const weeklyFiltered = weeklyEntries.filter((entry) => {
      const start = isoWeekToDate(entry.isoWeek);
      if (!start) return false;
      return formatDate(start) >= thresholdIso;
    });
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
    } else {
      lines.push("Keine Tagesdaten im Zeitraum.");
    }

    if (weeklyFiltered.length) {
      const latest = weeklyFiltered[weeklyFiltered.length - 1];
      lines.push(
        `Letzte WPAI-Werte: Absenz ${latest.function?.wpaiAbsenteeismPct ?? "–"}% | Präsenzminderung ${latest.function?.wpaiPresenteeismPct ?? "–"}% | Gesamt ${latest.function?.wpaiOverallPct ?? "–"}%`
      );
    } else {
      lines.push("Keine WPAI-Werte im Zeitraum.");
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
    const glossaryKeys: TermKey[] = [
      "nrs",
      "pbac",
      "wpai_abs",
      "wpai_pre",
      "wpai_overall",
      "ehp5",
      "phq9",
      "gad7",
      "promis_fatigue",
      "promis_painInt",
    ];
    glossaryKeys.forEach((key) => {
      const term = TERMS[key];
      lines.push(`- ${term.label}: ${term.help}`);
    });

    const pdf = createPdfDocument(`Endo-Report ${months} Monate`, lines);
    downloadFile(`endo-report-${months}m.pdf`, pdf, "application/pdf");
  };

  const annotatedDailyEntries = useMemo(() => {
    const sorted = dailyEntries.slice().sort((a, b) => a.date.localeCompare(b.date));
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
  }, [dailyEntries]);

  const painTrendData = useMemo(
    () =>
      annotatedDailyEntries.map(({ entry, cycleDay, weekday, symptomAverage }) => ({
        date: entry.date,
        cycleDay,
        cycleLabel: cycleDay ? `ZT ${cycleDay}` : "–",
        weekday,
        pain: entry.painNRS,
        pbac: entry.bleeding.pbacScore ?? null,
        symptomAverage,
        sleepQuality: entry.sleep?.quality ?? null,
      })),
    [annotatedDailyEntries]
  );

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
      { painSum: number; symptomSum: number; count: number; sleepSum: number; pbacSum: number; pbacCount: number }
    >();
    annotatedDailyEntries.forEach(({ entry, cycleDay, symptomAverage }) => {
      if (!cycleDay) return;
      const current = bucket.get(cycleDay) ?? { painSum: 0, symptomSum: 0, count: 0, sleepSum: 0, pbacSum: 0, pbacCount: 0 };
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
      }));
  }, [annotatedDailyEntries]);

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
    const stepsPairs = dailyEntries
      .filter((entry) => typeof entry.activity?.steps === "number")
      .map((entry) => ({ x: entry.activity!.steps as number, y: entry.painNRS }));
    return {
      sleep: { r: computePearson(sleepPairs), n: sleepPairs.length },
      steps: { r: computePearson(stepsPairs), n: stepsPairs.length },
    };
  }, [annotatedDailyEntries, dailyEntries]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-rose-900">Endometriose Symptomtracker</h1>
        <p className="text-sm text-rose-700">
          Kernmetriken ohne Hilfsmittel, optionale Sensorfelder nur auf Wunsch.
        </p>
        <p className="text-xs text-rose-500">Keine Telemetrie. Daten bleiben im Browser (Local Storage) – Export jederzeit als JSON/CSV/PDF.</p>
        {infoMessage && <p className="text-sm font-medium text-rose-600">{infoMessage}</p>}
      </header>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-rose-100 text-rose-700">
          <TabsTrigger value="daily">Täglicher Check-in</TabsTrigger>
          <TabsTrigger value="weekly">Wöchentlich</TabsTrigger>
          <TabsTrigger value="monthly">Monatlich</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-6">
          <Section
            title="Tagescheck-in"
            description="Schmerz → Körperkarte → Symptome → Blutung → Medikation → Schlaf → Darm/Blase → Notizen"
            aside={<Badge className="bg-rose-200 text-rose-700">max. 60 Sekunden</Badge>}
          >
            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <div className="space-y-6">
                <div className="grid gap-4">
                  <Label className="text-sm font-medium text-rose-800">Datum</Label>
                  <Input
                    type="date"
                    value={dailyDraft.date}
                    onChange={(event) => setDailyDraft({ ...dailyDraft, date: event.target.value })}
                    className="w-48"
                    max={today}
                  />
                  {renderIssuesForPath("date")}
                </div>

                <Section
                  title={`${TERMS.nrs.label} (NRS)`}
                  description="Numerische Schmerzskala 0–10 – ganzzahlige Eingabe"
                >
                  <ScoreInput
                    id="pain-nrs"
                    label={TERMS.nrs.label}
                    termKey="nrs"
                    value={dailyDraft.painNRS}
                    onChange={(value) =>
                      setDailyDraft((prev) => ({ ...prev, painNRS: Math.max(0, Math.min(10, Math.round(value))) }))
                    }
                  />
                  {renderIssuesForPath("painNRS")}
                  <div className="grid gap-4 md:grid-cols-2">
                    <TermField termKey="painQuality">
                      <div className="space-y-2">
                        <MultiSelectChips
                          options={PAIN_QUALITIES.map((quality) => ({ value: quality, label: quality }))}
                          value={dailyDraft.painQuality}
                          onToggle={(next) =>
                            setDailyDraft((prev) => ({ ...prev, painQuality: next as DailyEntry["painQuality"] }))
                          }
                        />
                        {dailyDraft.painQuality.includes("anders") && (
                          <Input
                            placeholder="Beschreibe den Schmerz"
                            value={painQualityOther}
                            onChange={(event) => setPainQualityOther(event.target.value)}
                          />
                        )}
                      </div>
                      {dailyDraft.painQuality.map((_, index) => renderIssuesForPath(`painQuality[${index}]`))}
                    </TermField>
                    <TermField termKey="bodyMap">
                      <BodyMap
                        value={dailyDraft.painMapRegionIds}
                        onChange={(next) => setDailyDraft((prev) => ({ ...prev, painMapRegionIds: next }))}
                      />
                      {renderIssuesForPath("painMapRegionIds")}
                    </TermField>
                  </div>
                </Section>

                <Section
                  title="Typische Endometriose-Symptome"
                  description="Je Symptom: Ja/Nein plus Stärke auf der 0–10 Skala"
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
                  </div>
                </Section>

                <Section title={`${TERMS.bleeding_active.label} & ${TERMS.pbac.label}`}>
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
                          setPbacStep(1);
                          setPbacSelection({ product: null, saturation: null });
                          setPbacCountDraft("0");
                        }
                      }}
                    />
                  </div>
                  {dailyDraft.bleeding.isBleeding && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        <span>PBAC-Wizard • Schritt {pbacStep} von 5</span>
                        <span>Aktueller Score: {pbacScore}</span>
                      </div>
                      {pbacStep === 1 && (
                        <div className="space-y-3">
                          <TermHeadline termKey="pbac" />
                          <div className="grid gap-2 sm:grid-cols-2">
                            {PBAC_PRODUCT_OPTIONS.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => {
                                  setPbacSelection({ product: option.id, saturation: null });
                                  setPbacStep(2);
                                }}
                                className={cn(
                                  "rounded border px-3 py-2 text-left text-sm transition",
                                  pbacSelection.product === option.id
                                    ? "border-rose-400 bg-rose-100 text-rose-700"
                                    : "border-rose-100 bg-white text-rose-600 hover:border-rose-300"
                                )}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {pbacStep === 2 && (
                        <div className="space-y-3">
                          <TermHeadline termKey="pbac" />
                          <div className="grid grid-cols-3 gap-2">
                            {PBAC_SATURATION_OPTIONS.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                disabled={!pbacSelection.product}
                                onClick={() => pbacSelection.product && goToPbacProduct(pbacSelection.product, option.id)}
                                className={cn(
                                  "rounded border px-3 py-2 text-sm transition",
                                  pbacSelection.saturation === option.id
                                    ? "border-rose-400 bg-rose-100 text-rose-700"
                                    : "border-rose-100 bg-white text-rose-600 hover:border-rose-300",
                                  !pbacSelection.product ? "opacity-50" : ""
                                )}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex justify-start">
                            <Button type="button" variant="ghost" onClick={() => setPbacStep(1)}>
                              Zurück
                            </Button>
                          </div>
                        </div>
                      )}
                      {pbacStep === 3 && selectedPbacItem && (
                        <div className="space-y-4">
                          <Labeled
                            label={`Anzahl ${selectedPbacItem.label}`}
                            tech={TERMS.pbac.tech}
                            help={TERMS.pbac.help}
                            htmlFor="pbac-count"
                          >
                            <Input
                              id="pbac-count"
                              type="number"
                              min={0}
                              step={1}
                              value={pbacCountDraft}
                              onChange={(event) => setPbacCountDraft(event.target.value)}
                            />
                          </Labeled>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="ghost" onClick={() => setPbacStep(2)}>
                              Zurück
                            </Button>
                            <div className="ml-auto flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  commitPbacCount();
                                  setPbacSelection({ product: null, saturation: null });
                                  setPbacCountDraft("0");
                                  setPbacStep(1);
                                }}
                              >
                                Weiteres Produkt
                              </Button>
                              <Button
                                type="button"
                                onClick={() => {
                                  commitPbacCount();
                                  setPbacStep(4);
                                }}
                              >
                                Weiter zu Koageln
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2 rounded border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
                            <p className="font-semibold text-rose-800">Bisher erfasste Produkte</p>
                            {PBAC_PRODUCT_ITEMS.some((item) => pbacCounts[item.id] > 0) ? (
                              PBAC_PRODUCT_ITEMS.map((item) =>
                                pbacCounts[item.id] > 0 ? (
                                  <div key={item.id} className="flex items-center justify-between">
                                    <span>
                                      {pbacCounts[item.id]} × {item.label}
                                    </span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-auto px-2 py-0 text-xs text-rose-600"
                                      onClick={() => goToPbacProduct(item.product, item.saturation)}
                                    >
                                      Bearbeiten
                                    </Button>
                                  </div>
                                ) : null
                              )
                            ) : (
                              <p className="text-rose-500">Noch keine Produkte dokumentiert.</p>
                            )}
                          </div>
                        </div>
                      )}
                      {pbacStep === 4 && (
                        <div className="space-y-3">
                          <TermHeadline termKey="clots" />
                          <div className="grid gap-3 sm:grid-cols-2">
                            {PBAC_CLOT_ITEMS.map((item) => (
                              <Labeled
                                key={item.id}
                                label={item.label}
                                tech={TERMS.clots.tech}
                                help={TERMS.clots.help}
                                htmlFor={item.id}
                              >
                            <Input
                              id={item.id}
                              type="number"
                              min={0}
                              step={1}
                              value={String(pbacCounts[item.id] ?? 0)}
                              onChange={(event) => {
                                const nextValue = Math.max(0, Math.round(Number(event.target.value) || 0));
                                const updatedCounts: PbacCounts = { ...pbacCounts, [item.id]: nextValue };
                                setPbacCounts(updatedCounts);
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  bleeding: {
                                    ...prev.bleeding,
                                    clots: (updatedCounts.clot_small ?? 0) + (updatedCounts.clot_large ?? 0) > 0,
                                  },
                                }));
                              }}
                            />
                          </Labeled>
                        ))}
                          </div>
                          <div className="flex justify-between">
                            <Button type="button" variant="ghost" onClick={() => setPbacStep(3)}>
                              Zurück
                            </Button>
                            <Button type="button" onClick={() => setPbacStep(5)}>
                              Weiter zu Flooding
                            </Button>
                          </div>
                        </div>
                      )}
                      {pbacStep === 5 && (
                        <div className="space-y-3">
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
                                <div key={item.id} className="flex items-center justify-between">
                                  <span>
                                    {pbacCounts[item.id]} × {item.label}
                                  </span>
                                  <span className="font-semibold text-rose-800">+{pbacCounts[item.id] * item.score}</span>
                                </div>
                              ))}
                              {PBAC_CLOT_ITEMS.filter((item) => pbacCounts[item.id] > 0).map((item) => (
                                <div key={item.id} className="flex items-center justify-between">
                                  <span>
                                    {pbacCounts[item.id]} × {item.label}
                                  </span>
                                  <span className="font-semibold text-rose-800">+{pbacCounts[item.id] * item.score}</span>
                                </div>
                              ))}
                              {pbacFlooding ? (
                                <div className="flex items-center justify-between">
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
                          <div className="flex justify-between">
                            <Button type="button" variant="ghost" onClick={() => setPbacStep(4)}>
                              Zurück
                            </Button>
                            <Button
                              type="button"
                              onClick={() => {
                                setPbacStep(1);
                                setPbacSelection({ product: null, saturation: null });
                                setPbacCountDraft("0");
                              }}
                            >
                              Wizard schließen
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="space-y-1 text-xs text-rose-600">
                        {renderIssuesForPath("bleeding.pbacScore")}
                        {renderIssuesForPath("bleeding.clots")}
                      </div>
                    </div>
                  )}
                </Section>

                <Section title={TERMS.meds.label} description="Eingenommene Medikamente & Hilfen des Tages">
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

                <Section title="Schlaf" description="Kurzabfrage ohne Hilfsmittel">
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

                <Section title="Darm & Blase" description="Situativ erfassbar">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
                      <p className="font-medium text-rose-800">Darm</p>
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
                      <ScoreInput
                        id="bowel-pain"
                        label={TERMS.bowelPain.label}
                        termKey="bowelPain"
                        value={dailyDraft.gi?.bowelPain ?? 0}
                        onChange={(value) =>
                          setDailyDraft((prev) => ({
                            ...prev,
                            gi: {
                              ...(prev.gi ?? {}),
                              bowelPain: Math.max(0, Math.min(10, Math.round(value))),
                            },
                          }))
                        }
                      />
                      {renderIssuesForPath("gi.bowelPain")}
                    </div>
                    <div className="grid gap-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
                      <p className="font-medium text-rose-800">Blase</p>
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
                      <ScoreInput
                        id="urinary-pain"
                        label={TERMS.urinary_pain.label}
                        termKey="urinary_pain"
                        value={dailyDraft.urinary?.pain ?? 0}
                        onChange={(value) =>
                          setDailyDraft((prev) => ({
                            ...prev,
                            urinary: {
                              ...(prev.urinary ?? {}),
                              pain: Math.max(0, Math.min(10, Math.round(value))),
                            },
                          }))
                        }
                      />
                      {renderIssuesForPath("urinary.pain")}
                    </div>
                  </div>
                </Section>

                <Section title="Sexualfunktion (sensibles Opt-in)" description="FSFI wird nur nach Opt-in gezeigt">
                  <div className="flex items-center gap-3">
                    <Switch checked={fsfiOptIn} onCheckedChange={setFsfiOptIn} />
                    <span className="text-sm text-rose-700">
                      FSFI-Eingabe aktivieren (Werte werden separat gespeichert)
                    </span>
                  </div>
                  {fsfiOptIn && (
                    <TermField termKey="fsfi" htmlFor="fsfi-score">
                      <Input
                        id="fsfi-score"
                        type="number"
                        min={0}
                        step={0.1}
                        value={dailyDraft.sexual?.fsfiTotal ?? ""}
                        onChange={(event) =>
                          setDailyDraft((prev) => ({
                            ...prev,
                            sexual: {
                              ...(prev.sexual ?? {}),
                              fsfiTotal: event.target.value ? Number(event.target.value) : undefined,
                            },
                          }))
                        }
                      />
                      {renderIssuesForPath("sexual.fsfiTotal")}
                    </TermField>
                  )}
                </Section>

                <Section title="Notizen & Tags" description="Freitext oder wiederkehrende Muster markieren">
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
                        <div className="flex items-center justify-between">
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

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={handleDailySubmit}>
                    Tagesdaten speichern
                  </Button>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-rose-600">
                    <Upload size={16} />
                    JSON importieren
                    <input type="file" accept="application/json" className="hidden" onChange={handleDailyImport} />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      downloadFile(
                        `endo-daily-${today}.json`,
                        JSON.stringify(dailyEntries, null, 2),
                        "application/json"
                      )
                    }
                  >
                    <Download size={16} className="mr-2" /> JSON Export
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      downloadFile(
                        `endo-daily-${today}.csv`,
                        toCsv(
                          dailyEntries.map((entry) => ({
                            Datum: entry.date,
                            [`${TERMS.nrs.label} (NRS)`]: entry.painNRS,
                            Schmerzarten: entry.painQuality.join(";"),
                            "Schmerzorte (IDs)": entry.painMapRegionIds.join(";"),
                            [`${TERMS.pbac.label}`]: entry.bleeding.pbacScore ?? "",
                            "Symptom-Scores": Object.entries(entry.symptoms ?? {})
                              .map(([key, value]) =>
                                value?.present && typeof value.score === "number" ? `${key}:${value.score}` : null
                              )
                              .filter(Boolean)
                              .join(";"),
                            [`${TERMS.sleep_quality.label}`]: entry.sleep?.quality ?? "",
                            [`${TERMS.urinary_pain.label}`]: entry.urinary?.pain ?? "",
                          }))
                        ),
                        "text/csv"
                      )
                    }
                  >
                    <Download size={16} className="mr-2" /> CSV Export
                  </Button>
                  <div className="flex flex-wrap items-center gap-2">
                    {[3, 6, 12].map((months) => (
                      <Button key={months} type="button" variant="outline" onClick={() => handleReportDownload(months)}>
                        {months} Monate PDF
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Section
                  title="Trend"
                  description={`${TERMS.nrs.label}, ${TERMS.pbac.label} sowie Symptom- und Schlafverlauf`}
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

                <Section title="Letzte Einträge" description="Kernmetriken kompakt">
                  <div className="space-y-3">
                    {dailyEntries
                      .slice()
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .slice(0, 7)
                      .map((entry) => (
                        <div key={entry.date} className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-rose-800">{entry.date}</span>
                            <span className="text-rose-600">NRS {entry.painNRS}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-rose-700">
                            <span>PBAC: {entry.bleeding.pbacScore ?? "–"}</span>
                            <span>Schlafqualität: {entry.sleep?.quality ?? "–"}</span>
                            <span>Blasenschmerz: {entry.urinary?.pain ?? "–"}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </Section>
                <Section title="Zyklus-Overlay" description="Durchschnittswerte je Zyklustag">
                  <div className="max-h-64 space-y-2 overflow-y-auto text-xs text-rose-700">
                    {cycleOverlay.length === 0 && <p className="text-rose-500">Noch keine Zyklusdaten.</p>}
                    {cycleOverlay.map((row) => (
                      <div
                        key={row.cycleDay}
                        className="flex items-center justify-between rounded border border-rose-100 bg-rose-50 px-2 py-1"
                      >
                        <span className="font-semibold text-rose-800">ZT {row.cycleDay}</span>
                        <span>{TERMS.nrs.label}: {row.painAvg.toFixed(1)}</span>
                        <span>Symptome: {row.symptomAvg?.toFixed(1) ?? "–"}</span>
                        <span>{TERMS.sleep_quality.label}: {row.sleepAvg?.toFixed(1) ?? "–"}</span>
                        <span>{TERMS.pbac.label}: {row.pbacAvg?.toFixed(1) ?? "–"}</span>
                      </div>
                    ))}
                  </div>
                </Section>
                <Section title="Wochentag-Overlay" description="Durchschnittlicher NRS nach Wochentag">
                  <div className="grid grid-cols-2 gap-2 text-xs text-rose-700 sm:grid-cols-4">
                    {weekdayOverlay.map((row) => (
                      <div key={row.weekday} className="rounded border border-rose-100 bg-rose-50 px-2 py-1">
                        <p className="font-semibold text-rose-800">{row.weekday}</p>
                        <p>{TERMS.nrs.label}: {row.painAvg.toFixed(1)}</p>
                      </div>
                    ))}
                  </div>
                </Section>
                <Section
                  title="Explorative Korrelationen"
                  description="Lokal berechnete Pearson-r Werte – keine medizinische Bewertung"
                >
                  <div className="space-y-2 text-xs text-rose-700">
                    <p>
                      Schlafqualität ↔ Schmerz: {correlations.sleep.r !== null ? correlations.sleep.r.toFixed(2) : "–"} (n=
                      {correlations.sleep.n})
                    </p>
                    <p>
                      Schritte ↔ Schmerz: {correlations.steps.r !== null ? correlations.steps.r.toFixed(2) : "–"} (n=
                      {correlations.steps.n})
                    </p>
                    <p className="text-[10px] text-rose-500">
                      Hinweis: nur zur Orientierung, Daten verlassen den Browser nicht.
                    </p>
                  </div>
                </Section>
              </div>
            </div>
          </Section>
        </TabsContent>
        <TabsContent value="weekly" className="space-y-6">
          <Section
            title={`${TERMS.wpai_overall.label} (WPAI – 7-Tage-Rückblick)`}
            description="Prozentwerte für Fehlzeiten, Präsenzminderung und Gesamtbeeinträchtigung"
            aside={<Calendar size={16} className="text-rose-500" />}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Labeled label="Kalenderwoche (ISO)" htmlFor="iso-week">
                <Input
                  id="iso-week"
                  value={weeklyDraft.isoWeek}
                  onChange={(event) => setWeeklyDraft((prev) => ({ ...prev, isoWeek: event.target.value }))}
                />
                {renderIssuesForPath("isoWeek")}
              </Labeled>
              <TermField termKey="wpai_abs" htmlFor="wpai-abs">
                <Input
                  id="wpai-abs"
                  type="number"
                  min={0}
                  max={100}
                  value={weeklyDraft.function?.wpaiAbsenteeismPct ?? ""}
                  onChange={(event) => {
                    const value = event.target.value ? Number(event.target.value) : undefined;
                    setWeeklyDraft((prev) => {
                      const nextFunction = { ...(prev.function ?? {}), wpaiAbsenteeismPct: value };
                      const computed = computeWpaiOverall(value, nextFunction.wpaiPresenteeismPct);
                      if (computed !== undefined) {
                        nextFunction.wpaiOverallPct = computed;
                      } else {
                        delete nextFunction.wpaiOverallPct;
                      }
                      return { ...prev, function: nextFunction };
                    });
                  }}
                />
                {renderIssuesForPath("function.wpaiAbsenteeismPct")}
              </TermField>
              <TermField termKey="wpai_pre" htmlFor="wpai-pre">
                <Input
                  id="wpai-pre"
                  type="number"
                  min={0}
                  max={100}
                  value={weeklyDraft.function?.wpaiPresenteeismPct ?? ""}
                  onChange={(event) => {
                    const value = event.target.value ? Number(event.target.value) : undefined;
                    setWeeklyDraft((prev) => {
                      const nextFunction = { ...(prev.function ?? {}), wpaiPresenteeismPct: value };
                      const computed = computeWpaiOverall(nextFunction.wpaiAbsenteeismPct, value);
                      if (computed !== undefined) {
                        nextFunction.wpaiOverallPct = computed;
                      } else {
                        delete nextFunction.wpaiOverallPct;
                      }
                      return { ...prev, function: nextFunction };
                    });
                  }}
                />
                {renderIssuesForPath("function.wpaiPresenteeismPct")}
              </TermField>
              <TermField termKey="wpai_overall" htmlFor="wpai-overall">
                <Input
                  id="wpai-overall"
                  type="number"
                  min={0}
                  max={100}
                  value={weeklyDraft.function?.wpaiOverallPct ?? ""}
                  readOnly
                />
                {renderIssuesForPath("function.wpaiOverallPct")}
              </TermField>
            </div>
            <div className="rounded-lg border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
              <p className="font-semibold text-rose-800">WPAI-Zusammenfassung</p>
              <p>Fehlzeiten: {wpaiAbsenteeism ?? "–"}%</p>
              <p>Präsenzminderung: {wpaiPresenteeism ?? "–"}%</p>
              <p>Gesamt (Formel): {wpaiOverall ?? "–"}%</p>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" onClick={handleWeeklySubmit}>
                Woche speichern
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  downloadFile(
                    `endo-weekly-${today}.json`,
                    JSON.stringify(weeklyEntries, null, 2),
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
                    `endo-weekly-${today}.csv`,
                    toCsv(
                      weeklyEntries.map((entry) => ({
                        Kalenderwoche: entry.isoWeek,
                        [`${TERMS.wpai_abs.label}`]: entry.function?.wpaiAbsenteeismPct ?? "",
                        [`${TERMS.wpai_pre.label}`]: entry.function?.wpaiPresenteeismPct ?? "",
                        [`${TERMS.wpai_overall.label}`]: entry.function?.wpaiOverallPct ?? "",
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
          <Section title="Verlauf" description="WPAI Gesamtbeeinträchtigung">
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={weeklyEntries} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                  <XAxis dataKey="isoWeek" stroke="#fb7185" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} stroke="#f43f5e" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="function.wpaiOverallPct"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    name={TERMS.wpai_overall.label}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <Section
            title="Monatliche Fragebögen"
            description="Lebensqualität (EHP-5), Stimmung (PHQ-9), Angst (GAD-7) und optionale PROMIS-T-Scores"
            aside={<Calendar size={16} className="text-rose-500" />}
          >
            <div className="grid gap-6">
              <Labeled label="Monat (YYYY-MM)" htmlFor="monthly-month">
                <Input
                  id="monthly-month"
                  type="month"
                  value={monthlyDraft.month}
                  onChange={(event) => setMonthlyDraft((prev) => ({ ...prev, month: event.target.value }))}
                />
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
                  <div className="flex items-center justify-between rounded border border-rose-100 bg-white p-3 text-sm text-rose-700">
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
                  <div className="flex items-center justify-between rounded border border-rose-100 bg-white p-3 text-sm text-rose-700">
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
          <Section title="Verlauf" description="EHP-5 & psychische Scores">
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
        </TabsContent>
      </Tabs>
    </main>
  );
}
