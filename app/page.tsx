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
import { TERMS, type TermKey, type TermDescriptor } from "@/lib/terms";
import {
  validateDailyEntry,
  validateMonthlyEntry,
  validateWeeklyEntry,
  type ValidationIssue,
} from "@/lib/validation";
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

const PBAC_ITEMS = [
  { id: "pad_light", label: "Binde (leicht gefärbt)", score: 1 },
  { id: "pad_medium", label: "Binde (mittel)", score: 5 },
  { id: "pad_heavy", label: "Binde (durchtränkt)", score: 20 },
  { id: "tampon_light", label: "Tampon (leicht)", score: 1 },
  { id: "tampon_medium", label: "Tampon (mittel)", score: 5 },
  { id: "tampon_heavy", label: "Tampon (durchtränkt)", score: 10 },
  { id: "clot_small", label: "Koagel <2 cm", score: 1 },
  { id: "clot_large", label: "Koagel ≥2 cm", score: 5 },
] as const;

type PbacCounts = Record<(typeof PBAC_ITEMS)[number]["id"], number>;

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

function HelpIcon({ text }: { text: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-xs font-semibold text-rose-600"
      role="img"
      aria-label={`Info: ${text}`}
      title={text}
    >
      ⓘ
    </span>
  );
}

function FieldLabel({ termKey, htmlFor }: { termKey: TermKey; htmlFor?: string }) {
  const term: TermDescriptor = TERMS[termKey];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-rose-800">
        {term.label}
      </Label>
      {term.optional && (
        <Badge className="bg-amber-100 text-amber-800">
          {term.deviceNeeded ? `Optional (Hilfsmittel nötig: ${term.deviceNeeded})` : "Optional"}
        </Badge>
      )}
      <HelpIcon text={term.help} />
    </div>
  );
}

