import { hasBleedingForEntry } from "@/lib/dailyEntries";
import type { DailyEntry } from "@/lib/types";

/**
 * Cycle math for v2.0.
 *
 * Pure functions extracted from the v1 monolith, keeping the same *content* of
 * predictions (period starts → cycle lengths → ovulation = length − 14 →
 * fertile window) but in a small, testable shape. Advanced ovulation
 * refinements (cervix mucus / Billings, pain peaks) can be layered on top
 * without changing this core.
 */

export const MS_PER_DAY = 86_400_000;
/** Bleeding that restarts sooner than this many days counts as the same period. */
const MIN_CYCLE_GAP = 10;
/** Luteal phase length used to estimate ovulation from cycle length. */
const LUTEAL_PHASE = 14;
const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;
/** Recent cycles considered for the rolling average. */
const RECENT_CYCLE_WINDOW = 3;

// ── Date helpers (local time, no UTC shift) ─────────────────────────────────

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isoFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return isoFromDate(date);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIso(toIso).getTime() - parseIso(fromIso).getTime()) / MS_PER_DAY);
}

// ── Period & cycle detection ────────────────────────────────────────────────

/**
 * Detect the first day of each menstruation from daily entries.
 *
 * A start is a bleeding day whose previous calendar day was not bleeding and
 * that is at least {@link MIN_CYCLE_GAP} days after the previous start (so a
 * one-day gap mid-period does not create a phantom cycle).
 */
export function detectPeriodStarts(entries: DailyEntry[]): string[] {
  const bleedingDays = new Set(
    entries.filter((e) => hasBleedingForEntry(e)).map((e) => e.date)
  );
  const sorted = [...bleedingDays].sort();
  const starts: string[] = [];
  for (const date of sorted) {
    const prevDay = addDays(date, -1);
    const isNewPeriod = !bleedingDays.has(prevDay);
    if (!isNewPeriod) continue;
    const lastStart = starts[starts.length - 1];
    if (lastStart && daysBetween(lastStart, date) < MIN_CYCLE_GAP) continue;
    starts.push(date);
  }
  return starts;
}

/** Average number of consecutive bleeding days starting at each period start. */
function averagePeriodLength(entries: DailyEntry[], starts: string[]): number {
  const bleedingDays = new Set(
    entries.filter((e) => hasBleedingForEntry(e)).map((e) => e.date)
  );
  if (starts.length === 0) return DEFAULT_PERIOD_LENGTH;
  const lengths = starts.map((start) => {
    let length = 0;
    let cursor = start;
    while (bleedingDays.has(cursor) && length < 14) {
      length += 1;
      cursor = addDays(cursor, 1);
    }
    return Math.max(length, 1);
  });
  return Math.round(lengths.reduce((s, v) => s + v, 0) / lengths.length);
}

export interface CycleStats {
  starts: string[];
  /** Completed cycle lengths (gaps between consecutive starts). */
  lengths: number[];
  averageLength: number;
  averagePeriodLength: number;
  lastStart: string | null;
  cycleCount: number;
}

export function computeCycleStats(entries: DailyEntry[]): CycleStats | null {
  const starts = detectPeriodStarts(entries);
  if (starts.length === 0) return null;

  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i += 1) {
    lengths.push(daysBetween(starts[i - 1], starts[i]));
  }
  const recent = lengths.slice(-RECENT_CYCLE_WINDOW);
  const averageLength =
    recent.length > 0
      ? Math.round(recent.reduce((s, v) => s + v, 0) / recent.length)
      : DEFAULT_CYCLE_LENGTH;

  return {
    starts,
    lengths,
    averageLength,
    averagePeriodLength: averagePeriodLength(entries, starts),
    lastStart: starts[starts.length - 1] ?? null,
    cycleCount: recent.length,
  };
}

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

export interface CycleAnalysis extends CycleStats {
  currentCycleDay: number | null;
  predictedOvulationDay: number;
  fertileStart: number;
  fertileEnd: number;
  nextPeriodStart: string | null;
  daysUntilNextPeriod: number | null;
  phase: CyclePhase | null;
}

export function fertileWindow(ovulationDay: number) {
  return { fertileStart: ovulationDay - 5, fertileEnd: ovulationDay + 1 };
}

