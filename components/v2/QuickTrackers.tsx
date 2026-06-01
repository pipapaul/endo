"use client";

import { useState } from "react";
import { Activity, Droplet, Pill, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, Chip } from "./ui";
import { PainEntryFlow, type PainEntryDraft } from "./checkin/PainEntryFlow";
import { CATEGORY_COLORS, type CategoryColor } from "./checkin/sections";
import { ExtendedBleedingEntryForm } from "@/components/home/ExtendedBleedingEntry";
import { useData } from "@/lib/data/DataProvider";
import {
  SIMPLE_BLEEDING_INTENSITIES,
  getSimpleBleedingPbacEquivalent,
  calculatePbacScore,
  normalizePbacCounts,
  aggregateExtendedPbacData,
  createEmptyExtendedPbacData,
  type SimpleBleedingIntensity,
  type PbacCountKey,
  type ExtendedBleedingEntry as ExtBleedingEntry,
  type FreeBleedingEntry,
} from "@/lib/pbac";
import { cn } from "@/lib/utils";
import type { DailyEntry } from "@/lib/types";

type Tracker = "pain" | "period" | "med" | null;
type Saturation = "light" | "medium" | "heavy";

const COMMON_MEDS = ["Ibuprofen", "Paracetamol", "Naproxen", "Buscopan", "Novalgin"];

// v1-style classic PBAC quick-add: tap a product/saturation to add it.
const CLASSIC_PADS: { key: PbacCountKey; sat: Saturation; label: string }[] = [
  { key: "pad_light", sat: "light", label: "leicht" },
  { key: "pad_medium", sat: "medium", label: "mittel" },
  { key: "pad_heavy", sat: "heavy", label: "stark" },
];
const CLASSIC_TAMPONS: { key: PbacCountKey; sat: Saturation; label: string }[] = [
  { key: "tampon_light", sat: "light", label: "leicht" },
  { key: "tampon_medium", sat: "medium", label: "mittel" },
  { key: "tampon_heavy", sat: "heavy", label: "stark" },
];
const CLASSIC_CLOTS: { key: PbacCountKey; label: string }[] = [
  { key: "clot_small", label: "Koagel <2 cm" },
  { key: "clot_large", label: "Koagel ≥2 cm" },
];
const SAT_TILE: Record<Saturation, string> = {
  light: "border-rose-200 bg-rose-100 text-rose-600",
  medium: "border-rose-300 bg-rose-200 text-rose-700",
  heavy: "border-rose-500 bg-rose-500 text-white",
};

/**
 * Quick-trackers — fast, in-the-moment logging that lives below the quick
 * check-in. Each tile opens a tiny sheet and writes straight into today's
 * entry, so nothing about the daily data model changes.
 */
