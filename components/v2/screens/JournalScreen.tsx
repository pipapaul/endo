"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, ChevronRight } from "lucide-react";
import { useData } from "@/lib/data/DataProvider";
import { hasBleedingForEntry } from "@/lib/dailyEntries";
import { todayIso } from "@/lib/data/factory";
import { QuickCheckIn } from "../QuickCheckIn";
import type { DailyEntry } from "@/lib/types";

const MOOD_EMOJI: Record<number, string> = { 1: "😞", 2: "😕", 3: "🙂", 4: "😄" };

function formatDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
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

  const entries = useMemo(() => [...daily].reverse(), [daily]);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-rose-900">Journal</h1>
          <p className="text-sm text-rose-500">Deine Einträge – jederzeit änderbar</p>
        </div>
      </header>

      {/* Nachtragen */}
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-rose-200 bg-white/70 px-4 py-3 text-rose-600 transition hover:border-rose-300 hover:bg-rose-50">
        <CalendarPlus className="h-5 w-5" />
        <span className="text-sm font-medium">Tag nachtragen</span>
        <input
          type="date"
          max={todayIso()}
          onChange={(e) => e.target.value && setEditDate(e.target.value)}
          className="ml-auto rounded-lg border border-rose-200 bg-white px-2 py-1 text-sm text-rose-700"
        />
      </label>

      {entries.length === 0 ? (
        <div className="rounded-3xl border border-rose-100 bg-white/80 px-6 py-12 text-center">
          <p className="text-base font-semibold text-rose-900">Noch keine Einträge</p>
          <p className="mt-1 text-sm text-rose-500">
            Mach deinen ersten Schnell-Check-in auf der Startseite.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const parts = summarise(entry);
            return (
              <li key={entry.date}>
                <button
                  type="button"
                  onClick={() => setEditDate(entry.date)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-rose-100 bg-white/90 px-4 py-3 text-left shadow-sm transition active:scale-[0.99] hover:border-rose-200 hover:bg-rose-50"
                >
                  <div className="flex w-14 shrink-0 flex-col items-center">
                    <span className="text-lg font-bold leading-none text-rose-900">
                      {entry.date.slice(8, 10)}
                    </span>
                    <span className="text-[11px] text-rose-400">{formatDay(entry.date).split(" ")[0]}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    {entry.mood ? <span className="mr-1">{MOOD_EMOJI[entry.mood]}</span> : null}
                    {parts.length > 0 ? (
                      <span className="text-sm text-rose-600">{parts.join(" · ")}</span>
                    ) : (
                      <span className="text-sm text-rose-300">Kein Eintrag</span>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-rose-300" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editDate ? (
        <QuickCheckIn open={editDate !== null} onClose={() => setEditDate(null)} date={editDate} />
      ) : null}
    </div>
  );
}
