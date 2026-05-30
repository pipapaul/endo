import { normalizeDailyEntry } from "@/lib/dailyEntries";
import type { DailyEntry, MonthlyEntry, FeatureFlags } from "@/lib/types";
import type { WeeklyReport } from "@/lib/weekly/reports";
import type { ProductSettings } from "@/lib/productSettings";
import type { AppSnapshot } from "./repository";

/**
 * Backup file shape. Accepts both the v1 export keys (`dailyEntries`, …) and
 * the v2 keys (`daily`, …) so old exports import correctly.
 */
interface BackupFile {
  version?: number;
  exportedAt?: string;
  // v1 keys
  dailyEntries?: unknown;
  monthlyEntries?: unknown;
  weeklyReports?: unknown;
  featureFlags?: unknown;
  // v2 keys
  daily?: unknown;
  monthly?: unknown;
  weekly?: unknown;
  flags?: unknown;
  // both
  productSettings?: unknown;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const pickArray = (...candidates: unknown[]): unknown[] => {
  for (const c of candidates) if (Array.isArray(c)) return c;
  return [];
};

/**
 * Build a backup string. Uses v1-compatible key names plus `productSettings`,
 * so the file round-trips with both the old app and v2.
 */
export function buildBackup(snapshot: AppSnapshot): string {
  return JSON.stringify(
    {
      version: 2,
      exportedAt: new Date().toISOString(),
      dailyEntries: snapshot.daily,
      monthlyEntries: snapshot.monthly,
      weeklyReports: snapshot.weekly,
      featureFlags: snapshot.flags,
      productSettings: snapshot.productSettings,
    },
    null,
    2
  );
}

export interface ImportResult {
  snapshot: AppSnapshot;
  counts: { daily: number; monthly: number; weekly: number };
}

/**
 * Parse a backup file (v1 or v2) into a snapshot. Throws a German error message
 * suitable for display when the file is unusable.
 */
export function parseBackup(raw: unknown, fallbackProductSettings: ProductSettings): ImportResult {
  if (!isObject(raw)) {
    throw new Error("Keine gültige JSON-Datei.");
  }
  const file = raw as BackupFile;

  const daily = pickArray(file.dailyEntries, file.daily)
    .filter(isObject)
    .map((e) => normalizeDailyEntry(e as unknown as DailyEntry));

  const monthly = pickArray(file.monthlyEntries, file.monthly).filter(
    (e): e is MonthlyEntry => isObject(e) && typeof e.month === "string"
  );

  const weekly = pickArray(file.weeklyReports, file.weekly).filter(
    (e): e is WeeklyReport => isObject(e) && typeof e.isoWeekKey === "string"
  );

  const flags = (isObject(file.featureFlags) ? file.featureFlags : isObject(file.flags) ? file.flags : {}) as FeatureFlags;

  const productSettings = (isObject(file.productSettings)
    ? (file.productSettings as unknown as ProductSettings)
    : fallbackProductSettings);

  if (daily.length === 0 && monthly.length === 0 && weekly.length === 0) {
    throw new Error("Die Datei enthält keine erkennbaren Einträge.");
  }

  return {
    snapshot: { daily, monthly, weekly, flags, productSettings },
    counts: { daily: daily.length, monthly: monthly.length, weekly: weekly.length },
  };
}
