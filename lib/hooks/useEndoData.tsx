"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { nanoid } from "nanoid";

import type { DayEntry, MonthEntry, Settings, WeekEntry } from "../types";
import { deriveKey, decryptPayload, encryptPayload } from "../storage/crypto";
import {
  clearAll,
  getSettings,
  listDayEntryRecords,
  listMonthEntries,
  listWeekEntries,
  saveSettings,
  upsertDayEntryRecord,
  upsertMonthEntry,
  upsertWeekEntry,
  type SettingsRecord,
} from "../storage/db";
import { validateDayEntry, validateMonthEntry, validateWeekEntry } from "../validation";

interface EndoDataContextValue {
  dayEntries: DayEntry[];
  weekEntries: WeekEntry[];
  monthEntries: MonthEntry[];
  settings: SettingsRecord | undefined;
  lockedDayEntries: number;
  saveDayEntry(entry: DayEntry): Promise<void>;
  createDayEntry(partial: Partial<DayEntry> & { date: string; mode: "quick" | "detail" }): Promise<DayEntry>;
  saveWeekEntry(entry: WeekEntry): Promise<void>;
  saveMonthEntry(entry: MonthEntry): Promise<void>;
  updateSettings(next: Partial<Settings>): Promise<void>;
  enableEncryption(passphrase: string): Promise<void>;
  unlock(passphrase: string): Promise<void>;
  disableEncryption(): Promise<void>;
  lock(): void;
  panicClear(): Promise<void>;
}

const EndoDataContext = createContext<EndoDataContextValue | undefined>(undefined);

const defaultSettings: Settings = {
  language: "de",
  quickMode: true,
  privacy: { localOnly: true },
};

