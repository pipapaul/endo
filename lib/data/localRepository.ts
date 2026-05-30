import { getItem, setItem } from "@/lib/persistence";
import { loadProductSettings, saveProductSettings } from "@/lib/persistence";
import { listWeeklyReports, replaceWeeklyReports } from "@/lib/weekly/reports";
import { normalizeDailyEntry } from "@/lib/dailyEntries";
import { DEFAULT_PRODUCT_SETTINGS } from "@/lib/productSettings";
import type { DailyEntry, MonthlyEntry, FeatureFlags } from "@/lib/types";
import type { AppSnapshot, DataRepository } from "./repository";

/**
 * Storage keys — intentionally identical to v1 so existing data carries over.
 */
const DAILY_KEY = "endo.daily.v2";
const MONTHLY_KEY = "endo.monthly.v2";
const FLAGS_KEY = "endo.flags.v1";

/**
 * Local-first repository backed by IndexedDB (via lib/persistence).
 *
 * This is the only place that knows about storage keys. A future
 * `ServerRepository` implements the same {@link DataRepository} interface and
 * the rest of the app stays unchanged.
 */
export class LocalRepository implements DataRepository {
  async load(): Promise<AppSnapshot> {
    const [dailyRaw, monthlyRaw, flagsRaw, productSettings, weekly] = await Promise.all([
      getItem<DailyEntry[]>(DAILY_KEY),
      getItem<MonthlyEntry[]>(MONTHLY_KEY),
      getItem<FeatureFlags>(FLAGS_KEY),
      loadProductSettings(),
      listWeeklyReports(),
    ]);

    const daily = Array.isArray(dailyRaw.value)
      ? dailyRaw.value.map((entry) => normalizeDailyEntry(entry))
      : [];
    const monthly = Array.isArray(monthlyRaw.value) ? monthlyRaw.value : [];
    const flags = flagsRaw.value ?? {};

    return { daily, monthly, weekly, flags, productSettings };
  }

  async saveDaily(entries: DailyEntry[]): Promise<void> {
    await setItem(DAILY_KEY, entries);
  }

  async saveMonthly(entries: MonthlyEntry[]): Promise<void> {
    await setItem(MONTHLY_KEY, entries);
  }

  async saveWeekly(entries: import("@/lib/weekly/reports").WeeklyReport[]): Promise<void> {
    await replaceWeeklyReports(entries);
  }

  async saveFlags(flags: FeatureFlags): Promise<void> {
    await setItem(FLAGS_KEY, flags);
  }

  async saveProductSettings(settings: import("@/lib/productSettings").ProductSettings): Promise<void> {
    await saveProductSettings(settings);
  }

  async replaceAll(snapshot: AppSnapshot): Promise<void> {
    await Promise.all([
      this.saveDaily(snapshot.daily),
      this.saveMonthly(snapshot.monthly),
      this.saveWeekly(snapshot.weekly),
      this.saveFlags(snapshot.flags),
      this.saveProductSettings(snapshot.productSettings),
    ]);
  }

  async clearAll(): Promise<void> {
    await this.replaceAll({
      daily: [],
      monthly: [],
      weekly: [],
      flags: {},
      productSettings: DEFAULT_PRODUCT_SETTINGS,
    });
  }
}

export const localRepository = new LocalRepository();
