"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Calendar, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

const DEFAULT_LOCATIONS = [
  "Unterbauch li.",
  "Unterbauch re.",
  "Uterus",
  "Kreuzbein",
  "Rektal",
  "Vaginal",
  "Oberschenkel",
];
const PAIN_TYPES = ["krampfartig", "stechend", "dumpf", "brennend", "ziehend"];
const BLEEDING_LEVELS = ["keine", "Spotting", "leicht", "mittel", "stark"];
const SEVERITY = ["keine", "leicht", "mittel", "stark"];
const TRIGGERS = [
  "Stress",
  "Ovulation",
  "Periode",
  "Belastung",
  "Kälte",
  "Lebensmittel",
  "Koffein",
  "Milch",
  "Gluten",
  "Alkohol",
  "Schlafmangel",
];
const NON_PHARM = ["Wärme", "Ruhe", "Dehnen/Yoga", "TENS", "Spaziergang", "Ernährung"];

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromDateKey = (s: string) => new Date(`${s}T00:00:00`);
const uniq = (arr: string[]) => Array.from(new Set(arr));
const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0);

function loadLS<T>(key: string, fb: T): T {
  try {
    if (typeof window === "undefined") return fb;
    const r = window.localStorage.getItem(key);
    return r ? JSON.parse(r) : fb;
  } catch {
    return fb;
  }
}

function saveLS(key: string, v: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(v));
}

function emptyEntry(dateKey: string) {
  return {
    date: dateKey,
    pain: { score: 0, locations: [], types: [], durationH: 0 },
    bleeding: { level: "keine", clots: false },
    gi: { bloating: 0, constipation: 0, diarrhea: 0, nausea: 0, rectalPain: 0 },
    urinary: { frequency: 0, urgency: 0, dysuria: 0 },
    fatigue: 0,
    mood: 0,
    dyspareunia: 0,
    sleep: 3,
    meds: [],
    nonPharm: [],
    triggers: [],
    workImpact: { missed: false, reducedHours: 0 },
    cycle: { periodStart: false, cycleDay: undefined },
    note: "",
  } as const;
}

function usePersistentState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(initial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setState(loadLS(key, initial));
  }, [key, initial]);

  useEffect(() => {
    saveLS(key, state);
  }, [key, state]);

  return [state, setState] as const;
}

function computeCycleDay(dateKey: string, starts: string[]) {
  const d = fromDateKey(dateKey);
  const past = starts
    .map(fromDateKey)
    .filter((x) => x <= d)
    .sort((a, b) => b.getTime() - a.getTime());
  if (!past.length) return undefined;
  const diff = (d.getTime() - past[0].getTime()) / 86400000;
  return Math.round(diff) + 1;
}

function withinMonth(dateKey: string, y: number, m: number) {
  const d = fromDateKey(dateKey);
  return d.getFullYear() === y && d.getMonth() + 1 === m;
}

