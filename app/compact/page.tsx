"use client";

import { useMemo } from "react";

interface Departure {
  id: string;
  destination: string;
  scheduled: string;
  delayMinutes?: number;
  platform?: string;
}

const SAMPLE_DEPARTURES: Departure[] = [
  { id: "1", destination: "Hamburg-Altona", scheduled: "08:12", delayMinutes: 5, platform: "4" },
  { id: "2", destination: "Berlin Hbf", scheduled: "08:25", delayMinutes: 12, platform: "7" },
  { id: "3", destination: "München Hbf", scheduled: "08:33", platform: "2" },
  { id: "4", destination: "Leipzig", scheduled: "08:45", delayMinutes: 3, platform: "5" },
];

function formatDelay(delayMinutes?: number): string | null {
  if (!delayMinutes || delayMinutes <= 0) return null;
  return `(+${delayMinutes})`;
}

export default function CompactDeparturesPage(): JSX.Element {
  const departures = useMemo(() => SAMPLE_DEPARTURES, []);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Kompaktansicht</p>
        <h1 className="text-2xl font-bold text-rose-900">Abfahrten</h1>
        <p className="text-sm text-rose-900/70">
          Planmäßige Zeit mit Verspätungsangabe direkt dahinter. Gleis- und Verspätungshinweise sind bewusst
          kompakter gesetzt.
        </p>
      </header>

      <section className="space-y-3">
        {departures.map((departure) => {
          const delayLabel = formatDelay(departure.delayMinutes);

          return (
            <article
              key={departure.id}
              className="rounded-xl border border-rose-100 bg-white/90 px-4 py-3 shadow-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-baseline gap-2 text-rose-900">
                    <span className="text-2xl font-semibold tracking-tight">{departure.scheduled}</span>
                    {delayLabel ? (
                      <span className="text-[11px] font-semibold text-rose-600">{delayLabel}</span>
                    ) : null}
                  </div>
                  <p className="truncate text-sm text-rose-900/80">{departure.destination}</p>
                </div>

                <div className="flex flex-col items-end text-rose-900/80">
                  <span className="text-[11px] font-medium uppercase tracking-wide">Gleis</span>
                  <span className="text-xs font-semibold">
                    {departure.platform ? departure.platform : <span className="text-rose-400">–</span>}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
