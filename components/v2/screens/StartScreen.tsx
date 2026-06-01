"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useData } from "@/lib/data/DataProvider";
import { analyzeCycle, type CyclePhase } from "@/lib/cycle/cycle";
import { todayIso } from "@/lib/data/factory";
import { hasBleedingForEntry } from "@/lib/dailyEntries";
import { CycleGraph } from "../CycleGraph";
import { QuickCheckIn } from "../QuickCheckIn";
import { QuickTrackers } from "../QuickTrackers";

const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: "Menstruation",
  follicular: "Follikelphase",
  ovulation: "Eisprung-Zeit",
  luteal: "Lutealphase",
};

const PHASE_EMOJI: Record<CyclePhase, string> = {
  menstrual: "🩸",
  follicular: "🌱",
  ovulation: "✨",
  luteal: "🌙",
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Gute Nacht";
  if (h < 11) return "Guten Morgen";
  if (h < 17) return "Hallo";
  return "Guten Abend";
}

export function StartScreen() {
  const { daily, getDailyEntry } = useData();
  const today = todayIso();
  const [checkInOpen, setCheckInOpen] = useState(false);

  const analysis = useMemo(() => analyzeCycle(daily, today), [daily, today]);

  const todayEntry = getDailyEntry(today);
  const checkedInToday = useMemo(() => {
    if (!todayEntry) return false;
    return Boolean(
      todayEntry.painNRS > 0 ||
        todayEntry.mood ||
        hasBleedingForEntry(todayEntry) ||
        todayEntry.notesFree ||
        Object.values(todayEntry.symptoms ?? {}).some((s) => s?.present)
    );
  }, [todayEntry]);

  return (
    <div className="space-y-5">
      <header className="space-y-0.5 px-1 pt-2">
        <p className="text-sm text-rose-500">{greeting()}</p>
        <h1 className="text-2xl font-bold tracking-tight text-rose-900">Wie geht es dir heute?</h1>
      </header>

      {/* Cycle snapshot — graph sits directly on the background, no card. */}
      {analysis && analysis.currentCycleDay !== null ? (
        <section className="space-y-3 px-1">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-rose-500">
                <span>{analysis.phase ? PHASE_EMOJI[analysis.phase] : "🌸"}</span>
                <span>{analysis.phase ? PHASE_LABEL[analysis.phase] : "Zyklus"}</span>
              </div>
              <p className="text-3xl font-bold text-rose-900">Zyklustag {analysis.currentCycleDay}</p>
              {analysis.daysUntilNextPeriod !== null ? (
                <p className="text-sm text-rose-500">
                  {analysis.daysUntilNextPeriod === 0
                    ? "Periode heute erwartet"
                    : `Periode in ~${analysis.daysUntilNextPeriod} Tagen`}
                </p>
              ) : null}
            </div>
            <CycleRing day={analysis.currentCycleDay} length={analysis.averageLength} />
          </div>
          <CycleGraph daily={daily} />
        </section>
      ) : (
        <section className="space-y-1 px-1">
          <p className="text-base font-semibold text-rose-900">Noch keine Zyklusdaten</p>
          <p className="text-sm text-rose-500">
            Trag deine Periode ein paar Mal ein – dann erscheinen hier Zyklustag und Vorhersagen.
          </p>
        </section>
      )}

      {/* Schnell-Check-in — the primary action */}
      <button
        type="button"
        onClick={() => setCheckInOpen(true)}
        className="relative w-full overflow-hidden rounded-3xl bg-rose-600 px-6 py-7 text-left text-white shadow-lg shadow-rose-200 transition active:scale-[0.98]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="h-5 w-5" />
              Schnell-Check-in
            </div>
            <p className="text-sm text-white/85">
              {checkedInToday ? "Heute erfasst – tippen zum Ergänzen" : "In 30 Sekunden den Tag festhalten"}
            </p>
          </div>
          {checkedInToday ? <CheckCircle2 className="h-7 w-7 shrink-0 text-white/90" /> : null}
        </div>
      </button>

      {/* Quick-trackers — below the check-in */}
      <section className="space-y-2.5">
        <p className="px-1 text-[13px] font-semibold text-rose-700">Schnell festhalten</p>
        <QuickTrackers date={today} />
      </section>

      <QuickCheckIn open={checkInOpen} onClose={() => setCheckInOpen(false)} date={today} />
    </div>
  );
}

/** Minimal progress ring showing where in the cycle today sits. */
function CycleRing({ day, length }: { day: number; length: number }) {
  const pct = Math.min(day / Math.max(length, 1), 1);
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" className="shrink-0">
      <circle cx="34" cy="34" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-rose-100" />
      <circle
        cx="34"
        cy="34"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        transform="rotate(-90 34 34)"
        className="text-rose-500"
      />
      <text x="34" y="39" textAnchor="middle" className="fill-rose-700 text-[15px] font-bold">
        {day}
      </text>
    </svg>
  );
}
