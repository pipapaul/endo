"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoreInput } from "@/components/home/inputs";
import { BODY_REGION_GROUPS, getRegionLabel } from "@/lib/painRegions";
import { cn } from "@/lib/utils";
import type { PainQuality, PainTimeOfDay } from "@/lib/types";

const PAIN_QUALITIES: { key: PainQuality; label: string }[] = [
  { key: "krampfend", label: "Krampfend" },
  { key: "stechend", label: "Stechend" },
  { key: "brennend", label: "Brennend" },
  { key: "dumpf", label: "Dumpf" },
  { key: "ziehend", label: "Ziehend" },
  { key: "anders", label: "Anders" },
];

const PAIN_TIMES: { id: PainTimeOfDay; label: string }[] = [
  { id: "morgens", label: "Morgens" },
  { id: "mittags", label: "Mittags" },
  { id: "abends", label: "Abends" },
];

export interface PainEntryDraft {
  regionId: string;
  nrs: number;
  qualities: PainQuality[];
  times: PainTimeOfDay[];
}

/**
 * Multi-step pain entry carried over from v1: first pick the body region, then
 * set intensity / quality / time of day. Clearer than one long form. Used by
 * both the wizard pain step and the quick tracker.
 */
export function PainEntryFlow({
  onCommit,
  onCancel,
  requireTime = true,
}: {
  onCommit: (entry: PainEntryDraft) => void;
  onCancel: () => void;
  /** Time of day mandatory (wizard). Off for the quick acute tracker. */
  requireTime?: boolean;
}) {
  const [region, setRegion] = useState<string | null>(null);
  const [nrs, setNrs] = useState(5);
  const [qualities, setQualities] = useState<PainQuality[]>([]);
  const [times, setTimes] = useState<PainTimeOfDay[]>([]);

  // Step 1: region
  if (!region) {
    return (
      <div>
        <div className="mb-4 text-center">
          <h3 className="text-lg font-semibold text-rose-900">Wo tut es weh?</h3>
          <p className="mt-1 text-sm text-rose-600">Wähle die Körperregion</p>
        </div>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto">
          {BODY_REGION_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-rose-400">{group.label}</p>
              <div className="grid grid-cols-2 gap-2">
                {group.regions.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRegion(r.id)}
                    className="rounded-xl border border-rose-100 bg-white px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-4 flex items-center gap-1 text-sm font-medium text-rose-500 hover:text-rose-700"
        >
          <ChevronLeft className="h-4 w-4" /> Abbrechen
        </button>
      </div>
    );
  }

  // Step 2: intensity + quality + time
  const canSave = qualities.length > 0 && (!requireTime || times.length > 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setRegion(null)}
          className="flex items-center gap-1 text-sm font-medium text-rose-500 hover:text-rose-700"
        >
          <ChevronLeft className="h-4 w-4" /> Region
        </button>
        <h3 className="text-base font-semibold text-rose-900">{getRegionLabel(region)}</h3>
        <span className="w-12" />
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-rose-700">Intensität</p>
          <ScoreInput id="pain-flow-nrs" label="Intensität" value={nrs} onChange={setNrs} />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-rose-700">Art des Schmerzes</p>
          <div className="flex flex-wrap gap-2">
            {PAIN_QUALITIES.map((q) => {
              const on = qualities.includes(q.key);
              return (
                <button
                  key={q.key}
                  type="button"
                  onClick={() =>
                    setQualities((prev) => (on ? prev.filter((x) => x !== q.key) : [...prev, q.key]))
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                    on
                      ? "border-rose-400 bg-rose-100 text-rose-800"
                      : "border-rose-200 bg-white text-rose-600 hover:border-rose-300"
                  )}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-rose-700">
            Zeitraum{requireTime ? <span className="text-rose-400"> · Pflicht, Mehrfachauswahl</span> : null}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {PAIN_TIMES.map((t) => {
              const on = times.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTimes((prev) => (on ? prev.filter((x) => x !== t.id) : [...prev, t.id]))}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-medium transition",
                    on
                      ? "border-rose-400 bg-rose-100 text-rose-800"
                      : "border-rose-200 bg-white text-rose-600 hover:border-rose-300"
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Button
        type="button"
        onClick={() => {
          onCommit({ regionId: region, nrs, qualities, times });
          setRegion(null);
          setNrs(5);
          setQualities([]);
          setTimes([]);
        }}
        disabled={!canSave}
        className="mt-6 w-full rounded-2xl bg-rose-600 py-3 text-white hover:bg-rose-500 disabled:opacity-50"
      >
        Schmerz speichern
      </Button>
    </div>
  );
}
