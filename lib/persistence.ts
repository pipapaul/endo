const DB_NAME = "endo-track";
const DB_VERSION = 1;
const STORE_NAME = "app";

const MIGRATION_FLAG_KEY = "endo.meta.migrated.v1";

const STORAGE_KEYS_TO_MIGRATE = [
  "endo.daily.v2",
  "endo.weekly.v2",
  "endo.monthly.v2",
  "endo.flags.v1",
];

let dbPromise: Promise<IDBDatabase> | null = null;

const memoryStore = new Map<string, unknown>();

function hasIndexedDbSupport(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  if (!hasIndexedDbSupport()) {
    return Promise.reject(new Error("IndexedDB wird nicht unterstützt."));
  }
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB konnte nicht geöffnet werden."));
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        dbPromise = null;
      };
      resolve(database);
    };
  });
  return dbPromise;
}

function withStore<T>(mode: IDBTransactionMode, handler: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = handler(store);
        transaction.oncomplete = () => {
          resolve(request.result as T);
        };
        transaction.onabort = () => {
          reject(transaction.error ?? new Error("IndexedDB-Transaktion wurde abgebrochen."));
        };
        transaction.onerror = () => {
          reject(transaction.error ?? new Error("IndexedDB-Transaktion fehlgeschlagen."));
        };
        request.onerror = () => {
          reject(request.error ?? new Error("IndexedDB-Anfrage fehlgeschlagen."));
        };
      })
  );
}

export type StorageDriver = "indexeddb" | "memory" | "unavailable";

export type StorageResult<T> = {
  value: T | undefined;
  driver: StorageDriver;
};

export async function getItem<T>(key: string): Promise<StorageResult<T>> {
  if (!hasIndexedDbSupport()) {
    return { value: memoryStore.get(key) as T | undefined, driver: "unavailable" };
  }
  try {
    const value = await withStore<T | undefined>("readonly", (store) => store.get(key));
    return { value: value ?? undefined, driver: "indexeddb" };
  } catch (error) {
    console.warn("IndexedDB getItem fehlgeschlagen", error);
    return { value: memoryStore.get(key) as T | undefined, driver: "memory" };
  }
}

export async function setItem<T>(key: string, value: T): Promise<StorageDriver> {
  if (!hasIndexedDbSupport()) {
    memoryStore.set(key, value);
    return "unavailable";
  }
  try {
    await withStore("readwrite", (store) => store.put(value, key));
    memoryStore.delete(key);
    return "indexeddb";
  } catch (error) {
    console.warn("IndexedDB setItem fehlgeschlagen", error);
    memoryStore.set(key, value);
    return "memory";
  }
}

export async function removeItem(key: string): Promise<void> {
  if (!hasIndexedDbSupport()) {
    memoryStore.delete(key);
    return;
  }
  try {
    await withStore("readwrite", (store) => store.delete(key));
    memoryStore.delete(key);
  } catch (error) {
    console.warn("IndexedDB removeItem fehlgeschlagen", error);
    memoryStore.delete(key);
  }
}

export async function clearAll(): Promise<void> {
  memoryStore.clear();
  if (!hasIndexedDbSupport()) {
    return;
  }
  try {
    await withStore("readwrite", (store) => store.clear());
  } catch (error) {
    console.warn("IndexedDB clearAll fehlgeschlagen", error);
  }
}

function parseJson<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export async function ensureMigratedFromLocalStorage(): Promise<StorageDriver> {
  if (typeof window === "undefined") {
    return "indexeddb";
  }
  const support = hasIndexedDbSupport();
  if (!support) {
    STORAGE_KEYS_TO_MIGRATE.forEach((key) => window.localStorage.removeItem(key));
    return "unavailable";
  }
  try {
    const migrationState = await withStore<boolean | undefined>("readonly", (store) => store.get(MIGRATION_FLAG_KEY));
    if (migrationState) {
      return "indexeddb";
    }
  } catch (error) {
    console.warn("Migration-Check fehlgeschlagen", error);
  }
  try {
    for (const key of STORAGE_KEYS_TO_MIGRATE) {
      const parsed = parseJson<unknown>(window.localStorage.getItem(key));
      if (parsed === undefined) continue;
      await withStore("readwrite", (store) => store.put(parsed, key));
      window.localStorage.removeItem(key);
    }
    await withStore("readwrite", (store) => store.put(true, MIGRATION_FLAG_KEY));
    return "indexeddb";
  } catch (error) {
    console.error("Migration in IndexedDB fehlgeschlagen", error);
    return "memory";
  }
}

const LAST_ACTIVE_KEY = "endo.meta.lastActiveAt";

export async function touchLastActive(timestamp: number): Promise<StorageDriver> {
  return setItem(LAST_ACTIVE_KEY, timestamp);
}

export function getStorageDriverName(driver: StorageDriver): string {
  if (driver === "indexeddb") return "IndexedDB";
  if (driver === "memory") return "In-Memory";
  return "Nicht verfügbar";
}

export function storageSupported(): boolean {
  return hasIndexedDbSupport();
}
