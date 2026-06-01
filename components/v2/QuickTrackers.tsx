"use client";

import { useState } from "react";
import { Activity, Droplet, Pill, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, Chip } from "./ui";
import { PainEntryFlow, type PainEntryDraft } from "./checkin/PainEntryFlow";
import { useData } from "@/lib/data/DataProvider";
import {
  SIMPLE_BLEEDING_INTENSITIES,
  getSimpleBleedingPbacEquivalent,
  type SimpleBleedingIntensity,
} from "@/lib/pbac";
import type { DailyEntry } from "@/lib/types";

type Tracker = "pain" | "period" | "med" | null;

const COMMON_MEDS = ["Ibuprofen", "Paracetamol", "Naproxen", "Buscopan", "Novalgin"];

/**
 * Quick-trackers — fast, in-the-moment logging that lives below the quick
 * check-in. Each tile opens a tiny sheet and writes straight into today's
 * entry, so nothing about the daily data model changes.
 */
export function QuickTrackers({ date }: { date: string }) {
  const { getDailyEntry, updateDailyEntry } = useData();
  const entry = getDailyEntry(date);
  const [active, setActive] = useState<Tracker>(null);

  // local sheet state
  const [medName, setMedName] = useState("");

  const close = () => {
    setActive(null);
    setMedName("");
  };

  const logPain = (e: PainEntryDraft) => {
    const now = new Date();
    updateDailyEntry(date, (prev): DailyEntry => {
      const event = {
        id: Date.now(),
        date,
        timestamp: now.toISOString(),
        regionId: e.regionId,
        intensity: e.nrs,
        qualities: e.qualities,
        timeOfDay: e.times,
        granularity: e.times.length > 0 ? ("dritteltag" as const) : ("tag" as const),
      };
      return { ...prev, quickPainEvents: [...(prev.quickPainEvents ?? []), event] };
    });
    close();
  };

  const logPeriod = (intensity: SimpleBleedingIntensity) => {
    updateDailyEntry(date, (prev): DailyEntry => ({
      ...prev,
      simpleBleedingIntensity: intensity,
      bleeding: {
        ...prev.bleeding,
        isBleeding: intensity !== "none",
        pbacScore: getSimpleBleedingPbacEquivalent(intensity),
      },
    }));
    close();
  };

  const logMed = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = new Date();
    updateDailyEntry(date, (prev): DailyEntry => ({
      ...prev,
      rescueMeds: [
        ...(prev.rescueMeds ?? []),
        { name: trimmed, time: now.toTimeString().slice(0, 5) },
      ],
    }));
    close();
  };

  const painCount = entry?.quickPainEvents?.length ?? 0;
  const medCount = entry?.rescueMeds?.length ?? 0;
  const periodLabel = entry?.simpleBleedingIntensity
    ? SIMPLE_BLEEDING_INTENSITIES.find((b) => b.id === entry.simpleBleedingIntensity)?.label
    : entry?.bleeding?.isBleeding
      ? "Blutung"
      : null;

  return (
    <>
      <div className="grid grid-cols-3 gap-2.5">
        <TrackerTile
          icon={<Activity className="h-5 w-5" />}
          label="Schmerz"
          badge={painCount > 0 ? `${painCount}×` : undefined}
          onClick={() => setActive("pain")}
        />
        <TrackerTile
          icon={<Droplet className="h-5 w-5" />}
          label="Periode"
          badge={periodLabel ?? undefined}
          onClick={() => setActive("period")}
        />
        <TrackerTile
          icon={<Pill className="h-5 w-5" />}
          label="Medikament"
          badge={medCount > 0 ? `${medCount}×` : undefined}
          onClick={() => setActive("med")}
        />
      </div>

      <Sheet open={active === "pain"} onClose={close} title="Akut-Schmerz eintragen">
        <PainEntryFlow requireTime={false} onCommit={logPain} onCancel={close} />
      </Sheet>

      <Sheet open={active === "period"} onClose={close} title="Periodenprodukt / Blutung">
        <p className="mb-3 text-sm text-rose-600">Wie stark blutest du gerade?</p>
        <div className="flex flex-wrap gap-2">
          {SIMPLE_BLEEDING_INTENSITIES.map((b) => (
            <Chip
              key={b.id}
              selected={entry?.simpleBleedingIntensity === b.id}
              onClick={() => logPeriod(b.id)}
            >
              {b.label}
            </Chip>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={active === "med"}
        onClose={close}
        title="Medikament eintragen"
        footer={
          <Button type="button" onClick={() => logMed(medName)} className="w-full rounded-2xl py-3">
            Eintragen
          </Button>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {COMMON_MEDS.map((m) => (
            <Chip key={m} selected={medName === m} onClick={() => setMedName(m)}>
              {m}
            </Chip>
          ))}
        </div>
        <input
          value={medName}
          onChange={(e) => setMedName(e.target.value)}
          placeholder="oder eigenes Medikament…"
          className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-900 placeholder:text-rose-300 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
        />
      </Sheet>
    </>
  );
}

function TrackerTile({
  icon,
  label,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-center gap-1.5 rounded-2xl border border-rose-100 bg-white/90 py-3.5 text-rose-700 shadow-sm transition active:scale-95 hover:border-rose-200 hover:bg-rose-50"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-500">
        {icon}
      </span>
      <span className="text-[12px] font-semibold">{label}</span>
      <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-100 px-1 text-[10px] font-bold text-rose-600">
        <Plus className="h-3 w-3" />
      </span>
      {badge ? (
        <span className="text-[10px] font-medium text-rose-400">{badge}</span>
      ) : (
        <span className="text-[10px] text-transparent">·</span>
      )}
    </button>
  );
}