function monthBounds(y: number, m: number) {
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

function monthLabel(y: number, m: number) {
  return new Date(y, m - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function computeMonthlyStats(entries: any[], y: number, m: number) {
  const data = entries.filter((e) => withinMonth(e.date, y, m));
  const pains = data.map((e) => Number(e.pain?.score || 0));
  const sums = {
    daysTracked: data.length,
    avgPain: avg(pains),
    maxPain: Math.max(0, ...pains),
    flareDays: data.filter((e) => (e.pain?.score || 0) >= 6).length,
  };
  const by = { loc: {} as Record<string, number>, trig: {} as Record<string, number>, med: {} as Record<string, number[]> };
  data.forEach((e) => {
    (e.pain?.locations || []).forEach((l: string) => (by.loc[l] = (by.loc[l] || 0) + 1));
    (e.triggers || []).forEach((t: string) => (by.trig[t] = (by.trig[t] || 0) + 1));
    (e.meds || []).forEach((mEntry: any) => {
      if (!mEntry.name) return;
      (by.med[mEntry.name] = by.med[mEntry.name] || []).push(Number(mEntry.relief || 0));
    });
  });
  const medReliefAvg = Object.entries(by.med).map(([name, arr]) => ({ name, value: avg(arr as number[]) }));
  return {
    ...sums,
    byLocation: Object.entries(by.loc).map(([name, count]) => ({ name, count })),
    byTrigger: Object.entries(by.trig).map(([name, count]) => ({ name, count })),
    medReliefAvg,
    raw: data,
  };
}

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <Card className="border border-zinc-200 bg-white shadow-sm rounded-2xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-semibold text-zinc-900 text-base">{title}</CardTitle>
          {aside}
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function Chip({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm border ${
        active ? "bg-rose-100 border-rose-300 text-rose-800" : "bg-white border-zinc-200 text-zinc-700"
      } hover:border-rose-400 transition`}
    >
      {label}
    </button>
  );
}

function SeverityPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {SEVERITY.map((l, i) => (
        <Chip key={l} label={l} active={value === i} onClick={() => onChange(i)} />
      ))}
    </div>
  );
}

function MultiSelectChips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    const s = new Set(value || []);
    s.has(opt) ? s.delete(opt) : s.add(opt);
    onChange(Array.from(s));
  };
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((o) => (
        <Chip key={o} label={o} active={(value || []).includes(o)} onClick={() => toggle(o)} />
      ))}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-28"
        />
        {suffix && <span className="text-sm text-zinc-600">{suffix}</span>}
      </div>
    </div>
  );
}

export default function EndoTrackApp() {
  const [entries, setEntries] = usePersistentState<any[]>("endo.entries", []);
  const [periodStarts, setPeriodStarts] = usePersistentState<string[]>("endo.periodStarts", []);
  const [highContrast, setHighContrast] = usePersistentState<boolean>("endo.highContrast", true);
  const [accent, setAccent] = usePersistentState<string>("endo.accent", "rose");

  const today = useMemo(() => toDateKey(new Date()), []);
  const [activeDate, setActiveDate] = useState<string>(today);
  const current = useMemo(
    () => entries.find((e) => e.date === activeDate) || emptyEntry(activeDate),
    [entries, activeDate]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty(
      "--endo-accent",
      accent === "rose" ? "#e11d48" : accent === "violet" ? "#7c3aed" : "#0891b2"
    );
    document.documentElement.style.setProperty("--endo-bg", highContrast ? "#fff1f2" : "#fff7f7");
  }, [accent, highContrast]);

  function upsertEntry(next: any) {
    setEntries((prev) => {
      const i = prev.findIndex((e) => e.date === next.date);
      const arr = [...prev];
      if (i >= 0) arr[i] = next;
      else arr.push(next);
      return arr.sort((a, b) => (a.date < b.date ? -1 : 1));
    });
  }

  function saveCurrent(partial: any) {
    const merged = { ...current, ...partial };
    merged.cycle = {
      ...merged.cycle,
      cycleDay: computeCycleDay(merged.date, periodStarts),
    };
    upsertEntry(merged);
  }

  function addMed() {
    const meds = [...(current.meds || [])];
    meds.push({ name: "", dose: "", relief: 0 });
    saveCurrent({ meds });
  }

  function updateMed(i: number, patch: any) {
    const meds = [...(current.meds || [])];
    meds[i] = { ...meds[i], ...patch };
    saveCurrent({ meds });
  }

  function removeMed(i: number) {
    const meds = [...(current.meds || [])];
    meds.splice(i, 1);
    saveCurrent({ meds });
  }

  function markPeriodStart(dateKey: string) {
    const set = uniq([...(periodStarts || []), dateKey]).sort();
    setPeriodStarts(set);
    if (dateKey === current.date)
      saveCurrent({ cycle: { ...current.cycle, periodStart: true } });
  }

  function clearDay(dateKey: string) {
    setEntries((prev) => prev.filter((e) => e.date !== dateKey));
  }

  const [repYear, setRepYear] = useState<number>(new Date().getFullYear());
  const [repMonth, setRepMonth] = useState<number>(new Date().getMonth() + 1);
  const stats = useMemo(() => computeMonthlyStats(entries, repYear, repMonth), [entries, repYear, repMonth]);
  const painSeries = useMemo(() => {
    const { start, end } = monthBounds(repYear, repMonth);
    const days: any[] = [];
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const key = toDateKey(d);
      const entry = entries.find((x) => x.date === key);
      days.push({ date: key.slice(-2), Schmerz: entry ? Number(entry.pain?.score || 0) : 0 });
    }
    return days;
  }, [entries, repYear, repMonth]);

  function exportData() {
    if (typeof document === "undefined") return;
    const blob = new Blob([JSON.stringify({ entries, periodStarts }, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "endo-data.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importData(file: File) {
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      try {
        const content = event.target?.result;
        if (!content || typeof content !== "string") return;
        const parsed = JSON.parse(content);
        if (parsed.entries) setEntries(parsed.entries);
        if (parsed.periodStarts) setPeriodStarts(parsed.periodStarts);
      } catch (err: any) {
        alert("Import fehlgeschlagen: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  const copyReport = () => {
    const text = makeTextReport(stats, repYear, repMonth);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
  };

  return (
    <div className="bg-rose-50 min-h-[100dvh] text-zinc-900">
      <style>{`.accent{color:var(--endo-accent)} .accent-bg{background:var(--endo-accent)}`}</style>
      <div className="max-w-screen-sm mx-auto p-4 pb-24">
        <header className="sticky top-0 z-40 bg-rose-50/90 border-b border-rose-100 mb-4">
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">EndoTrack</h1>
              <p className="text-xs text-rose-700/80">Minimalistisches Endometriose‑Tracking</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={exportData} aria-label="Daten exportieren">
                <Download className="h-4 w-4" />
              </Button>
              <label className="cursor-pointer" aria-label="Daten importieren">
                <Upload className="h-4 w-4" />
                <input
                  type="file"
                  accept="application/json"
                  onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="px-4 pb-2">
            <Tabs defaultValue="today" className="w-full">
              <TabsList className="grid grid-cols-4">
                <TabsTrigger value="today">Heute</TabsTrigger>
                <TabsTrigger value="history">Verlauf</TabsTrigger>
                <TabsTrigger value="report">Report</TabsTrigger>
                <TabsTrigger value="settings">Einstellungen</TabsTrigger>
              </TabsList>

              <TabsContent value="today" className="mt-3">
                <div className="grid gap-3">
                  <Section
                    title="Datum & Zyklus"
                    aside={
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-rose-700" />
                        <Input type="date" value={activeDate} onChange={(e) => setActiveDate(e.target.value)} className="h-8" />
                      </div>
                    }
                  >
                    <div className="grid sm:grid-cols-3 gap-3 items-end">
                      <div className="grid gap-1">
                        <Label>Zyklustag</Label>
                        <Input readOnly value={computeCycleDay(activeDate, periodStarts) || "—"} className="h-9" />
                      </div>
                      <div className="grid gap-1">
                        <Label>Periode startete heute?</Label>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={current.cycle?.periodStart || false}
                            onCheckedChange={(v) => {
                              saveCurrent({ cycle: { ...current.cycle, periodStart: v } });
                              if (v) markPeriodStart(activeDate);
                            }}
                          />
                          <Button size="sm" variant="secondary" onClick={() => markPeriodStart(activeDate)}>
                            Starttag
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <Label>Notiz</Label>
                        <Input
                          value={current.note || ""}
                          onChange={(e) => saveCurrent({ note: e.target.value })}
                          placeholder="Freitext (optional)"
                        />
                      </div>
                    </div>
                  </Section>

                  <Section title="Schmerz (0–10)">
                    <div className="grid gap-3">
                      <div className="flex items-center gap-4">
                        <div className="w-full">
                          <Slider
                            value={[Number(current.pain?.score || 0)]}
                            max={10}
                            step={1}
                            onValueChange={([v]) => saveCurrent({ pain: { ...current.pain, score: v } })}
                          />
                        </div>
                        <div className="w-12 text-center text-lg font-semibold">{current.pain?.score || 0}</div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Schmerzorte</Label>
                        <MultiSelectChips
                          options={DEFAULT_LOCATIONS}
                          value={current.pain?.locations || []}
                          onChange={(v) => saveCurrent({ pain: { ...current.pain, locations: v } })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Art</Label>
                        <MultiSelectChips
                          options={PAIN_TYPES}
                          value={current.pain?.types || []}
                          onChange={(v) => saveCurrent({ pain: { ...current.pain, types: v } })}
                        />
                      </div>
                      <NumberField
                        id="duration"
                        label="Dauer (Std.)"
                        value={current.pain?.durationH || 0}
                        onChange={(v) => saveCurrent({ pain: { ...current.pain, durationH: v } })}
                        min={0}
                        max={24}
                      />
                    </div>
                  </Section>

                  <Section title="Blutung">
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="grid gap-1">
                        <Label>Stärke</Label>
                        <Select
                          value={current.bleeding?.level}
                          onValueChange={(v) => saveCurrent({ bleeding: { ...current.bleeding, level: v } })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Wählen…" />
                          </SelectTrigger>
                          <SelectContent>
                            {BLEEDING_LEVELS.map((l) => (
                              <SelectItem key={l} value={l}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1">
                        <Label>Koagel</Label>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={current.bleeding?.clots || false}
                            onCheckedChange={(v) => saveCurrent({ bleeding: { ...current.bleeding, clots: v } })}
                          />
                          <span className="text-sm text-zinc-600">ja/nein</span>
                        </div>
                      </div>
                    </div>
                  </Section>

                  <Section title="Magen‑Darm & Harnwege">
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="grid gap-1">
                        <Label>Blähbauch</Label>
                        <SeverityPicker
                          value={current.gi?.bloating || 0}
                          onChange={(v) => saveCurrent({ gi: { ...current.gi, bloating: v } })}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label>Verstopfung</Label>
                        <SeverityPicker
                          value={current.gi?.constipation || 0}
                          onChange={(v) => saveCurrent({ gi: { ...current.gi, constipation: v } })}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label>Durchfall</Label>
                        <SeverityPicker
                          value={current.gi?.diarrhea || 0}
                          onChange={(v) => saveCurrent({ gi: { ...current.gi, diarrhea: v } })}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label>Übelkeit</Label>
                        <SeverityPicker
                          value={current.gi?.nausea || 0}
                          onChange={(v) => saveCurrent({ gi: { ...current.gi, nausea: v } })}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label>Rektaler Schmerz</Label>
                        <SeverityPicker
                          value={current.gi?.rectalPain || 0}
                          onChange={(v) => saveCurrent({ gi: { ...current.gi, rectalPain: v } })}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label>Häufigkeit</Label>
                        <SeverityPicker
                          value={current.urinary?.frequency || 0}
                          onChange={(v) => saveCurrent({ urinary: { ...current.urinary, frequency: v } })}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label>Drang</Label>
                        <SeverityPicker
                          value={current.urinary?.urgency || 0}
                          onChange={(v) => saveCurrent({ urinary: { ...current.urinary, urgency: v } })}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label>Dysurie</Label>
                        <SeverityPicker
                          value={current.urinary?.dysuria || 0}
                          onChange={(v) => saveCurrent({ urinary: { ...current.urinary, dysuria: v } })}
                        />
                      </div>
                    </div>
                  </Section>

                  <Section title="Alltag & Maßnahmen">
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="grid gap-1">
                        <Label>Müdigkeit</Label>
                        <SeverityPicker value={current.fatigue || 0} onChange={(v) => saveCurrent({ fatigue: v })} />
                      </div>
                      <div className="grid gap-1">
                        <Label>Stimmung</Label>
                        <Select value={String(current.mood || 0)} onValueChange={(v) => saveCurrent({ mood: Number(v) })}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Auswahl" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="-2">sehr schlecht</SelectItem>
                            <SelectItem value="-1">schlecht</SelectItem>
                            <SelectItem value="0">neutral</SelectItem>
                            <SelectItem value="1">gut</SelectItem>
                            <SelectItem value="2">sehr gut</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1">
                        <Label>Dyspareunie</Label>
                        <SeverityPicker value={current.dyspareunia || 0} onChange={(v) => saveCurrent({ dyspareunia: v })} />
                      </div>
                      <div className="grid gap-1">
                        <Label>Schlaf (1–5)</Label>
                        <NumberField id="sleep" value={current.sleep || 3} min={1} max={5} onChange={(v) => saveCurrent({ sleep: v })} />
                      </div>
                      <div className="grid gap-1">
                        <Label>Auslöser</Label>
                        <MultiSelectChips options={TRIGGERS} value={current.triggers || []} onChange={(v) => saveCurrent({ triggers: v })} />
                      </div>
                      <div className="grid gap-1">
                        <Label>Nicht‑medikamentös</Label>
                        <MultiSelectChips options={NON_PHARM} value={current.nonPharm || []} onChange={(v) => saveCurrent({ nonPharm: v })} />
                      </div>
                    </div>
                  </Section>

                  <Section title="Medikamente & Wirkung" aside={<Button size="sm" onClick={addMed}>+ Hinzufügen</Button>}>
                    <div className="grid gap-3">
                      {(current.meds || []).length === 0 && <p className="text-sm text-zinc-600">Noch keine Einträge.</p>}
                      {(current.meds || []).map((m: any, i: number) => (
                        <div key={i} className="grid sm:grid-cols-12 gap-2 items-end">
                          <div className="sm:col-span-4 grid gap-1">
                            <Label>Name</Label>
                            <Input
                              value={m.name}
                              onChange={(e) => updateMed(i, { name: e.target.value })}
                              placeholder="z.B. Ibuprofen"
                            />
                          </div>
                          <div className="sm:col-span-3 grid gap-1">
                            <Label>Dosis</Label>
                            <Input
                              value={m.dose || ""}
                              onChange={(e) => updateMed(i, { dose: e.target.value })}
                              placeholder="mg / Zeitpunkt"
                            />
                          </div>
                          <div className="sm:col-span-4 grid gap-1">
                            <Label>Erleichterung (%)</Label>
                            <Slider
                              value={[Number(m.relief || 0)]}
                              max={100}
                              step={5}
                              onValueChange={([v]) => updateMed(i, { relief: v })}
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <Button variant="ghost" size="sm" onClick={() => removeMed(i)}>
                              Entf.
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>

                  <div className="flex justify-between">
                    <Button variant="secondary" onClick={() => clearDay(activeDate)}>
                      Tag leeren
                    </Button>
                    <Button className="accent-bg text-white" onClick={() => saveCurrent({})}>
                      Speichern
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-3">
                <Section title="Letzte Einträge">
                  <div className="grid gap-2">
                    {entries
                      .slice(-30)
                      .reverse()
                      .map((e: any) => (
                        <div key={e.date} className="flex items-center justify-between border border-zinc-200 rounded-xl p-3">
                          <div>
                            <div className="font-medium">
                              {new Date(e.date).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}
                              {e.cycle?.cycleDay ? (
                                <span className="ml-2 text-xs text-rose-700">ZT {e.cycle.cycleDay}</span>
                              ) : null}
                            </div>
                            <div className="text-sm text-zinc-600">
                              Schmerz: {e.pain?.score ?? 0} · Blutung: {e.bleeding?.level}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-rose-200 text-rose-800">
                              {e.pain?.locations?.[0] || "—"}
                            </Badge>
                            <Button size="sm" variant="secondary" onClick={() => setActiveDate(e.date)}>
                              Öffnen
                            </Button>
                          </div>
                        </div>
                      ))}
                    {entries.length === 0 && <p className="text-sm text-zinc-600">Noch keine Daten – starte im Tab „Heute“.</p>}
                  </div>
                </Section>
              </TabsContent>

              <TabsContent value="report" className="mt-3 print:block">
                <div className="grid gap-3">
                  <Section
                    title="Monat wählen"
                    aside={
                      <div className="flex items-center gap-2">
                        <Select value={String(repMonth)} onValueChange={(v) => setRepMonth(Number(v))}>
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                              <SelectItem key={m} value={String(m)}>
                                {new Date(2000, m - 1, 1).toLocaleDateString("de-DE", { month: "long" })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input type="number" className="h-8 w-24" value={repYear} onChange={(e) => setRepYear(Number(e.target.value))} />
                      </div>
                    }
                  >
                    <div className="grid md:grid-cols-4 gap-3">
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-sm text-zinc-600">Tage dokumentiert</div>
                          <div className="text-2xl font-semibold">{stats.daysTracked}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-sm text-zinc-600">Ø Schmerz</div>
                          <div className="text-2xl font-semibold">{stats.avgPain}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-sm text-zinc-600">Max. Schmerz</div>
                          <div className="text-2xl font-semibold">{stats.maxPain}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-sm text-zinc-600">Flare‑Tage (≥6)</div>
                          <div className="text-2xl font-semibold">{stats.flareDays}</div>
                        </CardContent>
                      </Card>
                    </div>
                  </Section>

                  <Section title={`Schmerzverlauf – ${monthLabel(repYear, repMonth)}`}>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={painSeries} margin={{ left: 8, right: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tickMargin={8} />
                          <YAxis domain={[0, 10]} />
                          <Tooltip />
                          <Line type="monotone" dataKey="Schmerz" stroke="var(--endo-accent)" dot={false} strokeWidth={3} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Section>

                  <Section title="Kurzer Monatsreport (Text)">
                    <Textarea readOnly value={makeTextReport(stats, repYear, repMonth)} className="min-h-40" />
                    <div className="flex justify-end">
                      <Button onClick={copyReport}>In Zwischenablage</Button>
                    </div>
                  </Section>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="mt-3">
                <div className="grid gap-3">
                  <Section title="Darstellung">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                        <Switch checked={!!highContrast} onCheckedChange={setHighContrast} />
                        <span className="text-sm">Hoher Kontrast</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Label>Akzentfarbe</Label>
                        <Select value={accent} onValueChange={setAccent}>
                          <SelectTrigger className="h-9 w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rose">Rosa</SelectItem>
                            <SelectItem value="violet">Violett</SelectItem>
                            <SelectItem value="teal">Petrol</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Section>

                  <Section title="Zyklusstarts">
                    <div className="flex flex-wrap gap-2">
                      {periodStarts.map((d) => (
                        <Badge key={d} variant="outline" className="border-rose-200 text-rose-800">
                          {new Date(d).toLocaleDateString("de-DE")}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Input type="date" onChange={(e) => e.target.value && markPeriodStart(e.target.value)} />
                      <Button onClick={() => setPeriodStarts([])} variant="secondary">
                        Liste leeren
                      </Button>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">Zyklustag wird automatisch aus letztem Start berechnet.</p>
                  </Section>

                  <Section title="Daten">
                    <p className="text-sm text-zinc-600">
                      Alle Daten bleiben lokal in deinem Browser (kein Server). Export/Import ermöglicht Gerätewechsel.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button onClick={exportData}>
                        <Download className="h-4 w-4 mr-1" /> Export JSON
                      </Button>
                      <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-zinc-50">
                        <Upload className="h-4 w-4" /> Import JSON
                        <input
                          type="file"
                          accept="application/json"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])}
                        />
                      </label>
                    </div>
                  </Section>

                  <Section title="Hinweis">
                    <p className="text-sm text-zinc-700">
                      Diese App dient der persönlichen Dokumentation von Symptomen (Schmerz, Blutung, Darm/Blase, Müdigkeit,
                      Dyspareunie, Schlaf, Alltagseinfluss), Maßnahmen und möglichen Auslösern. Sie ersetzt keine ärztliche
                      Diagnose oder Therapie.
                    </p>
                  </Section>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </header>
      </div>
    </div>
  );
}

function makeTextReport(stats: any, y: number, m: number) {
  const title = `Monatsreport ${monthLabel(y, m)}`;
  const top = `Tage dokumentiert: ${stats.daysTracked}\nØ Schmerz: ${stats.avgPain} | Max: ${stats.maxPain} | Flare‑Tage (≥6): ${stats.flareDays}`;
  const loc = stats.byLocation
    ?.sort((a: any, b: any) => b.count - a.count)
    .slice(0, 3)
    .map((x: any) => `${x.name} (${x.count})`)
    .join(", ");
  const trig = stats.byTrigger
    ?.sort((a: any, b: any) => b.count - a.count)
    .slice(0, 5)
    .map((x: any) => `${x.name} (${x.count})`)
    .join(", ");
  const meds = stats.medReliefAvg
    ?.sort((a: any, b: any) => b.value - a.value)
    .map((x: any) => `${x.name}: ~${x.value}%`)
    .join("; ");
  return [
    title,
    top,
    loc ? `Häufigste Schmerzorte: ${loc}` : "",
    trig ? `Häufigste Trigger: ${trig}` : "",
    meds ? `Mittlere Erleichterung (Medikamente): ${meds}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

(function __ENDO_DEV_TESTS__() {
  if (typeof window === "undefined") return;
  try {
    const mock = {
      daysTracked: 5,
      avgPain: 4.2,
      maxPain: 9,
      flareDays: 2,
      byLocation: [
        { name: "Uterus", count: 3 },
        { name: "Kreuzbein", count: 2 },
      ],
      byTrigger: [
        { name: "Stress", count: 3 },
        { name: "Periode", count: 2 },
      ],
      medReliefAvg: [
        { name: "Ibuprofen", value: 40 },
        { name: "Wärme", value: 30 },
      ],
    } as any;
    const txt = makeTextReport(mock, 2025, 10);
    console.assert(txt.includes("Monatsreport"), "Report: Titel fehlt");
    console.assert(txt.includes("Ø Schmerz"), "Report: Ø Schmerz fehlt");
    console.assert(txt.split("\n").length >= 2, "Report: Zeilenumbrüche fehlen");
    if (!(window as any).__ENDO_TEST_OUTPUT__) {
      console.debug("[EndoTrack DEV TEST] makeTextReport OK:\n" + txt);
      (window as any).__ENDO_TEST_OUTPUT__ = true;
    }
  } catch (err) {
    console.warn("[EndoTrack DEV TEST] Fehler", err);
  }
})();