function phaseForCycleDay(
  cycleDay: number,
  ovulationDay: number,
  periodLength: number
): CyclePhase {
  if (cycleDay <= periodLength) return "menstrual";
  if (cycleDay >= ovulationDay - 1 && cycleDay <= ovulationDay + 1) return "ovulation";
  if (cycleDay < ovulationDay - 1) return "follicular";
  return "luteal";
}

export function analyzeCycle(entries: DailyEntry[], today: string): CycleAnalysis | null {
  const stats = computeCycleStats(entries);
  if (!stats || !stats.lastStart) return null;

  const predictedOvulationDay = Math.max(stats.averageLength - LUTEAL_PHASE, 1);
  const { fertileStart, fertileEnd } = fertileWindow(predictedOvulationDay);

  const currentCycleDay = daysBetween(stats.lastStart, today) + 1;
  const validCurrentDay = currentCycleDay >= 1 ? currentCycleDay : null;

  // Project the next start at or after today.
  let nextPeriodStart = addDays(stats.lastStart, stats.averageLength);
  let guard = 0;
  while (daysBetween(today, nextPeriodStart) < 0 && guard < 24) {
    nextPeriodStart = addDays(nextPeriodStart, stats.averageLength);
    guard += 1;
  }
  const daysUntilNextPeriod = daysBetween(today, nextPeriodStart);

  return {
    ...stats,
    currentCycleDay: validCurrentDay,
    predictedOvulationDay,
    fertileStart,
    fertileEnd,
    nextPeriodStart,
    daysUntilNextPeriod,
    phase:
      validCurrentDay !== null
        ? phaseForCycleDay(validCurrentDay, predictedOvulationDay, stats.averagePeriodLength)
        : null,
  };
}

// ── Calendar prediction points ──────────────────────────────────────────────

export interface DayPrediction {
  date: string;
  cycleDay: number | null;
  actualBleeding: boolean;
  predictedMenstruation: boolean;
  isPredictedOvulation: boolean;
  isFertile: boolean;
}

/**
 * Build per-day prediction points across a date range (inclusive), combining
 * recorded bleeding with projected menstruation / ovulation / fertile windows.
 */
export function buildCyclePredictions(
  entries: DailyEntry[],
  range: { from: string; to: string }
): DayPrediction[] {
  const stats = computeCycleStats(entries);
  const bleedingDays = new Set(
    entries.filter((e) => hasBleedingForEntry(e)).map((e) => e.date)
  );

  // Project future cycle starts so we can map any date to a cycle day.
  const projectedStarts = [...(stats?.starts ?? [])];
  if (stats?.lastStart) {
    let cursor = stats.lastStart;
    for (let i = 0; i < 24; i += 1) {
      cursor = addDays(cursor, stats.averageLength);
      if (daysBetween(cursor, range.to) < 0) break;
      projectedStarts.push(cursor);
    }
  }

  const ovulationDay = stats ? Math.max(stats.averageLength - LUTEAL_PHASE, 1) : 0;
  const { fertileStart, fertileEnd } = fertileWindow(ovulationDay);
  const periodLength = stats?.averagePeriodLength ?? DEFAULT_PERIOD_LENGTH;

  const cycleStartFor = (date: string): string | null => {
    let chosen: string | null = null;
    for (const start of projectedStarts) {
      if (daysBetween(start, date) >= 0) chosen = start;
      else break;
    }
    return chosen;
  };

  const points: DayPrediction[] = [];
  let cursor = range.from;
  let guard = 0;
  while (daysBetween(cursor, range.to) >= 0 && guard < 800) {
    const start = cycleStartFor(cursor);
    const cycleDay = start ? daysBetween(start, cursor) + 1 : null;
    const isFuture = stats?.lastStart ? daysBetween(stats.lastStart, cursor) > 0 : false;
    const actualBleeding = bleedingDays.has(cursor);

    points.push({
      date: cursor,
      cycleDay,
      actualBleeding,
      predictedMenstruation:
        !actualBleeding && isFuture && cycleDay !== null && cycleDay <= periodLength,
      isPredictedOvulation:
        stats !== null && cycleDay === ovulationDay && !actualBleeding,
      isFertile:
        stats !== null &&
        cycleDay !== null &&
        cycleDay >= fertileStart &&
        cycleDay <= fertileEnd &&
        !actualBleeding,
    });

    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return points;
}