export function QuickTrackers({ date }: { date: string }) {
  const { getDailyEntry, updateDailyEntry, productSettings } = useData();
  const entry = getDailyEntry(date);
  const [active, setActive] = useState<Tracker>(null);
  const [medName, setMedName] = useState("");

  const method = productSettings.trackingMethod;

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

  const logIntensity = (intensity: SimpleBleedingIntensity) => {
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

  // Classic quick-add: increment a product/clot count for today (stays open).
  const addProduct = (key: PbacCountKey) =>
    updateDailyEntry(date, (prev): DailyEntry => {
      const counts = { ...normalizePbacCounts(prev.pbacCounts), [key]: normalizePbacCounts(prev.pbacCounts)[key] + 1 };
      const score = calculatePbacScore(counts);
      return {
        ...prev,
        pbacCounts: counts,
        simpleBleedingIntensity: undefined,
        bleeding: { ...prev.bleeding, isBleeding: true, pbacScore: score },
      };
    });

  const addExtended = (e: ExtBleedingEntry | FreeBleedingEntry) =>
    updateDailyEntry(date, (prev): DailyEntry => {
      const base = prev.extendedPbacData ?? createEmptyExtendedPbacData("pbac_extended");
      const isFree = !("productId" in e);
      const merged = {
        ...base,
        trackingMethod: "pbac_extended" as const,
        extendedEntries: isFree
          ? base.extendedEntries ?? []
          : [...(base.extendedEntries ?? []), e as ExtBleedingEntry],
        freeBleedingEntries: isFree
          ? [...(base.freeBleedingEntries ?? []), e as FreeBleedingEntry]
          : base.freeBleedingEntries ?? [],
      };
      const agg = aggregateExtendedPbacData(merged, prev.pbacCounts);
      return {
        ...prev,
        simpleBleedingIntensity: undefined,
        extendedPbacData: { ...merged, totalEstimatedVolumeMl: agg.totalVolumeMl, totalPbacEquivalentScore: agg.totalPbacEquivalent },
        bleeding: { ...prev.bleeding, isBleeding: true, pbacScore: agg.totalPbacEquivalent },
      };
    });

  const logMed = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = new Date();
    updateDailyEntry(date, (prev): DailyEntry => ({
      ...prev,
      rescueMeds: [...(prev.rescueMeds ?? []), { name: trimmed, time: now.toTimeString().slice(0, 5) }],
    }));
    close();
  };

  const counts = normalizePbacCounts(entry?.pbacCounts);
  const painCount = entry?.quickPainEvents?.length ?? 0;
  const medCount = entry?.rescueMeds?.length ?? 0;
  const periodBadge =
    method === "simple"
      ? entry?.simpleBleedingIntensity && entry.simpleBleedingIntensity !== "none"
        ? SIMPLE_BLEEDING_INTENSITIES.find((b) => b.id === entry.simpleBleedingIntensity)?.label
        : entry?.bleeding?.isBleeding
          ? "Blutung"
          : undefined
      : entry?.bleeding?.pbacScore
        ? `PBAC ${entry.bleeding.pbacScore}`
        : undefined;

  return (
    <>
      <div className="grid grid-cols-3 gap-2.5">
        <TrackerTile
          icon={<Activity className="h-5 w-5" />}
          label="Schmerz"
          color={CATEGORY_COLORS.pain}
          badge={painCount > 0 ? `${painCount}×` : undefined}
          onClick={() => setActive("pain")}
        />
        <TrackerTile
          icon={<Droplet className="h-5 w-5" />}
          label="Periode"
          color={CATEGORY_COLORS.bleeding}
          badge={periodBadge}
          onClick={() => setActive("period")}
        />
        <TrackerTile
          icon={<Pill className="h-5 w-5" />}
          label="Medikament"
          color={CATEGORY_COLORS.meds}
          badge={medCount > 0 ? `${medCount}×` : undefined}
          onClick={() => setActive("med")}
        />
      </div>

      <Sheet open={active === "pain"} onClose={close} title="Akut-Schmerz eintragen">
        <PainEntryFlow requireTime={false} onCommit={logPain} onCancel={close} />
      </Sheet>

      <Sheet
        open={active === "period"}
        onClose={close}
        title="Periode / Blutung"
        footer={
          method !== "simple" ? (
            <Button type="button" onClick={close} className="w-full rounded-2xl py-3">
              Fertig
            </Button>
          ) : undefined
        }
      >
        {method === "simple" ? (
          <>
            <p className="mb-3 text-sm text-rose-600">Wie stark blutest du gerade?</p>
            <div className="flex flex-wrap gap-2">
              {SIMPLE_BLEEDING_INTENSITIES.map((b) => (
                <Chip key={b.id} selected={entry?.simpleBleedingIntensity === b.id} onClick={() => logIntensity(b.id)}>
                  {b.label}
                </Chip>
              ))}
            </div>
          </>
        ) : method === "pbac_classic" ? (
          <div className="space-y-4">
            <p className="text-sm text-rose-600">Tippe an, was du gewechselt hast – der PBAC-Score zählt mit.</p>
            <ProductRow label="Binden" items={CLASSIC_PADS} counts={counts} onAdd={addProduct} />
            <ProductRow label="Tampons" items={CLASSIC_TAMPONS} counts={counts} onAdd={addProduct} />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Koagel</p>
              <div className="grid grid-cols-2 gap-2">
                {CLASSIC_CLOTS.map((c) => (
                  <ProductTile
                    key={c.key}
                    label={c.label}
                    count={counts[c.key]}
                    className="border-rose-200 bg-white text-rose-700"
                    onClick={() => addProduct(c.key)}
                  />
                ))}
              </div>
            </div>
            <p className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700">
              PBAC-Score heute: {calculatePbacScore(counts)}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <ExtendedBleedingEntryForm settings={productSettings} onAddEntry={addExtended} />
            {entry?.extendedPbacData?.totalPbacEquivalentScore ? (
              <p className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700">
                PBAC-Äquivalent heute: {entry.extendedPbacData.totalPbacEquivalentScore} · ~
                {entry.extendedPbacData.totalEstimatedVolumeMl} ml
              </p>
            ) : null}
          </div>
        )}
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

function ProductRow({
  label,
  items,
  counts,
  onAdd,
}: {
  label: string;
  items: { key: PbacCountKey; sat: Saturation; label: string }[];
  counts: Record<PbacCountKey, number>;
  onAdd: (key: PbacCountKey) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => (
          <ProductTile
            key={it.key}
            label={it.label}
            count={counts[it.key]}
            className={SAT_TILE[it.sat]}
            onClick={() => onAdd(it.key)}
          />
        ))}
      </div>
    </div>
  );
}

function ProductTile({
  label,
  count,
  className,
  onClick,
}: {
  label: string;
  count: number;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 text-sm font-medium shadow-sm transition active:scale-95",
        className
      )}
    >
      <Droplet className="h-4 w-4" />
      {label}
      {count > 0 ? (
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-rose-600 shadow">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function TrackerTile({
  icon,
  label,
  color,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: CategoryColor;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        backgroundImage: `linear-gradient(to bottom right, ${color.pastel}, #ffffff)`,
        borderColor: color.border,
      }}
      className="relative flex flex-col items-center gap-1.5 rounded-2xl border py-3.5 shadow-sm transition active:scale-95"
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
        style={{ color: color.saturated }}
      >
        {icon}
      </span>
      <span className="text-[12px] font-semibold" style={{ color: color.saturated }}>
        {label}
      </span>
      <span
        className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-white/80 px-1 text-[10px] font-bold shadow-sm"
        style={{ color: color.saturated }}
      >
        <Plus className="h-3 w-3" />
      </span>
      {badge ? (
        <span className="text-[10px] font-medium text-gray-500">{badge}</span>
      ) : (
        <span className="text-[10px] text-transparent">·</span>
      )}
    </button>
  );
}
