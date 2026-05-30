"use client";

import { useMemo } from "react";
import { buildCyclePredictions, addDays, daysBetween } from "@/lib/cycle/cycle";
import { todayIso } from "@/lib/data/factory";
import type { DailyEntry } from "@/lib/types";

const SIMPLE_MAG: Record<string, number> = {
  none: 0,
  very_light: 0.2,
  light: 0.4,
  medium: 0.6,
  heavy: 0.8,
  very_heavy: 1,
};

function bleedMagnitude(entry?: DailyEntry): number {
  if (!entry) return 0;
  const simp = entry.simpleBleedingIntensity;
  if (simp && simp in SIMPLE_MAG) return SIMPLE_MAG[simp];
  const pbac = entry.bleeding?.pbacScore;
  if (typeof pbac === "number" && pbac > 0) return Math.min(pbac / 50, 1);
  return entry.bleeding?.isBleeding ? 0.5 : 0;
}

function painValue(entry?: DailyEntry): number | null {
  if (!entry) return null;
  let p = entry.painNRS ?? 0;
  for (const ev of entry.quickPainEvents ?? []) p = Math.max(p, ev.intensity);
  return p;
}

const PAST = 14;
const FUTURE = 28;
const DW = 8; // px per day in the viewBox
const H = 86;
const BASE = H - 16;
const BAR_MAX = 46;

/**
 * Compact cycle graph: recorded + predicted bleeding (bars), pain (dots),
 * ovulation marker, fertile window shading, and a "heute" line — all in
 * lightweight SVG so it sits neatly inside the start card.
 */
export function CycleGraph({ daily }: { daily: DailyEntry[] }) {
  const today = todayIso();
  const from = addDays(today, -PAST);
  const to = addDays(today, FUTURE);

  const days = useMemo(() => {
    const byDate = new Map(daily.map((e) => [e.date, e]));
    const predictions = buildCyclePredictions(daily, { from, to });
    return predictions.map((p, i) => ({
      ...p,
      x: i * DW,
      entry: byDate.get(p.date),
    }));
  }, [daily, from, to]);

  const todayIndex = daysBetween(from, today);
  const width = days.length * DW;

  return (
    <div className="space-y-1">
      <svg viewBox={`0 0 ${width} ${H}`} className="h-20 w-full" preserveAspectRatio="none">
        {/* fertile window shading */}
        {days.map((d) =>
          d.isFertile || d.isPredictedOvulation ? (
            <rect
              key={`f-${d.date}`}
              x={d.x}
              y={8}
              width={DW}
              height={H - 24}
              fill="#14b8a6"
              opacity={0.1}
            />
          ) : null
        )}

        {/* today line */}
        <line
          x1={todayIndex * DW + DW / 2}
          y1={2}
          x2={todayIndex * DW + DW / 2}
          y2={BASE}
          stroke="#e11d48"
          strokeWidth={1}
          strokeDasharray="2,2"
          opacity={0.5}
        />

        {/* baseline */}
        <line x1={0} y1={BASE} x2={width} y2={BASE} stroke="#fecdd3" strokeWidth={1} />

        {/* bleeding bars */}
        {days.map((d) => {
          const mag = bleedMagnitude(d.entry);
          const h = (d.actualBleeding ? mag : d.predictedMenstruation ? 0.5 : 0) * BAR_MAX;
          if (h <= 0) return null;
          return (
            <rect
              key={`b-${d.date}`}
              x={d.x + 1}
              y={BASE - h}
              width={DW - 2}
              height={h}
              rx={1.5}
              fill="#e8524a"
              opacity={d.actualBleeding ? 0.95 : 0.3}
            />
          );
        })}

        {/* pain dots */}
        {days.map((d) => {
          const p = painValue(d.entry);
          if (p === null || p <= 0) return null;
          return (
            <circle
              key={`p-${d.date}`}
              cx={d.x + DW / 2}
              cy={BASE - (p / 10) * BAR_MAX}
              r={2}
              fill="#a855f7"
            />
          );
        })}

        {/* ovulation markers */}
        {days.map((d) =>
          d.isPredictedOvulation ? (
            <circle key={`o-${d.date}`} cx={d.x + DW / 2} cy={10} r={3.5} fill="#f59e0b" stroke="#d97706" strokeWidth={1} />
          ) : null
        )}
      </svg>

      <div className="flex items-center justify-between px-0.5 text-[10px] text-rose-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-[#e8524a]" /> Blutung
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#a855f7]" /> Schmerz
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#f59e0b]" /> Eisprung
        </span>
      </div>
    </div>
  );
}
