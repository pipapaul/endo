"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DailyEntry, MonthlyEntry, FeatureFlags } from "@/lib/types";
import { DEFAULT_PRODUCT_SETTINGS, type ProductSettings } from "@/lib/productSettings";
import type { WeeklyReport } from "@/lib/weekly/reports";
import type { AppSnapshot, DataRepository } from "./repository";
import { localRepository } from "./localRepository";
import { createEmptyDailyEntry } from "./factory";

export interface DataContextValue {
  /** True once the initial snapshot has loaded from storage. */
  ready: boolean;

  daily: DailyEntry[];
  monthly: MonthlyEntry[];
  weekly: WeeklyReport[];
  flags: FeatureFlags;
  productSettings: ProductSettings;

  getDailyEntry: (date: string) => DailyEntry | undefined;
  /** Insert or replace the entry for `entry.date`. */
  upsertDailyEntry: (entry: DailyEntry) => void;
  /** Update (or create) the entry for `date` via an updater function. */
  updateDailyEntry: (date: string, updater: (entry: DailyEntry) => DailyEntry) => void;

  upsertMonthlyEntry: (entry: MonthlyEntry) => void;
  setWeekly: (reports: WeeklyReport[]) => void;

  setFlags: (update: FeatureFlags | ((prev: FeatureFlags) => FeatureFlags)) => void;
  setProductSettings: (settings: ProductSettings) => void;

  /** Snapshot for backup/export. */
  exportSnapshot: () => AppSnapshot;
  /** Replace all data (import from an old export). */
  importSnapshot: (snapshot: AppSnapshot) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const sortByDate = <T extends { date: string }>(entries: T[]): T[] =>
  [...entries].sort((a, b) => a.date.localeCompare(b.date));

export function DataProvider({
  children,
  repository = localRepository,
}: {
  children: ReactNode;
  repository?: DataRepository;
}) {
  const [ready, setReady] = useState(false);
  const [daily, setDaily] = useState<DailyEntry[]>([]);
  const [monthly, setMonthly] = useState<MonthlyEntry[]>([]);
  const [weekly, setWeeklyState] = useState<WeeklyReport[]>([]);
  const [flags, setFlagsState] = useState<FeatureFlags>({});
  const [productSettings, setProductSettingsState] =
    useState<ProductSettings>(DEFAULT_PRODUCT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await repository.load();
        if (cancelled) return;
        setDaily(sortByDate(snapshot.daily));
        setMonthly(snapshot.monthly);
        setWeeklyState(snapshot.weekly);
        setFlagsState(snapshot.flags);
        setProductSettingsState(snapshot.productSettings);
      } catch (error) {
        console.error("Daten konnten nicht geladen werden", error);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const getDailyEntry = useCallback(
    (date: string) => daily.find((entry) => entry.date === date),
    [daily]
  );

  const upsertDailyEntry = useCallback(
    (entry: DailyEntry) => {
      setDaily((prev) => {
        const next = sortByDate([...prev.filter((e) => e.date !== entry.date), entry]);
        void repository.saveDaily(next);
        return next;
      });
    },
    [repository]
  );

  const updateDailyEntry = useCallback(
    (date: string, updater: (entry: DailyEntry) => DailyEntry) => {
      setDaily((prev) => {
        const existing = prev.find((e) => e.date === date) ?? createEmptyDailyEntry(date);
        const updated = updater(existing);
        const next = sortByDate([...prev.filter((e) => e.date !== date), updated]);
        void repository.saveDaily(next);
        return next;
      });
    },
    [repository]
  );

  const upsertMonthlyEntry = useCallback(
    (entry: MonthlyEntry) => {
      setMonthly((prev) => {
        const next = [...prev.filter((e) => e.month !== entry.month), entry].sort((a, b) =>
          a.month.localeCompare(b.month)
        );
        void repository.saveMonthly(next);
        return next;
      });
    },
    [repository]
  );

  const setWeekly = useCallback(
    (reports: WeeklyReport[]) => {
      setWeeklyState(reports);
      void repository.saveWeekly(reports);
    },
    [repository]
  );

  const setFlags = useCallback(
    (update: FeatureFlags | ((prev: FeatureFlags) => FeatureFlags)) => {
      setFlagsState((prev) => {
        const next = typeof update === "function" ? update(prev) : update;
        void repository.saveFlags(next);
        return next;
      });
    },
    [repository]
  );

  const setProductSettings = useCallback(
    (settings: ProductSettings) => {
      setProductSettingsState(settings);
      void repository.saveProductSettings(settings);
    },
    [repository]
  );

  const exportSnapshot = useCallback(
    (): AppSnapshot => ({ daily, monthly, weekly, flags, productSettings }),
    [daily, monthly, weekly, flags, productSettings]
  );

  const importSnapshot = useCallback(
    async (snapshot: AppSnapshot) => {
      await repository.replaceAll(snapshot);
      setDaily(sortByDate(snapshot.daily));
      setMonthly(snapshot.monthly);
      setWeeklyState(snapshot.weekly);
      setFlagsState(snapshot.flags);
      setProductSettingsState(snapshot.productSettings);
    },
    [repository]
  );

  const value = useMemo<DataContextValue>(
    () => ({
      ready,
      daily,
      monthly,
      weekly,
      flags,
      productSettings,
      getDailyEntry,
      upsertDailyEntry,
      updateDailyEntry,
      upsertMonthlyEntry,
      setWeekly,
      setFlags,
      setProductSettings,
      exportSnapshot,
      importSnapshot,
    }),
    [
      ready,
      daily,
      monthly,
      weekly,
      flags,
      productSettings,
      getDailyEntry,
      upsertDailyEntry,
      updateDailyEntry,
      upsertMonthlyEntry,
      setWeekly,
      setFlags,
      setProductSettings,
      exportSnapshot,
      importSnapshot,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData must be used within a DataProvider");
  }
  return ctx;
}
