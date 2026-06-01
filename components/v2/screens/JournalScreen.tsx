"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { useData } from "@/lib/data/DataProvider";
import { hasBleedingForEntry } from "@/lib/dailyEntries";
import { todayIso } from "@/lib/data/factory";
import { addDays } from "@/lib/cycle/cycle";
import { DayDetailSheet } from "../DayDetailSheet";
import { MOOD_EMOJI } from "../checkin/sections";
import type { DailyEntry } from "@/lib/types";

const WINDOW_DAYS = 30;

function dayParts(date: string): { day: string; weekday: string } {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    day: String(d).padStart(2, "0"),
    weekday: dt.toLocaleDateString("de-DE", { weekday: "short" }),
  };
}

const SIMPLE_MAG: Record<string, number> = {
  none: 0,
  very_light: 0.2,
  light: 0.4,
  medium: 0.6,
  heavy: 0.8,
  very_heavy: 1,
};

function painLevel(e: DailyEntry): number {
  let p = e.painNRS ?? 0;
  for (const ev of e.quickPainEvents ?? []) p = Math.max(p, ev.intensity);
  return Math.min(p / 10, 1);
}

function bleedLevel(e: DailyEntry): number {
  const s = e.simpleBleedingIntensity;
  if (s && s in SIMPLE_MAG) return SIMPLE_MAG[s];
  const pbac = e.bleeding?.pbacScore;
  if (typeof pbac === "number" && pbac > 0) return Math.min(pbac / 50, 1);
  return e.bleeding?.isBleeding ? 0.5 : 0;
}

/**
 * Per-day tinting: pain bleeds in from the left in purple, bleeding from the
 * right in red — each covers a share of the card proportional to its level.
 */
function dayBg(e: DailyEntry): string | undefined {
  const pl = painLevel(e);
  const bl = bleedLevel(e);
  const layers: string[] = [];
  // Peak opacity (0.7) only at the very edge, dropping off quickly inward and
  // fading to transparent over a share of the width proportional to the level.
  if (pl > 0) {
    const end = Math.round(pl * 82);
    const mid = Math.min(8, Math.max(2, Math.round(end * 0.35)));
    layers.push(
      `linear-gradient(to right, rgba(168,85,247,0.7) 0%, rgba(168,85,247,0.28) ${mid}%, rgba(168,85,247,0) ${end}%)`
    );
  }
  if (bl > 0) {
    const end = Math.round(bl * 82);
    const mid = Math.min(8, Math.max(2, Math.round(end * 0.35)));
    layers.push(
      `linear-gradient(to left, rgba(232,82,74,0.7) 0%, rgba(232,82,74,0.28) ${mid}%, rgba(232,82,74,0) ${end}%)`
    );
  }
  return layers.length ? layers.join(", ") : undefined;
}

function summarise(entry: DailyEntry): string[] {
  const parts: string[] = [];
  const painEvents = entry.quickPainEvents?.length ?? 0;
  if (entry.painNRS > 0 || painEvents > 0) {
    parts.push(`Schmerz ${entry.painNRS > 0 ? entry.painNRS : painEvents + "×"}`);
  }
  if (hasBleedingForEntry(entry)) parts.push("Blutung");
  const symptomCount = Object.values(entry.symptoms ?? {}).filter((s) => s?.present).length;
  if (symptomCount > 0) parts.push(`${symptomCount} Symptom${symptomCount > 1 ? "e" : ""}`);
  if (entry.rescueMeds?.length) parts.push(`${entry.rescueMeds.length} Medikament`);
  if (entry.notesFree) parts.push("Notiz");
  return parts;
}

