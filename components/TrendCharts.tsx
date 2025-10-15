"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { computeCorrelations } from "@/lib/logic/correlations";
import type { DayEntry, MonthEntry } from "@/lib/types";
import microcopy from "@/lib/i18n/de.json";

interface TrendChartsProps {
  dayEntries: DayEntry[];
  monthEntries: MonthEntry[];
}

export function TrendCharts({ dayEntries, monthEntries }: TrendChartsProps) {
  const last7 = dayEntries
    .slice()
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .slice(-7)
    .map((entry) => ({ date: entry.date.slice(5), nrs: entry.nrs ?? 0 }));

  const heatmapData = dayEntries
    .slice()
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .slice(-28)
    .map((entry) => ({
      date: entry.date,
      nrs: entry.nrs ?? 0,
      pbac: entry.pbac?.dayScore ?? 0,
    }));

  const cycleOverlay = buildCycleOverlay(dayEntries);
  const radarData = buildRadarData(monthEntries);
  const correlations = computeCorrelations(dayEntries);

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold">Verlauf</h2>
        <p className="text-sm text-slate-600">Schneller Überblick über Schmerz, Blutung und Fragebogen.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Schmerz (7 Tage)</h3>
          <div className="mt-2 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last7}>
                <XAxis dataKey="date" hide />
                <YAxis domain={[0, 10]} hide />
                <ReTooltip cursor={{ stroke: "#f43f5e" }} />
                <Line type="monotone" dataKey="nrs" stroke="#f43f5e" strokeWidth={3} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">PBAC (aktueller Monat)</h3>
          <div className="mt-2 flex flex-wrap gap-2" aria-label="Kalenderheatmap">
            {heatmapData.map((item) => (
              <span
                key={item.date}
                className={`flex h-10 w-10 flex-col items-center justify-center rounded-lg text-xs font-semibold ${colorForNrs(
                  item.nrs
                )}`}
                aria-label={`${item.date}: Schmerz ${item.nrs}, PBAC ${item.pbac}`}
              >
                {item.date.slice(8)}
                {item.pbac > 100 ? <span className="text-[10px] text-amber-600">PBAC!</span> : null}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Zyklus Overlay (Median + IQR)</h3>
          <div className="mt-2 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cycleOverlay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tickCount={8} />
                <YAxis domain={[0, 10]} />
                <ReTooltip />
                <Area type="monotone" dataKey="q1" stroke="#fda4af" fill="#fecdd3" fillOpacity={0.4} />
                <Area type="monotone" dataKey="median" stroke="#f43f5e" strokeWidth={3} fillOpacity={0} />
                <Area type="monotone" dataKey="q3" stroke="#fb7185" fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">EHP-5 Radar (6 Monate)</h3>
          <div className="mt-2 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="80%">
                <PolarGrid />
                <PolarAngleAxis dataKey="label" />
                <Radar dataKey="score" stroke="#6366f1" fill="#a5b4fc" fillOpacity={0.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">Korrelationen</h3>
        <p className="text-xs text-slate-500">{microcopy.correlation_disclaimer}</p>
        {correlations.length ? (
          <ul className="mt-3 space-y-2">
            {correlations.map((item) => (
              <li key={`${item.variableX}-${item.variableY}`} className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                {item.variableX} ↔ {item.variableY}: r={item.r.toFixed(2)} · n={item.n} · {item.reliable ? "stabil" : "unsicher"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Noch nicht genug Daten (mindestens 14 Werte pro Paar).</p>
        )}
      </div>
    </section>
  );
}

function colorForNrs(nrs: number) {
  if (nrs >= 7) return "bg-rose-200 text-rose-700";
  if (nrs >= 4) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function buildCycleOverlay(dayEntries: DayEntry[]) {
  const cycles: Array<{ day: number; nrs: number }[]> = [];
  let currentCycle: Array<{ day: number; nrs: number }> = [];
  let dayCounter = 1;
  dayEntries
    .slice()
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .forEach((entry) => {
      if (entry.pbac?.dayScore && entry.pbac.dayScore > 30 && currentCycle.length > 0) {
        cycles.push(currentCycle);
        currentCycle = [];
        dayCounter = 1;
      }
      currentCycle.push({ day: dayCounter, nrs: entry.nrs ?? 0 });
      dayCounter += 1;
      if (dayCounter > 35) {
        cycles.push(currentCycle);
        currentCycle = [];
        dayCounter = 1;
      }
    });
  if (currentCycle.length) cycles.push(currentCycle);

  const grouped = new Map<number, number[]>();
  cycles.forEach((cycle) => {
    cycle.forEach(({ day, nrs }) => {
      if (!grouped.has(day)) grouped.set(day, []);
      grouped.get(day)!.push(nrs);
    });
  });

  const stats = Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, values]) => {
      const sorted = values.slice().sort((a, b) => a - b);
      const median = percentile(sorted, 0.5);
      const q1 = percentile(sorted, 0.25);
      const q3 = percentile(sorted, 0.75);
      return { day, median, q1, q3 };
    });

  return stats;
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const index = (values.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return values[lower];
  return values[lower] + (values[upper] - values[lower]) * (index - lower);
}

function buildRadarData(monthEntries: MonthEntry[]) {
  const recent = monthEntries.slice(0, 6);
  if (!recent.length) {
    return questions.map((label) => ({ label, score: 0 }));
  }
  const sums = new Array(5).fill(0);
  let count = 0;
  recent.forEach((month) => {
    if (month.ehp5?.length === 5) {
      month.ehp5.forEach((value, index) => {
        sums[index] += value;
      });
      count += 1;
    }
  });
  return questions.map((label, index) => ({ label, score: count ? Number((sums[index] / count).toFixed(1)) : 0 }));
}

const questions = [
  "Schmerz",
  "Aktivität",
  "Emotionen",
  "Beziehungen",
  "Hilflosigkeit",
];
