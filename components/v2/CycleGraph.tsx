"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { buildCyclePredictions, addDays, daysBetween } from "@/lib/cycle/cycle";
import { todayIso } from "@/lib/data/factory";
import { calculatePbacScore, normalizePbacCounts, getSimpleBleedingPbacEquivalent } from "@/lib/pbac";
import type { DailyEntry } from "@/lib/types";

/** PBAC (or PBAC-equivalent) score that fills the bleeding bar completely. */
const PBAC_FULL = 80;

/** Unified PBAC score for a day across all tracking methods. */
function bleedScore(entry?: DailyEntry): number {
  if (!entry) return 0;
  const direct = entry.bleeding?.pbacScore;
  if (typeof direct === "number" && direct > 0) return direct;
  if (entry.pbacCounts) {
    const s = calculatePbacScore(normalizePbacCounts(entry.pbacCounts));
    if (s > 0) return s;
  }
  const ext = entry.extendedPbacData?.totalPbacEquivalentScore;
  if (ext && ext > 0) return ext;
  if (entry.simpleBleedingIntensity) return getSimpleBleedingPbacEquivalent(entry.simpleBleedingIntensity);
  return entry.bleeding?.isBleeding ? 5 : 0;
}

function painValue(entry?: DailyEntry): number | null {
  if (!entry) return null;
  let p = entry.painNRS ?? 0;
  for (const ev of entry.quickPainEvents ?? []) p = Math.max(p, ev.intensity);
  return p;
}

/**
 * Monotone cubic (Fritsch–Carlson) spline → cubic-bezier. Unlike Catmull-Rom,
 * it never overshoots the data, so a rise from 0 to >0 can't dip below the
 * baseline.
 */
function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M ${pts[0].x} ${pts[0].y}`;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const dx: number[] = [];
  const delta: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = xs[i + 1] - xs[i];
    delta[i] = (ys[i + 1] - ys[i]) / dx[i];
  }
  const m: number[] = [];
  m[0] = delta[0];
  for (let i = 1; i < n - 1; i += 1) {
    m[i] = delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) / 2;
  }
  m[n - 1] = delta[n - 2];
  for (let i = 0; i < n - 1; i += 1) {
    if (delta[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / delta[i];
    const b = m[i + 1] / delta[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * delta[i];
      m[i + 1] = t * b * delta[i];
    }
  }
  let d = `M ${xs[0]} ${ys[0]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i];
    d += ` C ${xs[i] + h / 3} ${ys[i] + (m[i] * h) / 3}, ${xs[i + 1] - h / 3} ${
      ys[i + 1] - (m[i + 1] * h) / 3
    }, ${xs[i + 1]} ${ys[i + 1]}`;
  }
  return d;
}

const PAST = 90;
const FUTURE = 21;
const DW = 12; // px per day (also viewBox units → 1:1, no horizontal stretch)
const H = 104;
const BASE = H - 18;
const BAR_MAX = 62;

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

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJump, setShowJump] = useState(false);

  // Scroll position that puts "today" ~62% from the left (recent past + a bit of future).
  const nowScrollLeft = useCallback((el: HTMLDivElement) => {
    const target = (todayIndex + 0.5) * DW - el.clientWidth * 0.62;
    return Math.max(0, Math.min(target, width - el.clientWidth));
  }, [todayIndex, width]);

  // Start at "now" once mounted / when the data window changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = nowScrollLeft(el);
    setShowJump(false);
  }, [nowScrollLeft]);

  const jumpToNow = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: nowScrollLeft(el), behavior: "smooth" });
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setShowJump(Math.abs(el.scrollLeft - nowScrollLeft(el)) > 16);
          }}
          className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div style={{ width: `${width}px` }} className="h-32">
            <svg
              viewBox={`0 0 ${width} ${H}`}
              className="block h-full w-full"
              preserveAspectRatio="none"
            >
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

        {/* bleeding bars — height scales with the PBAC / PBAC-equivalent score */}
        {days.map((d) => {
          let h = 0;
          if (d.actualBleeding) {
            const score = bleedScore(d.entry);
            h = score > 0 ? Math.max(0.08, Math.min(score / PBAC_FULL, 1)) * BAR_MAX : 0;
          } else if (d.predictedMenstruation) {
            h = 0.45 * BAR_MAX;
          }
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

        {/* pain — smooth rounded curve over the recorded window (past → today) */}
        {(() => {
          const pts = days
            .filter((_, i) => i <= todayIndex)
            .map((d) => ({ x: d.x + DW / 2, y: BASE - ((painValue(d.entry) ?? 0) / 10) * BAR_MAX }));
          if (pts.length < 2) return null;
          return (
            <path
              d={monotonePath(pts)}
              fill="none"
              stroke="#a855f7"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })()}

        {/* ovulation markers */}
        {days.map((d) =>
          d.isPredictedOvulation ? (
            <circle key={`o-${d.date}`} cx={d.x + DW / 2} cy={10} r={3.5} fill="#f59e0b" stroke="#d97706" strokeWidth={1} />
          ) : null
        )}
            </svg>
          </div>
        </div>

        {showJump ? (
          <button
            type="button"
            onClick={jumpToNow}
            aria-label="Zur Jetzt-Ansicht"
            className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full border border-rose-200 bg-white/95 py-1 pl-2.5 pr-2 text-[11px] font-semibold text-rose-600 shadow-md backdrop-blur transition active:scale-95"
          >
            Jetzt <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

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
