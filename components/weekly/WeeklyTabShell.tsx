"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import WeeklyForm, { WeeklyProvider } from "@/app/weekly/WeeklyForm";
import type { DailyEntry } from "@/lib/types";
import {
  formatIsoWeek,
  getIsoWeekParts,
  getIsoWeekStringFromDateString,
  isoWeekToDate,
} from "@/lib/isoWeek";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

function parseIsoWeek(value: string): { year: number; week: number } | null {
  const match = value.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week)) return null;
  return { year, week };
}

function compareIsoWeek(a: { year: number; week: number }, b: { year: number; week: number }): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  return a.week - b.week;
}

function formatWeekRangeLabel(year: number, week: number): string {
  const start = isoWeekToDate(year, week);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);

  const startOptions: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long" };
  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    startOptions.year = "numeric";
  }

  const startLabel = start.toLocaleDateString("de-DE", startOptions);
  const endLabel = end.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
  return `KW ${String(week).padStart(2, "0")} (${startLabel} – ${endLabel})`;
}

type WeeklyTabShellProps = {
  dailyEntries: DailyEntry[];
  currentIsoWeek: string;
  onSelectionChange?: (isoWeek: string) => void;
};

export function WeeklyTabShell({ dailyEntries, currentIsoWeek, onSelectionChange }: WeeklyTabShellProps): JSX.Element {
  const currentParts = useMemo(() => parseIsoWeek(currentIsoWeek) ?? getIsoWeekParts(new Date()), [currentIsoWeek]);
  const [selected, setSelected] = useState(currentParts);

  const selectedIsoWeek = useMemo(() => formatIsoWeek(selected.year, selected.week), [selected.week, selected.year]);
  const selectedWeekLabel = useMemo(
    () => formatWeekRangeLabel(selected.year, selected.week),
    [selected.year, selected.week]
  );

  const canGoToNextWeek = useMemo(() => compareIsoWeek(selected, currentParts) < 0, [currentParts, selected]);

  const handlePreviousWeek = useCallback(() => {
    const start = isoWeekToDate(selected.year, selected.week);
    start.setUTCDate(start.getUTCDate() - 7);
    const next = getIsoWeekParts(start);
    setSelected(next);
  }, [selected.week, selected.year]);

  const handleNextWeek = useCallback(() => {
    const start = isoWeekToDate(selected.year, selected.week);
    start.setUTCDate(start.getUTCDate() + 7);
    const next = getIsoWeekParts(start);
    if (compareIsoWeek(next, currentParts) > 0) {
      return;
    }
    setSelected(next);
  }, [currentParts, selected.week, selected.year]);

  const handleWeekInputChange = useCallback(
    (value: string) => {
      const parsed = parseIsoWeek(value);
      if (!parsed) return;
      if (compareIsoWeek(parsed, currentParts) > 0) return;
      setSelected(parsed);
    },
    [currentParts]
  );

  const entriesForWeek = useMemo(
    () =>
      dailyEntries.filter((entry) => getIsoWeekStringFromDateString(entry.date) === selectedIsoWeek),
    [dailyEntries, selectedIsoWeek]
  );

  useEffect(() => {
    onSelectionChange?.(selectedIsoWeek);
  }, [onSelectionChange, selectedIsoWeek]);

  return (
    <WeeklyProvider year={selected.year} week={selected.week} dailyEntries={entriesForWeek}>
      <section className="space-y-6">
        <div className="space-y-2 rounded-xl border border-rose-100 bg-white/80 p-4 shadow-sm">
          <Label htmlFor="weekly-tab-week" className="text-sm font-medium text-rose-900">
            Kalenderwoche (ISO)
          </Label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex w-full max-w-xl items-center justify-between gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 shadow-sm">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handlePreviousWeek}
                aria-label="Vorherige Woche"
                className="text-rose-500 hover:text-rose-700"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <CalendarDays className="h-6 w-6 flex-shrink-0 text-rose-500" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-rose-400">Ausgewählte Woche</p>
                  <p className="truncate text-sm font-semibold text-rose-700">{selectedWeekLabel}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleNextWeek}
                aria-label="Nächste Woche"
                className="text-rose-500 hover:text-rose-700"
                disabled={!canGoToNextWeek}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <Input
              id="weekly-tab-week"
              type="week"
              value={selectedIsoWeek}
              onChange={(event) => handleWeekInputChange(event.target.value)}
              max={currentIsoWeek}
              aria-label="Kalenderwoche direkt auswählen"
              className="w-full max-w-[11rem]"
            />
          </div>
        </div>
        <WeeklyForm year={selected.year} week={selected.week} />
      </section>
    </WeeklyProvider>
  );
}

export default WeeklyTabShell;
