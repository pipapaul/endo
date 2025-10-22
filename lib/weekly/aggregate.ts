import { getIsoWeekStringFromDateString } from "../isoWeek";

export type DailyEntry = {
  dateISO: string;
  pain0to10?: number;
  bleeding?: "none" | "light" | "medium" | "strong";
  sleepQuality0to10?: number;
  medicationsChanged?: boolean;
};

export type WeeklyStats = {
  isoWeekKey: string; // "2025-W43"
  startISO: string;
  endISO: string;
  avgPain: number | null;
  maxPain: number | null;
  badDaysCount: number; // pain >= 6
  bleedingDaysCount: number;
  sparkline: Array<{ dateISO: string; pain: number | null }>;
  notes: { medicationChange: boolean; sleepBelowUsual: boolean };
};

export function computeWeeklyStats(
  daily: DailyEntry[],
  weekStartISO: string,
  weekEndISO: string,
  _history: WeeklyStats[] = []
): WeeklyStats {
  const startDate = parseISODate(weekStartISO);
  const endDate = parseISODate(weekEndISO);

  const entriesInWeek = daily
    .filter((entry) => isWithinRange(entry.dateISO, weekStartISO, weekEndISO))
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  const painValues = entriesInWeek
    .map((entry) => (typeof entry.pain0to10 === "number" ? entry.pain0to10 : null))
    .filter((value): value is number => value !== null);

  const avgPain = painValues.length ? average(painValues) : null;
  const maxPain = painValues.length ? Math.max(...painValues) : null;
  const badDaysCount = entriesInWeek.filter(
    (entry) => typeof entry.pain0to10 === "number" && entry.pain0to10 >= 6
  ).length;
  const bleedingDaysCount = entriesInWeek.filter(
    (entry) => entry.bleeding && entry.bleeding !== "none"
  ).length;

  const sparkline = buildSparkline(entriesInWeek, startDate, endDate);

  const medicationChange = entriesInWeek.some((entry) => entry.medicationsChanged === true);
  const sleepBelowUsual = detectSleepBelowUsual(daily, entriesInWeek, weekStartISO);

  const isoWeekKey =
    getIsoWeekStringFromDateString(weekStartISO) ??
    getIsoWeekStringFromDateString(entriesInWeek[0]?.dateISO ?? weekStartISO) ??
    "";

  return {
    isoWeekKey,
    startISO: weekStartISO,
    endISO: weekEndISO,
    avgPain,
    maxPain,
    badDaysCount,
    bleedingDaysCount,
    sparkline,
    notes: {
      medicationChange,
      sleepBelowUsual,
    },
  };
}

export type Highlight =
  | { kind: "above_trend"; message: string }
  | { kind: "medication_change"; message: string }
  | { kind: "poor_sleep"; message: string };

export function detectHighlights(stats: WeeklyStats, history: WeeklyStats[]): Highlight[] {
  const highlights: Highlight[] = [];

  if (stats.notes.medicationChange) {
    highlights.push({ kind: "medication_change", message: "Medication changes documented this week." });
  }

  if (stats.notes.sleepBelowUsual) {
    highlights.push({ kind: "poor_sleep", message: "Sleep quality trended below usual levels." });
  }

  const avgPainHistory = history
    .map((week) => week.avgPain)
    .filter((value): value is number => typeof value === "number");

  if (stats.avgPain !== null && avgPainHistory.length) {
    const baseline = average(avgPainHistory);
    if (stats.avgPain >= baseline + 1) {
      highlights.push({
        kind: "above_trend",
        message: `Average pain (${stats.avgPain.toFixed(1)}) exceeded the recent baseline (${baseline.toFixed(1)}).`,
      });
    }
  }

  return highlights;
}

function parseISODate(dateISO: string): Date {
  const [year, month, day] = dateISO.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day));
}

function formatISODate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildSparkline(entries: DailyEntry[], start: Date, end: Date) {
  const map = new Map(entries.map((entry) => [entry.dateISO, entry]));
  const spark: Array<{ dateISO: string; pain: number | null }> = [];

  for (let current = new Date(start); current <= end; current = addDays(current, 1)) {
    const dateISO = formatISODate(current);
    const entry = map.get(dateISO);
    const pain = typeof entry?.pain0to10 === "number" ? entry.pain0to10 : null;
    spark.push({ dateISO, pain });
  }

  return spark;
}

function isWithinRange(dateISO: string, startISO: string, endISO: string): boolean {
  return dateISO >= startISO && dateISO <= endISO;
}

function average(values: number[]): number {
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Number((sum / values.length).toFixed(2));
}

function detectSleepBelowUsual(
  allEntries: DailyEntry[],
  currentWeekEntries: DailyEntry[],
  weekStartISO: string
): boolean {
  const currentSleep = currentWeekEntries
    .map((entry) => (typeof entry.sleepQuality0to10 === "number" ? entry.sleepQuality0to10 : null))
    .filter((value): value is number => value !== null);

  if (currentSleep.length === 0) {
    return false;
  }

  const pastSleep = allEntries
    .filter((entry) => entry.dateISO < weekStartISO)
    .map((entry) => (typeof entry.sleepQuality0to10 === "number" ? entry.sleepQuality0to10 : null))
    .filter((value): value is number => value !== null);

  if (pastSleep.length < 3) {
    return false;
  }

  const currentAverage = average(currentSleep);
  const baseline = average(pastSleep);

  return currentAverage <= baseline - 1;
}
