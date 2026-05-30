import type { DailyEntry, MonthlyEntry } from "@/lib/types";

/** A fresh, empty daily entry with all required fields initialised. */
export function createEmptyDailyEntry(date: string): DailyEntry {
  return {
    date,
    painNRS: 0,
    painQuality: [],
    painMapRegionIds: [],
    bleeding: { isBleeding: false },
    symptoms: {},
  };
}

export function createEmptyMonthlyEntry(month: string): MonthlyEntry {
  return { month };
}

/** Local date as ISO `YYYY-MM-DD` (no UTC shift). */
export function todayIso(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
