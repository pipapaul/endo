"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  ensureMigratedFromLocalStorage,
  getItem,
  getStorageDriverName,
  setItem,
  StorageDriver,
  storageSupported,
} from "./persistence";

export type PersistentStateMeta = {
  ready: boolean;
  driver: StorageDriver;
  error: string | null;
  driverLabel: string;
  isSaving: boolean;
  lastSavedAt: number | null;
  restored: boolean;
};

export function usePersistentState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [ready, setReady] = useState(false);
  const [driver, setDriver] = useState<StorageDriver>(storageSupported() ? "indexeddb" : "unavailable");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [restored, setRestored] = useState(false);
  const valueRef = useRef(value);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      try {
        const migrationDriver = await ensureMigratedFromLocalStorage();
        if (cancelled) return;
        setDriver(migrationDriver);
        const result = await getItem<T>(key);
        if (cancelled) return;
        if (result.driver !== migrationDriver) {
          setDriver(result.driver);
        }
        if (result.value !== undefined) {
          setValue(result.value);
          setRestored(true);
        } else {
          setRestored(false);
        }
        setReady(true);
        setError(null);
      } catch (error) {
        if (cancelled) return;
        console.error("Persistenter Zustand konnte nicht geladen werden", error);
        setDriver(storageSupported() ? "memory" : "unavailable");
        setError((error as Error).message ?? "Unbekannter Speicherfehler");
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    if (typeof window === "undefined") return;

    if (driver === "unavailable") {
      setIsSaving(false);
      return;
    }

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    setIsSaving(true);
    if (typeof window === "undefined") return;
    let cancelled = false;
    let attempts = 0;
    // Capture value at schedule time to avoid race conditions
    const valueToSave = value;

    const persist = () => {
      attempts += 1;
      setItem(key, valueToSave)
        .then((currentDriver) => {
          if (cancelled) return;
          setDriver(currentDriver);
          setError(null);
          setIsSaving(false);
          setLastSavedAt(Date.now());
        })
        .catch((persistError: unknown) => {
          if (cancelled) return;
          console.error("Speichern in IndexedDB fehlgeschlagen", persistError);
          setError((persistError as Error).message ?? "Speichern fehlgeschlagen");
          if (attempts < 3 && driver === "indexeddb") {
            window.setTimeout(persist, 300 * attempts);
          } else {
            setDriver("memory");
            setIsSaving(false);
          }
        });
    };

    debounceRef.current = window.setTimeout(persist, 300);

    return () => {
      cancelled = true;
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [driver, key, ready, value]);

  const meta: PersistentStateMeta = useMemo(
    () => ({
      ready,
      driver,
      error,
      driverLabel: getStorageDriverName(driver),
      isSaving,
      lastSavedAt,
      restored,
    }),
    [driver, error, ready, isSaving, lastSavedAt, restored]
  );

  return [value, setValue, meta] as const;
}
