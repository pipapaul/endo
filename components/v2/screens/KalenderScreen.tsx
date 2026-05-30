"use client";

import { useMemo } from "react";
import { useData } from "@/lib/data/DataProvider";
import {
  buildCyclePredictions,
  computeCycleStats,
  addDays,
  type DayPrediction,
} from "@/lib/cycle/cycle";
import { todayIso } from "@/lib/data/factory";

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function PredictionIcons({ p }: { p: DayPrediction }) {
  return (
    <div className="flex items-center gap-2">
      {(p.actualBleeding || p.predictedMenstruation) && (
        <svg width="11" height="14" viewBox="0 0 10 13" aria-label={p.actualBleeding ? "Blutung" : "Blutung vorhergesagt"}>
          <path
            d="M 5 1 C 8 5, 9 8, 5 12 C 1 8, 2 5, 5 1 Z"
            fill="#e8524a"
            opacity={p.actualBleeding ? 0.95 : 0.4}
          />
        </svg>
      )}
      {p.isPredictedOvulation && (
        <svg width="13" height="13" viewBox="-6 -6 12 12" aria-label="Eisprung">
          <circle cx={0} cy={0} r={4} fill="#fde68a" stroke="#d97706" strokeWidth={1} />
          <circle cx={0} cy={0} r={1.5} fill="#f59e0b" />
        </svg>
      )}
      {p.isFertile && !p.isPredictedOvulation && (
        <svg width="11" height="11" viewBox="-5 -5 10 10" aria-label="Fruchtbares Fenster">
          <circle cx={0} cy={0} r={4} fill="#ccfbf1" stroke="#14b8a6" strokeWidth={1} strokeDasharray="2,1" />
        </svg>
      )}
    </div>
  );
}

export function KalenderScreen() {
  const { daily } = useData();
  const today = todayIso();

  const hasCycleData = useMemo(() => computeCycleStats(daily) !== null, [daily]);

  const months = useMemo(() => {
    if (!hasCycleData) return [];
    const points = buildCyclePredictions(daily, { from: today, to: addDays(today, 90) });
    const map = new Map<string, DayPrediction[]>();
    for (const p of points) {
      const key = p.date.slice(0, 7);
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [daily, today, hasCycleData]);

  return (
    <div className="space-y-5">
      <header className="px-1 pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-rose-900">Kalender</h1>
        <p className="text-sm text-rose-500">Nächste 3 Monate – Vorhersagen</p>
      </header>

      {!hasCycleData ? (
        <div className="rounded-3xl border border-rose-100 bg-white/80 px-6 py-12 text-center">
          <p className="text-base font-semibold text-rose-900">Noch keine Vorhersagen</p>
          <p className="mt-1 text-sm text-rose-500">
            Sobald du deine Periode ein paar Mal erfasst hast, erscheinen hier die Vorhersagen für
            Blutung, Eisprung und fruchtbare Tage.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 rounded-2xl bg-white/70 px-4 py-3 text-xs text-rose-500">
          <Legend color="#e8524a" label="Blutung" />
          <Legend color="#f59e0b" label="Eisprung" />
          <Legend color="#14b8a6" label="Fruchtbar" dashed />
        </div>
      )}

      {months.map(([key, points]) => (
        <div key={key} className="space-y-1.5">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-rose-600">
            {monthLabel(key)}
          </h2>
          <div className="overflow-hidden rounded-2xl border border-rose-100 bg-white/80 shadow-sm">
            {points.map((p, i) => (
              <div
                key={p.date}
                className={`flex items-center gap-3 px-4 py-2 ${
                  p.date === today ? "bg-rose-50" : ""
                } ${i < points.length - 1 ? "border-b border-rose-50" : ""}`}
              >
                <span
                  className={`w-24 text-sm ${
                    p.date === today ? "font-bold text-rose-900" : "text-rose-700"
                  }`}
                >
                  {dayLabel(p.date)}
                </span>
                <span className="w-16 text-xs text-rose-400">
                  {p.cycleDay !== null ? `Tag ${p.cycleDay}` : ""}
                </span>
                <PredictionIcons p={p} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="12" height="12" viewBox="-6 -6 12 12">
        <circle cx={0} cy={0} r={4} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray={dashed ? "2,1" : undefined} />
      </svg>
      {label}
    </span>
  );
}
