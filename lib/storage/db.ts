import Dexie, { type Table } from "dexie";

import type {
  ConsentState,
  DayEntry,
  MonthEntry,
  Settings,
  StoredKey,
  WeekEntry,
} from "../types";

export interface SettingsRecord extends Settings {
  id: string;
  updatedAt: number;
}

export interface DayEntryRecord {
  id: string;
  date: string;
  mode: "quick" | "detail";
  encrypted: boolean;
  payload?: string;
  iv?: string;
  data?: DayEntry;
  createdAt: number;
  updatedAt: number;
}

class EndoDatabase extends Dexie {
  dayEntries!: Table<DayEntryRecord, string>;
  weekEntries!: Table<WeekEntry, string>;
  monthEntries!: Table<MonthEntry, string>;
  settings!: Table<SettingsRecord, string>;
  consents!: Table<ConsentState & { id: string }, string>;
  keys!: Table<StoredKey, string>;

  constructor() {
    super("endo-tracker");
    this.version(1).stores({
      dayEntries: "id,date",
      weekEntries: "id,isoWeek",
      monthEntries: "id,month",
      settings: "id",
      consents: "id",
      keys: "id",
    });
  }
}

export const db = new EndoDatabase();

export async function getSettings(): Promise<SettingsRecord | undefined> {
  return db.settings.get("default");
}

export async function saveSettings(settings: Settings): Promise<void> {
  await db.settings.put({ ...settings, id: "default", updatedAt: Date.now() });
}

export async function listDayEntryRecords(): Promise<DayEntryRecord[]> {
  return db.dayEntries.orderBy("date").reverse().toArray();
}

export async function listWeekEntries(): Promise<WeekEntry[]> {
  return db.weekEntries.orderBy("isoWeek").reverse().toArray();
}

export async function listMonthEntries(): Promise<MonthEntry[]> {
  return db.monthEntries.orderBy("month").reverse().toArray();
}

export async function getDayEntryRecord(id: string): Promise<DayEntryRecord | undefined> {
  return db.dayEntries.get(id);
}

export async function upsertDayEntryRecord(record: DayEntryRecord): Promise<void> {
  await db.dayEntries.put({ ...record, updatedAt: Date.now() });
}

export async function upsertWeekEntry(entry: WeekEntry): Promise<void> {
  await db.weekEntries.put({ ...entry, updatedAt: Date.now() });
}

export async function upsertMonthEntry(entry: MonthEntry): Promise<void> {
  await db.monthEntries.put({ ...entry, updatedAt: Date.now() });
}

export async function deleteDayEntry(id: string): Promise<void> {
  await db.dayEntries.delete(id);
}

export async function clearAll(): Promise<void> {
  await db.transaction(
    "rw",
    db.dayEntries,
    db.weekEntries,
    db.monthEntries,
    db.settings,
    db.consents,
    db.keys,
    async () => {
      await Promise.all([
        db.dayEntries.clear(),
        db.weekEntries.clear(),
        db.monthEntries.clear(),
        db.settings.clear(),
        db.consents.clear(),
        db.keys.clear(),
      ]);
    }
  );
}