export function EndoDataProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsRecord | undefined>();
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [lockedDayEntries, setLockedDayEntries] = useState(0);
  const [weekEntries, setWeekEntries] = useState<WeekEntry[]>([]);
  const [monthEntries, setMonthEntries] = useState<MonthEntry[]>([]);

  const loadDayEntries = useCallback(
    async (key: CryptoKey | null) => {
      const records = await listDayEntryRecords();
      const decrypted: DayEntry[] = [];
      let locked = 0;
      for (const record of records) {
        if (record.encrypted) {
          if (!key) {
            locked += 1;
            continue;
          }
          if (!record.payload || !record.iv) {
            continue;
          }
          const payload = await decryptPayload<{ entry: DayEntry }>(key, {
            payload: record.payload,
            iv: record.iv,
          });
          decrypted.push(payload.entry);
        } else if (record.data) {
          decrypted.push(record.data);
        }
      }
      setDayEntries(decrypted.sort((a, b) => b.date.localeCompare(a.date)));
      setLockedDayEntries(locked);

      const heavyBleedDays = decrypted.filter((entry) => entry.pbac?.dayScore && entry.pbac.dayScore > 100).length;
      if (heavyBleedDays > 0) {
        console.info(`Hinweis: ${heavyBleedDays} Tage mit PBAC>100 im aktuellen Datensatz.`);
      }
    },
    []
  );

  const loadAuxiliary = useCallback(async () => {
    const [weeks, months] = await Promise.all([listWeekEntries(), listMonthEntries()]);
    setWeekEntries(weeks);
    setMonthEntries(months);
  }, []);

  useEffect(() => {
    (async () => {
      const storedSettings = (await getSettings()) ?? (await (async () => {
        await saveSettings(defaultSettings);
        return getSettings();
      })());
      setSettings(storedSettings ?? { ...defaultSettings, id: "default", updatedAt: Date.now() });
      await loadAuxiliary();
      if (!storedSettings?.encryption?.enabled) {
        await loadDayEntries(null);
      }
    })();
  }, [loadAuxiliary, loadDayEntries]);

  const refreshSettings = useCallback(async () => {
    const next = await getSettings();
    if (next) setSettings(next);
  }, []);

  const persistSettings = useCallback(
    async (next: Settings) => {
      await saveSettings(next);
      await refreshSettings();
    },
    [refreshSettings]
  );

  const ensureCryptoKey = useCallback(async () => {
    const current = settings;
    if (!current?.encryption?.enabled) return null;
    if (cryptoKey) return cryptoKey;
    throw new Error("Verschlüsselung aktiv – bitte Passphrase eingeben.");
  }, [cryptoKey, settings]);

  const saveDayEntry = useCallback<EndoDataContextValue["saveDayEntry"]>(
    async (entry) => {
      const nextEntry: DayEntry = {
        ...entry,
        createdAt: entry.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      const key = await ensureCryptoKey();
      if (settings?.encryption?.enabled) {
        if (!key) {
          throw new Error("Keine Verschlüsselung verfügbar");
        }
        const encrypted = await encryptPayload(key, { entry: nextEntry });
        await upsertDayEntryRecord({
          id: nextEntry.id,
          date: nextEntry.date,
          mode: nextEntry.mode,
          encrypted: true,
          payload: encrypted.payload,
          iv: encrypted.iv,
          createdAt: nextEntry.createdAt,
          updatedAt: nextEntry.updatedAt,
        });
      } else {
        await upsertDayEntryRecord({
          id: nextEntry.id,
          date: nextEntry.date,
          mode: nextEntry.mode,
          encrypted: false,
          data: nextEntry,
          createdAt: nextEntry.createdAt,
          updatedAt: nextEntry.updatedAt,
        });
      }
      await loadDayEntries(settings?.encryption?.enabled ? (cryptoKey ?? null) : null);
    },
    [cryptoKey, ensureCryptoKey, loadDayEntries, settings]
  );

  const createDayEntry: EndoDataContextValue["createDayEntry"] = useCallback(
    async ({ date, mode, ...rest }) => {
      const entry: DayEntry = {
        id: nanoid(),
        date,
        mode,
        nrs: rest.nrs,
        pbac: rest.pbac,
        zones: rest.zones ?? [],
        symptoms: rest.symptoms ?? [],
        medication: rest.medication ?? [],
        sleep: rest.sleep,
        bowel: rest.bowel,
        bladder: rest.bladder,
        triggerTags: rest.triggerTags,
        helped: rest.helped,
        notes: rest.notes,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const validation = validateDayEntry(entry);
      if (validation.length) {
        console.warn("Validation issues", validation);
      }
      await saveDayEntry(entry);
      return entry;
    },
    [saveDayEntry]
  );

  const saveWeekEntry = useCallback<EndoDataContextValue["saveWeekEntry"]>(
    async (entry) => {
      const issues = validateWeekEntry(entry);
      if (issues.length) {
        console.warn("Wochen-Eintrag prüfen", issues);
      }
      await upsertWeekEntry({ ...entry, updatedAt: Date.now() });
      await loadAuxiliary();
    },
    [loadAuxiliary]
  );

  const saveMonthEntry = useCallback<EndoDataContextValue["saveMonthEntry"]>(
    async (entry) => {
      const issues = validateMonthEntry(entry);
      if (issues.length) {
        console.warn("Monats-Eintrag prüfen", issues);
      }
      await upsertMonthEntry({ ...entry, updatedAt: Date.now() });
      await loadAuxiliary();
    },
    [loadAuxiliary]
  );

  const updateSettings = useCallback<EndoDataContextValue["updateSettings"]>(
    async (next) => {
      const merged: Settings = {
        ...(settings ?? defaultSettings),
        ...next,
      };
      await persistSettings(merged);
    },
    [persistSettings, settings]
  );

  const enableEncryption = useCallback<EndoDataContextValue["enableEncryption"]>(
    async (passphrase) => {
      const { key, salt } = await deriveKey(passphrase, settings?.encryption?.salt);
      const records = await listDayEntryRecords();
      for (const record of records) {
        if (!record.encrypted && record.data) {
          const encrypted = await encryptPayload(key, { entry: record.data });
          await upsertDayEntryRecord({
            ...record,
            encrypted: true,
            payload: encrypted.payload,
            iv: encrypted.iv,
            data: undefined,
          });
        }
      }
      await persistSettings({
        ...(settings ?? defaultSettings),
        encryption: { enabled: true, salt },
      });
      setCryptoKey(key);
      await loadDayEntries(key);
    },
    [loadDayEntries, persistSettings, settings]
  );

  const unlock = useCallback<EndoDataContextValue["unlock"]>(
    async (passphrase) => {
      const current = settings;
      if (!current?.encryption?.enabled || !current.encryption.salt) {
        throw new Error("Verschlüsselung ist nicht aktiv.");
      }
      const { key } = await deriveKey(passphrase, current.encryption.salt);
      setCryptoKey(key);
      await loadDayEntries(key);
    },
    [loadDayEntries, settings]
  );

  const disableEncryption = useCallback<EndoDataContextValue["disableEncryption"]>(
    async () => {
      if (!settings?.encryption?.enabled) return;
      const key = await ensureCryptoKey();
      if (!key) return;
      const records = await listDayEntryRecords();
      for (const record of records) {
        if (record.encrypted && record.payload && record.iv) {
          const payload = await decryptPayload<{ entry: DayEntry }>(key, {
            payload: record.payload,
            iv: record.iv,
          });
          await upsertDayEntryRecord({
            ...record,
            encrypted: false,
            data: payload.entry,
            payload: undefined,
            iv: undefined,
          });
        }
      }
      await persistSettings({
        ...(settings ?? defaultSettings),
        encryption: { enabled: false },
      });
      setCryptoKey(null);
      await loadDayEntries(null);
    },
    [ensureCryptoKey, loadDayEntries, persistSettings, settings]
  );

  const lock = useCallback(() => {
    setCryptoKey(null);
    setDayEntries([]);
    setLockedDayEntries(0);
  }, []);

  const panicClear = useCallback(async () => {
    await clearAll();
    setCryptoKey(null);
    setDayEntries([]);
    setWeekEntries([]);
    setMonthEntries([]);
    setLockedDayEntries(0);
    await persistSettings(defaultSettings);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, [persistSettings]);

  const value = useMemo<EndoDataContextValue>(
    () => ({
      dayEntries,
      weekEntries,
      monthEntries,
      settings,
      lockedDayEntries,
      saveDayEntry,
      createDayEntry,
      saveWeekEntry,
      saveMonthEntry,
      updateSettings,
      enableEncryption,
      unlock,
      disableEncryption,
      lock,
      panicClear,
    }),
    [
      createDayEntry,
      dayEntries,
      enableEncryption,
      lockedDayEntries,
      lock,
      monthEntries,
      panicClear,
      saveDayEntry,
      saveMonthEntry,
      saveWeekEntry,
      settings,
      unlock,
      updateSettings,
      weekEntries,
      disableEncryption,
    ]
  );

  return <EndoDataContext.Provider value={value}>{children}</EndoDataContext.Provider>;
}

export function useEndoData() {
  const ctx = useContext(EndoDataContext);
  if (!ctx) throw new Error("useEndoData muss innerhalb von EndoDataProvider verwendet werden.");
  return ctx;
}
