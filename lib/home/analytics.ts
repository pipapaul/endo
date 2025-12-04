import { isoWeekToDate } from "@/lib/isoWeek";

export function dateToIsoWeek(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNr);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

export function monthToDate(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

export function parseIsoWeekKey(isoWeek: string): { year: number; week: number } | null {
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week)) return null;
  return { year, week };
}

export function formatIsoWeekCompactLabel(isoWeek: string | null): string | null {
  if (!isoWeek) return null;
  const parts = parseIsoWeekKey(isoWeek);
  if (!parts) return null;
  const start = isoWeekToDate(parts.year, parts.week);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const startLabel = start.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  const endLabel = end.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return `KW ${String(parts.week).padStart(2, "0")} · ${startLabel}–${endLabel}`;
}

export function computePearson(pairs: { x: number; y: number }[]) {
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