function ScoreInput({
  id,
  label,
  termKey,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
}: {
  id: string;
  label: string;
  termKey?: TermKey;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="grid gap-2">
      {termKey ? <FieldLabel termKey={termKey} htmlFor={id} /> : <Label htmlFor={id}>{label}</Label>}
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
    </div>
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

function computePbacScore(counts: PbacCounts) {
  return PBAC_ITEMS.reduce((total, item) => total + counts[item.id] * item.score, 0);
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

  const pbacScore = useMemo(() => computePbacScore(pbacCounts), [pbacCounts]);

  useEffect(() => {
    if (dailyDraft.bleeding.isBleeding) {
      setDailyDraft((prev) => ({
        ...prev,
        bleeding: { ...prev.bleeding, pbacScore, clots: prev.bleeding.clots ?? false },
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

  const handleDailySubmit = () => {
    const payload: DailyEntry = {
      ...dailyDraft,
      painQuality: dailyDraft.painQuality,
      bleeding: dailyDraft.bleeding.isBleeding
        ? { ...dailyDraft.bleeding, pbacScore, clots: dailyDraft.bleeding.clots }
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
    const validationIssues = validateWeeklyEntry(weeklyDraft);
    setIssues(validationIssues);
    if (validationIssues.length) {
      setInfoMessage("WPAI-Eingaben prüfen.");
      return;
    }

    setWeeklyEntries((prev) => {
      const filtered = prev.filter((entry) => entry.isoWeek !== weeklyDraft.isoWeek);
      return [...filtered, weeklyDraft].sort((a, b) => a.isoWeek.localeCompare(b.isoWeek));
    });
    setInfoMessage("WPAI-Werte gespeichert.");
    setWeeklyDraft(createEmptyWeeklyEntry(weeklyDraft.isoWeek));
    setIssues([]);
  };

  const handleMonthlySubmit = () => {
    const validationIssues = validateMonthlyEntry(monthlyDraft);
    setIssues(validationIssues);
    if (validationIssues.length) {
      setInfoMessage("Monatliche Fragebögen prüfen.");
      return;
    }

    setMonthlyEntries((prev) => {
      const filtered = prev.filter((entry) => entry.month !== monthlyDraft.month);
      return [...filtered, monthlyDraft].sort((a, b) => a.month.localeCompare(b.month));
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
    const bucket = new Map<number, { painSum: number; symptomSum: number; count: number; sleepSum: number }>();
    annotatedDailyEntries.forEach(({ entry, cycleDay, symptomAverage }) => {
      if (!cycleDay) return;
      const current = bucket.get(cycleDay) ?? { painSum: 0, symptomSum: 0, count: 0, sleepSum: 0 };
      current.painSum += entry.painNRS;
      current.count += 1;
      if (typeof symptomAverage === "number") {
        current.symptomSum += symptomAverage;
      }
      if (typeof entry.sleep?.quality === "number") {
        current.sleepSum += entry.sleep.quality;
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
                    <div className="grid gap-2">
                      <FieldLabel termKey="painQuality" />
                      <MultiSelectChips
                        options={PAIN_QUALITIES.map((quality) => ({ value: quality, label: quality }))}
                        value={dailyDraft.painQuality}
                        onToggle={(next) =>
                          setDailyDraft((prev) => ({ ...prev, painQuality: next as DailyEntry["painQuality"] }))
                        }
                      />
                      {dailyDraft.painQuality.includes("anders") && (
                        <Input
                          className="mt-2"
                          placeholder="Beschreibe den Schmerz"
                          value={painQualityOther}
                          onChange={(event) => setPainQualityOther(event.target.value)}
                        />
                      )}
                      {dailyDraft.painQuality.map((_, index) => renderIssuesForPath(`painQuality[${index}]`))}
                    </div>
                    <div className="grid gap-2">
                      <FieldLabel termKey="bodyMap" />
                      <BodyMap
                        value={dailyDraft.painMapRegionIds}
                        onChange={(next) => setDailyDraft((prev) => ({ ...prev, painMapRegionIds: next }))}
                      />
                      {renderIssuesForPath("painMapRegionIds")}
                    </div>
                  </div>
                </Section>

                <Section
                  title="Typische Endometriose-Symptome"
                  description="Je Symptom: Ja/Nein plus Stärke auf der 0–10 Skala"
                >
                  <div className="grid gap-4">
                    {SYMPTOM_ITEMS.map((item) => {
                      const symptom = dailyDraft.symptoms[item.key] ?? { present: false };
                      const term = TERMS[item.termKey];
                      return (
                        <div key={item.key} className="rounded-lg border border-rose-100 bg-rose-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-rose-800">{term.label}</p>
                              <HelpIcon text={term.help} />
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

                <Section
                  title={`${TERMS.bleeding_active.label} & ${TERMS.pbac.label}`}
                  description="PBAC nur bei aktiver Blutung – Schritt-für-Schritt"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <FieldLabel termKey="bleeding_active" />
                    <Switch
                      checked={dailyDraft.bleeding.isBleeding}
                      onCheckedChange={(checked) => {
                        setDailyDraft((prev) =>
                          checked
                            ? { ...prev, bleeding: { isBleeding: true, clots: prev.bleeding.clots ?? false, pbacScore } }
                            : { ...prev, bleeding: { isBleeding: false } }
                        );
                        if (!checked) {
                          setPbacCounts({ ...PBAC_DEFAULT_COUNTS });
                          setPbacStep(1);
                        }
                      }}
                    />
                  </div>
                  {dailyDraft.bleeding.isBleeding && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        <span>PBAC-Wizard • Schritt {pbacStep} von 3</span>
                        <span>Score wird automatisch berechnet</span>
                      </div>
                      {pbacStep === 1 && (
                        <div className="space-y-3">
                          <FieldLabel termKey="pbac" />
                          <p className="text-sm text-rose-600">
                            Binden- und Tampon-Größe samt Sättigung: Trage ein, wie viele Produkte du heute genutzt hast.
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {PBAC_ITEMS.map((item) => (
                              <div key={item.id} className="grid gap-1">
                                <Label htmlFor={item.id}>{item.label}</Label>
                                <Input
                                  id={item.id}
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={pbacCounts[item.id]}
                                  onChange={(event) =>
                                    setPbacCounts((prev) => ({
                                      ...prev,
                                      [item.id]: Math.max(0, Math.round(Number(event.target.value) || 0)),
                                    }))
                                  }
                                />
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-end">
                            <Button type="button" onClick={() => setPbacStep(2)}>
                              Weiter zu Koageln
                            </Button>
                          </div>
                        </div>
                      )}
                      {pbacStep === 2 && (
                        <div className="space-y-3">
                          <FieldLabel termKey="clots" />
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={dailyDraft.bleeding.clots ?? false}
                              onCheckedChange={(checked) =>
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  bleeding: { ...prev.bleeding, clots: checked },
                                }))
                              }
                            />
                            <span className="text-sm text-rose-700">Koagel heute beobachtet?</span>
                          </div>
                          <div className="flex justify-between">
                            <Button type="button" variant="ghost" onClick={() => setPbacStep(1)}>
                              Zurück
                            </Button>
                            <Button type="button" onClick={() => setPbacStep(3)}>
                              Score anzeigen
                            </Button>
                          </div>
                        </div>
                      )}
                      {pbacStep === 3 && (
                        <div className="space-y-3">
                          <div className="rounded-lg border border-rose-100 bg-rose-50 p-4">
                            <p className="text-sm font-semibold text-rose-800">PBAC-Score für heute</p>
                            <p className="text-3xl font-bold text-rose-900">{pbacScore}</p>
                            <p className="mt-2 text-xs text-rose-600">
                              Richtwerte: ≥100 weist auf starke Blutung hin – besprich Auffälligkeiten mit deinem Behandlungsteam.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-rose-700">
                            {PBAC_ITEMS.filter((item) => pbacCounts[item.id] > 0).map((item) => (
                              <span key={item.id} className="rounded bg-white px-2 py-1">
                                {pbacCounts[item.id]} × {item.label}
                              </span>
                            ))}
                          </div>
                          <div className="flex justify-between">
                            <Button type="button" variant="ghost" onClick={() => setPbacStep(2)}>
                              Zurück
                            </Button>
                            <Button type="button" onClick={() => setPbacStep(1)}>
                              Anpassen
                            </Button>
                          </div>
                        </div>
                      )}
                      {renderIssuesForPath("bleeding.pbacScore")}
                      {renderIssuesForPath("bleeding.clots")}
                    </div>
                  )}
                </Section>

                <Section title={TERMS.meds.label} description="Eingenommene Medikamente & Hilfen des Tages">
                  <div className="grid gap-4">
                    <FieldLabel termKey="meds" />
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
                      <FieldLabel termKey="rescue" htmlFor="rescue-count" />
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
                    </div>
                  </div>
                </Section>

                <Section title="Schlaf" description="Kurzabfrage ohne Hilfsmittel">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <FieldLabel termKey="sleep_hours" htmlFor="sleep-hours" />
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
                    </div>
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
                    <div>
                      <FieldLabel termKey="awakenings" htmlFor="sleep-awakenings" />
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
                    </div>
                  </div>
                </Section>

                <Section title="Darm & Blase" description="Situativ erfassbar">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
                      <p className="font-medium text-rose-800">Darm</p>
                      <div>
                        <FieldLabel termKey="bristol" />
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
                      </div>
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
                      <div className="grid gap-2">
                        <FieldLabel termKey="urinary_freq" htmlFor="urinary-frequency" />
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
                      </div>
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
                    <div className="grid gap-2">
                      <FieldLabel termKey="fsfi" htmlFor="fsfi-score" />
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
                    </div>
                  )}
                </Section>

                <Section title="Notizen & Tags" description="Freitext oder wiederkehrende Muster markieren">
                  <div className="grid gap-3">
                    <div className="flex gap-2">
                      <FieldLabel termKey="notesTags" htmlFor="notes-tag-input" />
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
                    <FieldLabel termKey="notesFree" htmlFor="notes-free" />
                    <Textarea
                      id="notes-free"
                      placeholder="Freitextnotizen"
                      value={dailyDraft.notesFree ?? ""}
                      onChange={(event) => setDailyDraft((prev) => ({ ...prev, notesFree: event.target.value }))}
                    />
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
                          <FieldLabel termKey="opk_done" />
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
                              <FieldLabel termKey="opk_positive" />
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
                        <div>
                          <FieldLabel termKey="bbt" />
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
                        </div>
                      </div>

                      <div className="grid gap-2 rounded-lg border border-rose-100 bg-rose-50 p-4">
                        <p className="font-medium text-rose-800">Aktivität (Wearable/Smartphone)</p>
                        <div className="grid gap-2 md:grid-cols-2">
                          <div>
                            <FieldLabel termKey="steps" htmlFor="activity-steps" />
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
                          </div>
                          <div>
                            <FieldLabel termKey="activeMinutes" htmlFor="activity-minutes" />
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
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2 rounded-lg border border-rose-100 bg-rose-50 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-rose-800">{TERMS.hrv.label}</p>
                            <HelpIcon text={TERMS.hrv.help} />
                            <Badge className="bg-amber-100 text-amber-800">Optional (Hilfsmittel nötig: {TERMS.hrv.deviceNeeded})</Badge>
                          </div>
                          <Switch checked={exploratoryVisible} onCheckedChange={setExploratoryVisible} />
                        </div>
                        <p className="text-xs text-rose-600">
                          HRV nur explorativ, kein Schmerzsurrogat. Wird nicht in Kerntrends angezeigt.
                        </p>
                        {exploratoryVisible && (
                          <div>
                            <FieldLabel termKey="hrv" />
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
                          </div>
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
              <div className="grid gap-2">
                <Label>Kalenderwoche (ISO)</Label>
                <Input
                  value={weeklyDraft.isoWeek}
                  onChange={(event) => setWeeklyDraft((prev) => ({ ...prev, isoWeek: event.target.value }))}
                />
                {renderIssuesForPath("isoWeek")}
              </div>
              <div className="grid gap-2">
                <FieldLabel termKey="wpai_abs" htmlFor="wpai-abs" />
                <Input
                  id="wpai-abs"
                  type="number"
                  min={0}
                  max={100}
                  value={weeklyDraft.function?.wpaiAbsenteeismPct ?? ""}
                  onChange={(event) =>
                    setWeeklyDraft((prev) => ({
                      ...prev,
                      function: {
                        ...(prev.function ?? {}),
                        wpaiAbsenteeismPct: event.target.value ? Number(event.target.value) : undefined,
                      },
                    }))
                  }
                />
                {renderIssuesForPath("function.wpaiAbsenteeismPct")}
              </div>
              <div className="grid gap-2">
                <FieldLabel termKey="wpai_pre" htmlFor="wpai-pre" />
                <Input
                  id="wpai-pre"
                  type="number"
                  min={0}
                  max={100}
                  value={weeklyDraft.function?.wpaiPresenteeismPct ?? ""}
                  onChange={(event) =>
                    setWeeklyDraft((prev) => ({
                      ...prev,
                      function: {
                        ...(prev.function ?? {}),
                        wpaiPresenteeismPct: event.target.value ? Number(event.target.value) : undefined,
                      },
                    }))
                  }
                />
                {renderIssuesForPath("function.wpaiPresenteeismPct")}
              </div>
              <div className="grid gap-2">
                <FieldLabel termKey="wpai_overall" htmlFor="wpai-overall" />
                <Input
                  id="wpai-overall"
                  type="number"
                  min={0}
                  max={100}
                  value={weeklyDraft.function?.wpaiOverallPct ?? ""}
                  onChange={(event) =>
                    setWeeklyDraft((prev) => ({
                      ...prev,
                      function: {
                        ...(prev.function ?? {}),
                        wpaiOverallPct: event.target.value ? Number(event.target.value) : undefined,
                      },
                    }))
                  }
                />
                {renderIssuesForPath("function.wpaiOverallPct")}
              </div>
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
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Monat (YYYY-MM)</Label>
                <Input
                  value={monthlyDraft.month}
                  onChange={(event) => setMonthlyDraft((prev) => ({ ...prev, month: event.target.value }))}
                />
                {renderIssuesForPath("month")}
              </div>
              <div>
                <FieldLabel termKey="ehp5" htmlFor="ehp5-total" />
                <Input
                  id="ehp5-total"
                  type="number"
                  min={0}
                  value={monthlyDraft.qol?.ehp5Total ?? ""}
                  onChange={(event) =>
                    setMonthlyDraft((prev) => ({
                      ...prev,
                      qol: { ...(prev.qol ?? {}), ehp5Total: event.target.value ? Number(event.target.value) : undefined },
                    }))
                  }
                />
                {renderIssuesForPath("qol.ehp5Total")}
              </div>
              <div>
                <FieldLabel termKey="phq9" htmlFor="phq9-score" />
                <Input
                  id="phq9-score"
                  type="number"
                  min={0}
                  max={27}
                  value={monthlyDraft.mental?.phq9 ?? ""}
                  onChange={(event) =>
                    setMonthlyDraft((prev) => ({
                      ...prev,
                      mental: { ...(prev.mental ?? {}), phq9: event.target.value ? Number(event.target.value) : undefined },
                    }))
                  }
                />
                {renderIssuesForPath("mental.phq9")}
              </div>
              <div>
                <FieldLabel termKey="gad7" htmlFor="gad7-score" />
                <Input
                  id="gad7-score"
                  type="number"
                  min={0}
                  max={21}
                  value={monthlyDraft.mental?.gad7 ?? ""}
                  onChange={(event) =>
                    setMonthlyDraft((prev) => ({
                      ...prev,
                      mental: { ...(prev.mental ?? {}), gad7: event.target.value ? Number(event.target.value) : undefined },
                    }))
                  }
                />
                {renderIssuesForPath("mental.gad7")}
              </div>
              <div>
                <FieldLabel termKey="promis_fatigue" htmlFor="promis-fatigue" />
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
              </div>
              <div>
                <FieldLabel termKey="promis_painInt" htmlFor="promis-pain" />
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
                        [`${TERMS.ehp5.label}`]: entry.qol?.ehp5Total ?? "",
                        [`${TERMS.phq9.label}`]: entry.mental?.phq9 ?? "",
                        [`${TERMS.gad7.label}`]: entry.mental?.gad7 ?? "",
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
