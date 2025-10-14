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
} from "recharts";
import type { TooltipProps } from "recharts";
import { Calendar, Download, Upload } from "lucide-react";

import { DailyEntry, MonthlyEntry, WeeklyEntry } from "@/lib/types";
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

const SYMPTOM_ITEMS: { key: SymptomKey; label: string; description?: string }[] = [
  { key: "dysmenorrhea", label: "Dysmenorrhoe" },
  { key: "deepDyspareunia", label: "Tiefer Dyspareunie-Schmerz" },
  { key: "pelvicPainNonMenses", label: "Beckenschmerz außerhalb der Menstruation" },
  { key: "dyschezia", label: "Dyschezie" },
  { key: "dysuria", label: "Dysurie" },
  { key: "fatigue", label: "Fatigue" },
  { key: "bloating", label: "Bloating" },
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
      <Label htmlFor={id}>{label}</Label>
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
export default function HomePage() {
  const today = formatDate(new Date());
  const [dailyEntries, setDailyEntries] = useLocalStorageState<DailyEntry[]>("endo.daily.v2", []);
  const [weeklyEntries, setWeeklyEntries] = useLocalStorageState<WeeklyEntry[]>("endo.weekly.v2", []);
  const [monthlyEntries, setMonthlyEntries] = useLocalStorageState<MonthlyEntry[]>("endo.monthly.v2", []);

  const [dailyDraft, setDailyDraft] = useState<DailyEntry>(() => createEmptyDailyEntry(today));
  const [pbacCounts, setPbacCounts] = useState<PbacCounts>({ ...PBAC_DEFAULT_COUNTS });
  const [fsfiOptIn, setFsfiOptIn] = useState(false);
  const [sensorsVisible, setSensorsVisible] = useState(false);
  const [exploratoryVisible, setExploratoryVisible] = useState(false);
  const [notesTagDraft, setNotesTagDraft] = useState("");
  const [painQualityOther, setPainQualityOther] = useState("");

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

  const painTrendData = useMemo(
    () =>
      dailyEntries
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((entry) => ({
          date: entry.date,
          pain: entry.painNRS,
          pbac: entry.bleeding.pbacScore ?? 0,
          sleep: entry.sleep?.quality ?? null,
        })),
    [dailyEntries]
  );

  const renderIssuesForPath = (path: string) =>
    issues.filter((issue) => issue.path === path).map((issue) => (
      <p key={issue.message} className="text-xs text-rose-600">
        {issue.message}
      </p>
    ));

  const optionalSensorsLabel = sensorsVisible ? "Optional (Hilfsmittel) ausblenden" : "Optional (Hilfsmittel) einblenden";

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-rose-900">Endometriose Symptomtracker</h1>
        <p className="text-sm text-rose-700">
          Kernmetriken ohne Hilfsmittel, optionale Sensorfelder nur auf Wunsch. Daten werden lokal gespeichert.
        </p>
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

                <Section title="Schmerzintensität" description="Numerical Rating Scale (0–10, ganze Zahlen)">
                  <ScoreInput
                    id="pain-nrs"
                    label="Schmerzstärke"
                    value={dailyDraft.painNRS}
                    onChange={(value) =>
                      setDailyDraft((prev) => ({ ...prev, painNRS: Math.max(0, Math.min(10, Math.round(value))) }))
                    }
                  />
                  {renderIssuesForPath("painNRS")}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Schmerzcharakter</Label>
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
                          placeholder="Bitte Schmerzqualität beschreiben"
                          value={painQualityOther}
                          onChange={(event) => setPainQualityOther(event.target.value)}
                        />
                      )}
                      {dailyDraft.painQuality.map((quality, index) => renderIssuesForPath(`painQuality[${index}]`))}
                    </div>
                    <div className="grid gap-2">
                      <Label>Schmerzorte (Body-Map)</Label>
                      <BodyMap
                        value={dailyDraft.painMapRegionIds}
                        onChange={(next) => setDailyDraft((prev) => ({ ...prev, painMapRegionIds: next }))}
                      />
                      {renderIssuesForPath("painMapRegionIds")}
                    </div>
                  </div>
                </Section>

                <Section title="Typische Endo-Symptome" description="Jeweils Ja/Nein und Score 0–10">
                  <div className="grid gap-4">
                    {SYMPTOM_ITEMS.map((item) => {
                      const symptom = dailyDraft.symptoms[item.key] ?? { present: false };
                      return (
                        <div key={item.key} className="rounded-lg border border-rose-100 bg-rose-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-rose-800">{item.label}</p>
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
                                label="Schweregrad (0–10)"
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

                <Section title="Blutung" description="PBAC nur bei aktiver Blutung">
                  <div className="flex items-center gap-3">
                    <Label>Aktive Blutung</Label>
                    <Switch
                      checked={dailyDraft.bleeding.isBleeding}
                      onCheckedChange={(checked) => {
                        setDailyDraft((prev) => ({
                          ...prev,
                          bleeding: checked
                            ? { isBleeding: true, clots: prev.bleeding.clots ?? false, pbacScore }
                            : { isBleeding: false },
                        }));
                        if (!checked) {
                          setPbacCounts({ ...PBAC_DEFAULT_COUNTS });
                        }
                      }}
                    />
                  </div>

                  {dailyDraft.bleeding.isBleeding && (
                    <div className="grid gap-4">
                      <p className="text-sm text-rose-700">
                        PBAC-Miniwizard: Anzahl pro Tag eingeben, Score berechnet automatisch.
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
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium text-rose-700">PBAC-Score</Label>
                        <span className="text-lg font-semibold text-rose-900">{pbacScore}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={dailyDraft.bleeding.clots ?? false}
                          onCheckedChange={(checked) =>
                            setDailyDraft((prev) => ({
                              ...prev,
                              bleeding: { ...prev.bleeding, clots: checked },
                            }))
                          }
                        />
                        <span className="text-sm text-rose-700">Koagel beobachtet</span>
                      </div>
                      {renderIssuesForPath("bleeding.pbacScore")}
                    </div>
                  )}
                  {renderIssuesForPath("bleeding.clots")}
                </Section>

                <Section title="Medikation & Selbsthilfen" description="Tagesbezogen dokumentieren">
                  <div className="grid gap-4">
                    {dailyDraft.meds.map((med, index) => (
                      <div key={index} className="grid gap-2 rounded-lg border border-rose-100 bg-rose-50 p-4">
                        <div className="grid gap-1">
                          <Label>Präparat</Label>
                          <Input
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
                            <Label>Dosis (mg)</Label>
                            <Input
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
                            <Label>Einnahmezeiten (HH:MM, kommasepariert)</Label>
                            <Input
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
                      + Medikament hinzufügen
                    </Button>
                    <div className="grid gap-1">
                      <Label>Akut-/Rescue-Dosen heute</Label>
                      <Input
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

                <Section title="Schlaf" description="optional, ohne Hilfsmittel">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label>Schlafdauer (h)</Label>
                      <Input
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
                        label="Schlafqualität"
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
                      <Label>Aufwachphasen</Label>
                      <Input
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
                        <Label>Bristol-Stuhlform</Label>
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
                        label="Darm-Schmerz"
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
                        <Label>Miktionen / Tag</Label>
                        <Input
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
                        label="Harndrang"
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
                        label="Schmerz beim Wasserlassen"
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

                <Section title="Sexualfunktion (sensibles Opt-in)" description="FSFI nur bei aktivem Opt-in">
                  <div className="flex items-center gap-3">
                    <Switch checked={fsfiOptIn} onCheckedChange={setFsfiOptIn} />
                    <span className="text-sm text-rose-700">
                      FSFI-Eingabe aktivieren (Werte werden separat gespeichert)
                    </span>
                  </div>
                  {fsfiOptIn && (
                    <div className="grid gap-2">
                      <Label>FSFI / FSFI-6 Gesamtscore</Label>
                      <Input
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
                      <Input
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
                    <Textarea
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
                          <Label>LH-Test durchgeführt</Label>
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
                              <Label>Positiv</Label>
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
                          <Label>Basaltemperatur (°C, morgens nüchtern)</Label>
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
                            <Label>Schritte</Label>
                            <Input
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
                            <Label>Aktivminuten</Label>
                            <Input
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
                          <p className="font-medium text-rose-800">HRV (Explorativ)</p>
                          <Switch checked={exploratoryVisible} onCheckedChange={setExploratoryVisible} />
                        </div>
                        <p className="text-xs text-rose-600">
                          HRV nur explorativ, kein Schmerzsurrogat. Wird nicht in Kerntrends angezeigt.
                        </p>
                        {exploratoryVisible && (
                          <div>
                            <Label>RMSSD (ms)</Label>
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
                            date: entry.date,
                            painNRS: entry.painNRS,
                            painQuality: entry.painQuality.join(";"),
                            painMapRegionIds: entry.painMapRegionIds.join(";"),
                            pbacScore: entry.bleeding.pbacScore ?? "",
                            dysmenorrheaScore: entry.symptoms.dysmenorrhea?.score ?? "",
                            fatigueScore: entry.symptoms.fatigue?.score ?? "",
                            sleepQuality: entry.sleep?.quality ?? "",
                            urinaryPain: entry.urinary?.pain ?? "",
                          }))
                        ),
                        "text/csv"
                      )
                    }
                  >
                    <Download size={16} className="mr-2" /> CSV Export
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <Section title="Trend" description="Schmerz NRS & PBAC (Kernmetriken)">
                  <div className="h-64 w-full">
                    <ResponsiveContainer>
                      <LineChart data={painTrendData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                        <XAxis dataKey="date" stroke="#fb7185" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="left" domain={[0, 10]} stroke="#f43f5e" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" stroke="#6366f1" tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="pain" stroke="#f43f5e" strokeWidth={2} yAxisId="left" />
                        <Line type="monotone" dataKey="pbac" stroke="#6366f1" strokeWidth={2} yAxisId="right" />
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
              </div>
            </div>
          </Section>
        </TabsContent>
        <TabsContent value="weekly" className="space-y-6">
          <Section
            title="WPAI (7-Tage-Rückblick)"
            description="Prozentwerte für Absenz, Präsenzminderung, Gesamtbeeinträchtigung"
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
                <Label>Absenz (%)</Label>
                <Input
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
                <Label>Präsenzminderung (%)</Label>
                <Input
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
                <Label>Gesamtbeeinträchtigung (%)</Label>
                <Input
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
                  <Line type="monotone" dataKey="function.wpaiOverallPct" stroke="#f43f5e" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <Section
            title="Monatliche Fragebögen"
            description="EHP-5, PHQ-9, GAD-7, optional PROMIS Short Forms"
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
                <Label>EHP-5 Gesamtscore</Label>
                <Input
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
                <Label>PHQ-9</Label>
                <Input
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
                <Label>GAD-7</Label>
                <Input
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
                <Label>PROMIS Fatigue T-Score (optional)</Label>
                <Input
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
                <Label>PROMIS Pain Interference T-Score (optional)</Label>
                <Input
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
                  <Line type="monotone" dataKey="ehp5" stroke="#f43f5e" strokeWidth={2} />
                  <Line type="monotone" dataKey="phq9" stroke="#6366f1" strokeWidth={2} />
                  <Line type="monotone" dataKey="gad7" stroke="#22c55e" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </main>
  );
}
