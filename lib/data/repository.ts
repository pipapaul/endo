import type { DailyEntry, MonthlyEntry, FeatureFlags } from "@/lib/types";
import type { ProductSettings } from "@/lib/productSettings";
import type { WeeklyReport } from "@/lib/weekly/reports";

/**
 * A complete snapshot of all persisted app data.
 *
 * v2.0 keeps the proven v1 data model (see {@link DailyEntry}) so existing
 * entries carry over unchanged. The only architectural change is that all
 * reads/writes now go through the {@link DataRepository} abstraction, which
 * lets us swap the local (IndexedDB) backend for a server backend later
 * without touching any UI code.
 */
export interface AppSnapshot {
  daily: DailyEntry[];
  monthly: MonthlyEntry[];
  weekly: WeeklyReport[];
  flags: FeatureFlags;
  productSettings: ProductSettings;
}

/**
 * Storage backend contract. The UI never talks to IndexedDB (or a future API)
 * directly — it goes through this interface via the DataProvider.
 *
 * A `ServerRepository` implementing the same interface is all that is needed
 * to move storage server-side later.
 */
export interface DataRepository {
  /** Load the full snapshot once (e.g. on app start). */
  load(): Promise<AppSnapshot>;

  saveDaily(entries: DailyEntry[]): Promise<void>;
  saveMonthly(entries: MonthlyEntry[]): Promise<void>;
  saveWeekly(entries: WeeklyReport[]): Promise<void>;
  saveFlags(flags: FeatureFlags): Promise<void>;
  saveProductSettings(settings: ProductSettings): Promise<void>;

  /** Replace everything at once (used by "import from old export"). */
  replaceAll(snapshot: AppSnapshot): Promise<void>;
}
