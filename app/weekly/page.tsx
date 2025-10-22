"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import WeeklyForm, { WeeklyProvider } from "./WeeklyForm";
import type { DailyEntry } from "@/lib/types";
import { formatIsoWeek, getIsoWeekParts, getIsoWeekStringFromDateString } from "@/lib/isoWeek";
import { usePersistentState } from "@/lib/usePersistentState";

function parseYear(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function parseWeek(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < 1) return 1;
  if (normalized > 53) return 53;
  return normalized;
}

export default function Page(): JSX.Element {
  const searchParams = useSearchParams();
  const now = useMemo(() => new Date(), []);
  const currentWeek = useMemo(() => getIsoWeekParts(now), [now]);

  const yearParam = searchParams.get("year");
  const weekParam = searchParams.get("week");

  const year = useMemo(() => parseYear(yearParam, currentWeek.year), [yearParam, currentWeek.year]);
  const week = useMemo(() => parseWeek(weekParam, currentWeek.week), [weekParam, currentWeek.week]);

  const isoWeek = useMemo(() => formatIsoWeek(year, week), [year, week]);

  const [dailyEntries, , dailyMeta] = usePersistentState<DailyEntry[]>("endo.daily.v2", []);

  const entriesForWeek = useMemo(() => {
    return dailyEntries.filter((entry) => getIsoWeekStringFromDateString(entry.date) === isoWeek);
  }, [dailyEntries, isoWeek]);

  const content = useMemo(() => {
    if (!dailyMeta.ready) {
      return <p className="text-sm text-rose-900/70">Tagesdaten werden geladen …</p>;
    }
    if (dailyMeta.error) {
      return (
        <p className="text-sm text-rose-900">
          Daten konnten nicht geladen werden: <span className="font-medium">{dailyMeta.error}</span>
        </p>
      );
    }
    return (
      <WeeklyProvider year={year} week={week} dailyEntries={entriesForWeek}>
        <WeeklyForm year={year} week={week} />
      </WeeklyProvider>
    );
  }, [dailyMeta.error, dailyMeta.ready, entriesForWeek, week, year]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:px-8">
      {content}
    </main>
  );
}