export function JournalScreen() {
  const { daily } = useData();
  const [editDate, setEditDate] = useState<string | null>(null);
  const today = todayIso();

  const byDate = useMemo(() => new Map(daily.map((e) => [e.date, e])), [daily]);

  // Continuous last-30-days window (today → past), recorded or missing.
  const windowDates = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < WINDOW_DAYS; i += 1) dates.push(addDays(today, -i));
    return dates;
  }, [today]);

  const windowStart = windowDates[windowDates.length - 1];
  const olderEntries = useMemo(
    () => daily.filter((e) => e.date < windowStart).sort((a, b) => b.date.localeCompare(a.date)),
    [daily, windowStart]
  );

  return (
    <div className="space-y-5">
      <header className="px-1 pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-rose-900">Journal</h1>
        <p className="text-sm text-rose-500">Letzte 30 Tage – tippen zum Eintragen oder Ändern</p>
      </header>

      <ul className="space-y-2">
        {windowDates.map((date) => {
          const entry = byDate.get(date);
          const { day, weekday } = dayParts(date);
          if (!entry) {
            return (
              <li key={date}>
                <button
                  type="button"
                  onClick={() => setEditDate(date)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-rose-200 bg-white/40 px-4 py-3 text-left transition hover:border-rose-300 hover:bg-rose-50/60"
                >
                  <div className="flex w-14 shrink-0 flex-col items-center text-rose-300">
                    <span className="text-lg font-bold leading-none">{day}</span>
                    <span className="text-[11px]">{weekday}</span>
                  </div>
                  <span className="flex-1 text-sm text-rose-400">
                    {date === today ? "Heute eintragen" : "Tag nachtragen"}
                  </span>
                  <Plus className="h-5 w-5 shrink-0 text-rose-300" />
                </button>
              </li>
            );
          }
          const parts = summarise(entry);
          return (
            <li key={date}>
              <button
                type="button"
                onClick={() => setEditDate(date)}
                style={{ backgroundImage: dayBg(entry) }}
                className="flex w-full items-center gap-3 rounded-2xl border border-rose-100 bg-white/90 px-4 py-3 text-left shadow-sm transition active:scale-[0.99] hover:border-rose-200"
              >
                <div className="flex w-14 shrink-0 flex-col items-center">
                  <span className="text-lg font-bold leading-none text-rose-900">{day}</span>
                  <span className="text-[11px] text-rose-400">{weekday}</span>
                </div>
                <div className="min-w-0 flex-1">
                  {entry.mood ? <span className="mr-1">{MOOD_EMOJI[entry.mood]}</span> : null}
                  {parts.length > 0 ? (
                    <span className="text-sm text-rose-600">{parts.join(" · ")}</span>
                  ) : (
                    <span className="text-sm text-rose-300">Leer – tippen zum Ergänzen</span>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-rose-300" />
              </button>
            </li>
          );
        })}
      </ul>

      {olderEntries.length > 0 ? (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-rose-400">Früher</h2>
          <ul className="space-y-2">
            {olderEntries.map((entry) => {
              const { day, weekday } = dayParts(entry.date);
              const parts = summarise(entry);
              return (
                <li key={entry.date}>
                  <button
                    type="button"
                    onClick={() => setEditDate(entry.date)}
                    style={{ backgroundImage: dayBg(entry) }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-rose-100 bg-white/90 px-4 py-3 text-left shadow-sm transition active:scale-[0.99] hover:border-rose-200"
                  >
                    <div className="flex w-16 shrink-0 flex-col items-center">
                      <span className="text-sm font-bold leading-none text-rose-900">
                        {entry.date.slice(5)}
                      </span>
                      <span className="text-[11px] text-rose-400">{weekday}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      {entry.mood ? <span className="mr-1">{MOOD_EMOJI[entry.mood]}</span> : null}
                      <span className="text-sm text-rose-600">
                        {parts.length > 0 ? parts.join(" · ") : "Eintrag"}
                      </span>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-rose-300" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {editDate ? (
        <DayDetailSheet open={editDate !== null} onClose={() => setEditDate(null)} date={editDate} />
      ) : null}
    </div>
  );
}
