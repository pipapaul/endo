"use client";

import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  Activity,
  Droplet,
  Droplets,
  HeartPulse,
  Minus,
  Moon,
  Pill,
  Plus,
  Smile,
  Soup,
  StickyNote,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, Disclosure } from "../ui";
import { getRegionLabel } from "@/lib/painRegions";
import { PainEntryFlow, type PainEntryDraft } from "./PainEntryFlow";
import { NrsInput, ScoreInput, NumberField } from "@/components/home/inputs";
import { SleepQualityPicker } from "@/components/home/SleepQualityPicker";
import { BristolScalePicker, type BristolType } from "@/components/home/BristolScalePicker";
import { ExtendedBleedingEntryForm } from "@/components/home/ExtendedBleedingEntry";
import {
  SIMPLE_BLEEDING_INTENSITIES,
  getSimpleBleedingPbacEquivalent,
  calculatePbacScore,
  normalizePbacCounts,
  aggregateExtendedPbacData,
  createEmptyExtendedPbacData,
  DEFAULT_PRODUCTS,
  type SimpleBleedingIntensity,
  type PbacCountKey,
  type ExtendedBleedingEntry as ExtBleedingEntry,
  type FreeBleedingEntry,
} from "@/lib/pbac";
import type { ProductSettings } from "@/lib/productSettings";
import type { DailyEntry, FeatureFlags, PainQuality } from "@/lib/types";
import type { SymptomKey } from "@/lib/home/constants";

/**
 * Single source of truth for the daily data-collection UI.
 *
 * Both the wizard-style {@link QuickCheckIn} and the compact day-detail view in
 * the journal render the very same section editors and summaries from here, so
 * the two stay in lockstep and no field can drift between "fast entry" and
 * "review & amend". Field coverage mirrors the v1 data model so nothing is
 * captured at lower precision than the old app.
 */

export type StepId =
  | "pain"
  | "bleeding"
  | "cervix"
  | "symptoms"
  | "mood"
  | "sleep"
  | "digestion"
  | "meds"
  | "notes";

type Setter = Dispatch<SetStateAction<DailyEntry>>;

export interface EditorProps {
  draft: DailyEntry;
  setDraft: Setter;
  flags: FeatureFlags;
  productSettings: ProductSettings;
}

export interface CategoryColor {
  saturated: string;
  pastel: string;
  border: string;
}

/** Per-area colours, carried over 1:1 from v1 for visual consistency. */
export const CATEGORY_COLORS: Record<StepId, CategoryColor> = {
  pain: { saturated: "#a855f7", pastel: "#f8f0fc", border: "rgba(168, 85, 247, 0.25)" },
  bleeding: { saturated: "#e8524a", pastel: "#fdf0ef", border: "rgba(232, 82, 74, 0.25)" },
  cervix: { saturated: "#14b8a6", pastel: "#e8f6f1", border: "rgba(20, 184, 166, 0.25)" },
  symptoms: { saturated: "#ec4899", pastel: "#fcf0f4", border: "rgba(236, 72, 153, 0.25)" },
  mood: { saturated: "#10b981", pastel: "#ecfdf5", border: "rgba(16, 185, 129, 0.25)" },
  sleep: { saturated: "#8b5cf6", pastel: "#f3f0fa", border: "rgba(139, 92, 246, 0.25)" },
  digestion: { saturated: "#ec4899", pastel: "#fcf0f4", border: "rgba(236, 72, 153, 0.25)" },
  meds: { saturated: "#0ea5e9", pastel: "#edf5fc", border: "rgba(14, 165, 233, 0.25)" },
  notes: { saturated: "#f97316", pastel: "#faf4ed", border: "rgba(249, 115, 22, 0.25)" },
};

export interface CheckInSection {
  id: StepId;
  title: string;
  icon: LucideIcon;
  /** Per-area accent colour (header pill, journal highlight, progress bar). */
  color: CategoryColor;
  /** Prompt shown above the editor (entry sub-step / single-section edit). */
  question: string;
  /**
   * Optional yes/no presence question (v1 style). When set, the wizard opens
   * the step with this question and Ja/Nein buttons; "Ja" reveals the editor,
   * "Nein" skips to the next step. Sections without a gate go straight in.
   */
  gate?: string;
  /** Hide the whole section unless the relevant feature flag is on. */
  hidden?: (flags: FeatureFlags) => boolean;
  /** Compact chips for the day overview; empty array = nothing recorded yet. */
  summary: (entry: DailyEntry) => string[];
  /** Returns an error message that blocks saving/advancing, or null if valid. */
  validate?: (entry: DailyEntry) => string | null;
  /** The editor body, shared by wizard step and single-section edit sheet. */
  Editor: (props: EditorProps) => ReactNode;
}

// ── shared option lists ──────────────────────────────────────────────────────

const MOODS: { value: 1 | 2 | 3 | 4; emoji: string; label: string }[] = [
  { value: 1, emoji: "😞", label: "schlecht" },
  { value: 2, emoji: "😕", label: "geht so" },
  { value: 3, emoji: "🙂", label: "gut" },
  { value: 4, emoji: "😄", label: "super" },
];

export const MOOD_EMOJI: Record<number, string> = { 1: "😞", 2: "😕", 3: "🙂", 4: "😄" };

const WIZARD_SYMPTOMS: { key: SymptomKey; label: string }[] = [
  { key: "dysmenorrhea", label: "Regelschmerzen" },
  { key: "fatigue", label: "Erschöpfung" },
  { key: "bloating", label: "Blähbauch" },
  { key: "moodSwings", label: "Stimmungsschwankungen" },
  { key: "dyschezia", label: "Schmerz beim Stuhlgang" },
  { key: "dysuria", label: "Schmerz beim Wasserlassen" },
  { key: "deepDyspareunia", label: "Schmerz beim Sex" },
  { key: "pelvicPainNonMenses", label: "Beckenschmerz (unabh.)" },
  { key: "skinProblems", label: "Hautprobleme" },
];

const COMMON_MEDS = ["Ibuprofen", "Paracetamol", "Naproxen", "Buscopan", "Novalgin"];

const MUCUS_OBSERVATION = [
  { id: "dry", label: "trocken" },
  { id: "moist", label: "feucht" },
  { id: "wet", label: "nass" },
  { id: "slippery", label: "spinnbar / glitschig" },
] as const;

const MUCUS_APPEARANCE = [
  { id: "none", label: "nichts" },
  { id: "sticky", label: "klebrig" },
  { id: "creamy", label: "cremig" },
  { id: "eggWhite", label: "eiweißartig" },
] as const;

const OVU_SIDES = [
  { id: "links", label: "Links" },
  { id: "rechts", label: "Rechts" },
  { id: "beidseitig", label: "Beidseitig" },
  { id: "unsicher", label: "Unsicher" },
] as const;

const BRISTOL_LABEL: Record<number, string> = {
  1: "hart (Typ 1)",
  2: "klumpig (Typ 2)",
  3: "rissig (Typ 3)",
  4: "normal (Typ 4)",
  5: "weich (Typ 5)",
  6: "breiig (Typ 6)",
  7: "flüssig (Typ 7)",
};

const CLASSIC_GROUPS: { label: string; keys: PbacCountKey[] }[] = [
  { label: "Binden", keys: ["pad_light", "pad_medium", "pad_heavy"] },
  { label: "Tampons", keys: ["tampon_light", "tampon_medium", "tampon_heavy"] },
];
const CLOT_KEYS: { key: PbacCountKey; label: string }[] = [
  { key: "clot_small", label: "Koagel klein" },
  { key: "clot_large", label: "Koagel groß" },
];
const CLASSIC_LABEL: Record<string, string> =
  Object.fromEntries(DEFAULT_PRODUCTS.map((p) => [p.id, p.nameShort ?? p.name]));

// ── helpers ──────────────────────────────────────────────────────────────────

const makePatch =
  (setDraft: Setter) =>
  (p: Partial<DailyEntry>) =>
    setDraft((d) => ({ ...d, ...p }));

type PainRegion = NonNullable<DailyEntry["painRegions"]>[number];

/** Keep the flat painNRS/painQuality fields in sync with per-region detail. */
function painAggregates(regions: PainRegion[]): Pick<DailyEntry, "painNRS" | "painQuality"> {
  let max = 0;
  const q = new Set<PainQuality>();
  for (const r of regions) {
    if ((r.nrs ?? 0) > max) max = r.nrs ?? 0;
    for (const x of r.qualities ?? []) q.add(x as PainQuality);
  }
  return { painNRS: max, painQuality: Array.from(q) };
}

// ── section editors ──────────────────────────────────────────────────────────

function PainEditor({ draft, setDraft }: EditorProps) {
  const patch = makePatch(setDraft);
  const [adding, setAdding] = useState(false);

  const regions = draft.painRegions ?? [];
  const events = draft.quickPainEvents ?? [];
  const hasEntries = regions.length > 0 || events.length > 0;

  const commit = (e: PainEntryDraft) =>
    setDraft((d) => {
      const next: PainRegion[] = [
        ...(d.painRegions ?? []),
        {
          regionId: e.regionId,
          nrs: e.nrs,
          qualities: e.qualities,
          timeOfDay: e.times,
          granularity: e.times.length > 0 ? "dritteltag" : "tag",
        },
      ];
      const ids = Array.from(new Set(next.map((r) => r.regionId)));
      return { ...d, painRegions: next, painMapRegionIds: ids, ...painAggregates(next) };
    });

  const removeRegion = (index: number) =>
    setDraft((d) => {
      const next = (d.painRegions ?? []).filter((_, i) => i !== index);
      return { ...d, painRegions: next, painMapRegionIds: next.map((r) => r.regionId), ...painAggregates(next) };
    });

  const removeEvent = (id: number) =>
    setDraft((d) => ({ ...d, quickPainEvents: (d.quickPainEvents ?? []).filter((e) => e.id !== id) }));

  // Add flow: pick region, then intensity/quality/time (v1-style, multi-step).
  if (adding) {
    return (
      <PainEntryFlow
        requireTime
        onCommit={(e) => {
          commit(e);
          setAdding(false);
        }}
        onCancel={() => setAdding(false)}
      />
    );
  }

  return (
    <div className="space-y-5">
      {hasEntries ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-rose-400">Erfasste Schmerzen</p>
          {regions.map((r, i) => (
            <div
              key={`r-${i}`}
              className="flex items-center justify-between rounded-2xl border border-rose-100 bg-white/70 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-rose-800">{getRegionLabel(r.regionId)}</p>
                <p className="text-xs text-rose-500">
                  Intensität {r.nrs}/10
                  {r.qualities?.length ? ` · ${r.qualities.join(", ")}` : ""}
                  {r.timeOfDay?.length ? ` · ${r.timeOfDay.join(", ")}` : ""}
                </p>
              </div>
              <button
                type="button"
                aria-label="Entfernen"
                onClick={() => removeRegion(i)}
                className="shrink-0 text-rose-400 hover:text-rose-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {events.map((e) => (
            <div
              key={`e-${e.id}`}
              className="flex items-center justify-between rounded-2xl border border-rose-100 bg-white/70 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-rose-800">
                  {e.regionId ? getRegionLabel(e.regionId) : "Akut-Schmerz"}
                </p>
                <p className="text-xs text-rose-500">
                  Intensität {e.intensity}/10
                  {e.qualities?.length ? ` · ${e.qualities.join(", ")}` : ""}
                </p>
              </div>
              <button
                type="button"
                aria-label="Entfernen"
                onClick={() => removeEvent(e.id)}
                className="shrink-0 text-rose-400 hover:text-rose-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <Button type="button" variant="outline" onClick={() => setAdding(true)} className="w-full rounded-2xl">
        <Plus className="mr-1 h-4 w-4" /> {hasEntries ? "Weiteren Schmerz hinzufügen" : "Schmerz hinzufügen"}
      </Button>

      <div className="space-y-1">
        <p className="text-sm font-medium text-rose-700">Wie sehr hat es dich beeinträchtigt?</p>
        <NrsInput
          id="pain-impact"
          value={draft.impactNRS ?? 0}
          onChange={(v) => patch({ impactNRS: v })}
          minLabel="0 gar nicht"
          maxLabel="10 sehr stark"
        />
      </div>

      <Disclosure label="Eisprungschmerz (Mittelschmerz)" defaultOpen={!!draft.ovulationPain?.side}>
        <div className="flex flex-wrap gap-2">
          {OVU_SIDES.map((s) => (
            <Chip
              key={s.id}
              selected={draft.ovulationPain?.side === s.id}
              onClick={() => patch({ ovulationPain: { ...draft.ovulationPain, side: s.id } })}
            >
              {s.label}
            </Chip>
          ))}
        </div>
        {draft.ovulationPain?.side ? (
          <NrsInput
            id="pain-ovu"
            value={draft.ovulationPain?.intensity ?? 0}
            onChange={(v) => patch({ ovulationPain: { ...draft.ovulationPain, intensity: v } })}
          />
        ) : null}
      </Disclosure>
    </div>
  );
}

// ── bleeding (method-driven, mirrors v1) ─────────────────────────────────────

function SimpleBleedingEditor({ draft, setDraft }: EditorProps) {
  const patch = makePatch(setDraft);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SIMPLE_BLEEDING_INTENSITIES.map((b) => (
          <Chip
            key={b.id}
            selected={draft.simpleBleedingIntensity === b.id}
            onClick={() =>
              patch({
                simpleBleedingIntensity: b.id as SimpleBleedingIntensity,
                bleeding: {
                  ...draft.bleeding,
                  isBleeding: b.id !== "none",
                  pbacScore: getSimpleBleedingPbacEquivalent(b.id),
                },
              })
            }
          >
            {b.label}
          </Chip>
        ))}
      </div>
      {draft.bleeding?.isBleeding ? (
        <Disclosure label="Besonderheiten" defaultOpen={draft.bleeding?.clots || draft.bleeding?.flooding}>
          <div className="flex flex-wrap gap-2">
            <Chip
              selected={draft.bleeding?.clots ?? false}
              onClick={() =>
                patch({ bleeding: { ...draft.bleeding, isBleeding: true, clots: !draft.bleeding?.clots } })
              }
            >
              Koagel / Klümpchen
            </Chip>
            <Chip
              selected={draft.bleeding?.flooding ?? false}
              onClick={() =>
                patch({ bleeding: { ...draft.bleeding, isBleeding: true, flooding: !draft.bleeding?.flooding } })
              }
            >
              Durchbruchblutung
            </Chip>
          </div>
        </Disclosure>
      ) : null}
    </div>
  );
}

function ClassicBleedingEditor({ draft, setDraft, productSettings }: EditorProps) {
  const counts = normalizePbacCounts(draft.pbacCounts);
  const enabled = new Set(productSettings.enabledProductIds);

  const setCount = (key: PbacCountKey, value: number) =>
    setDraft((d) => {
      const next = { ...normalizePbacCounts(d.pbacCounts), [key]: Math.max(0, value) };
      const score = calculatePbacScore(next);
      const anyBleeding = Object.values(next).some((v) => v > 0);
      return {
        ...d,
        pbacCounts: next,
        simpleBleedingIntensity: undefined,
        bleeding: { ...d.bleeding, isBleeding: anyBleeding, pbacScore: score },
      };
    });

  const score = calculatePbacScore(counts);

  return (
    <div className="space-y-4">
      {CLASSIC_GROUPS.map((group) => {
        const keys = group.keys.filter((k) => enabled.size === 0 || enabled.has(k));
        if (keys.length === 0) return null;
        return (
          <div key={group.label} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">{group.label}</p>
            {keys.map((key) => (
              <CounterRow
                key={key}
                label={CLASSIC_LABEL[key] ?? key}
                value={counts[key]}
                onChange={(v) => setCount(key, v)}
              />
            ))}
          </div>
        );
      })}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Koagel</p>
        {CLOT_KEYS.map(({ key, label }) => (
          <CounterRow key={key} label={label} value={counts[key]} onChange={(v) => setCount(key, v)} />
        ))}
      </div>
      <p className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700">PBAC-Score: {score}</p>
    </div>
  );
}

function ExtendedBleedingEditor({ draft, setDraft, productSettings }: EditorProps) {
  const recompute = (next: NonNullable<DailyEntry["extendedPbacData"]>): DailyEntry["extendedPbacData"] => {
    const agg = aggregateExtendedPbacData(next, draft.pbacCounts);
    return { ...next, totalEstimatedVolumeMl: agg.totalVolumeMl, totalPbacEquivalentScore: agg.totalPbacEquivalent };
  };

  const addEntry = (entry: ExtBleedingEntry | FreeBleedingEntry) =>
    setDraft((d) => {
      const prev = d.extendedPbacData ?? createEmptyExtendedPbacData("pbac_extended");
      const isFree = !("productId" in entry);
      const next = recompute({
        ...prev,
        trackingMethod: "pbac_extended",
        extendedEntries: isFree
          ? prev.extendedEntries ?? []
          : [...(prev.extendedEntries ?? []), entry as ExtBleedingEntry],
        freeBleedingEntries: isFree
          ? [...(prev.freeBleedingEntries ?? []), entry as FreeBleedingEntry]
          : prev.freeBleedingEntries ?? [],
      })!;
      return {
        ...d,
        extendedPbacData: next,
        simpleBleedingIntensity: undefined,
        bleeding: { ...d.bleeding, isBleeding: true, pbacScore: next.totalPbacEquivalentScore ?? 0 },
      };
    });

  const removeEntry = (id: string) =>
    setDraft((d) => {
      const prev = d.extendedPbacData ?? createEmptyExtendedPbacData("pbac_extended");
      const next = recompute({
        ...prev,
        extendedEntries: (prev.extendedEntries ?? []).filter((e) => e.id !== id),
        freeBleedingEntries: (prev.freeBleedingEntries ?? []).filter((e) => e.id !== id),
      })!;
      const remaining = (next.extendedEntries?.length ?? 0) + (next.freeBleedingEntries?.length ?? 0);
      return {
        ...d,
        extendedPbacData: next,
        bleeding: { ...d.bleeding, isBleeding: remaining > 0, pbacScore: next.totalPbacEquivalentScore ?? 0 },
      };
    });

  const data = draft.extendedPbacData;
  const entries: { id: string; label: string }[] = [
    ...(data?.extendedEntries ?? []).map((e) => ({
      id: e.id,
      label: `${CLASSIC_LABEL[e.productId] ?? e.productId} · ${e.fillLevelPercent}% · ~${e.estimatedVolumeMl} ml`,
    })),
    ...(data?.freeBleedingEntries ?? []).map((e) => ({
      id: e.id,
      label: `Freies Bluten · ${e.intensity} · ~${e.estimatedVolumeMl} ml`,
    })),
  ];

  return (
    <div className="space-y-4">
      {entries.length > 0 ? (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-2 rounded-2xl border border-rose-100 bg-white/70 px-3 py-2 text-sm text-rose-700"
            >
              <span>{e.label}</span>
              <button
                type="button"
                aria-label="Eintrag entfernen"
                onClick={() => removeEntry(e.id)}
                className="rounded-full p-1 text-rose-400 hover:bg-rose-100"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <ExtendedBleedingEntryForm settings={productSettings} onAddEntry={addEntry} />
      {data?.totalPbacEquivalentScore ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700">
          PBAC-Äquivalent: {data.totalPbacEquivalentScore} · ~{data.totalEstimatedVolumeMl} ml
        </p>
      ) : null}
    </div>
  );
}

function BleedingEditor(props: EditorProps) {
  switch (props.productSettings.trackingMethod) {
    case "pbac_classic":
      return <ClassicBleedingEditor {...props} />;
    case "pbac_extended":
      return <ExtendedBleedingEditor {...props} />;
    default:
      return <SimpleBleedingEditor {...props} />;
  }
}

function CervixEditor({ draft, setDraft }: EditorProps) {
  const patch = makePatch(setDraft);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-rose-700">Empfindung</p>
        <div className="flex flex-wrap gap-2">
          {MUCUS_OBSERVATION.map((o) => (
            <Chip
              key={o.id}
              selected={draft.cervixMucus?.observation === o.id}
              onClick={() => patch({ cervixMucus: { ...draft.cervixMucus, observation: o.id } })}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-rose-700">Aussehen</p>
        <div className="flex flex-wrap gap-2">
          {MUCUS_APPEARANCE.map((a) => (
            <Chip
              key={a.id}
              selected={draft.cervixMucus?.appearance === a.id}
              onClick={() => patch({ cervixMucus: { ...draft.cervixMucus, appearance: a.id } })}
            >
              {a.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

function SymptomsEditor({ draft, setDraft }: EditorProps) {
  const patch = makePatch(setDraft);
  const setSymptom = (key: SymptomKey, present: boolean, score?: number) =>
    setDraft((d) => ({
      ...d,
      symptoms: { ...d.symptoms, [key]: { present, score: score ?? d.symptoms?.[key]?.score } },
    }));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {WIZARD_SYMPTOMS.map((s) => {
          const present = draft.symptoms?.[s.key]?.present ?? false;
          return (
            <Chip key={s.key} selected={present} onClick={() => setSymptom(s.key, !present)}>
              {s.label}
            </Chip>
          );
        })}
      </div>
      {WIZARD_SYMPTOMS.filter((s) => draft.symptoms?.[s.key]?.present).map((s) => (
        <div key={s.key} className="rounded-2xl border border-rose-100 bg-white/70 p-3">
          <p className="mb-1 text-xs font-semibold text-rose-700">{s.label} – Stärke</p>
          <ScoreInput
            id={`sym-${s.key}`}
            label={s.label}
            value={draft.symptoms?.[s.key]?.score ?? 5}
            onChange={(v) => setSymptom(s.key, true, v)}
          />
        </div>
      ))}
      <Disclosure label="Weitere Beschwerden (Kopf, Schwindel, Blase)">
        <div className="space-y-3">
          {/* Headache */}
          <div className="space-y-2">
            <Chip
              selected={draft.headacheOpt?.present ?? false}
              onClick={() =>
                patch({ headacheOpt: { ...draft.headacheOpt, present: !draft.headacheOpt?.present } })
              }
            >
              Kopfschmerzen
            </Chip>
            {draft.headacheOpt?.present ? (
              <div className="space-y-2 rounded-2xl border border-rose-100 bg-white/70 p-3">
                <ScoreInput
                  id="head-nrs"
                  label="Stärke"
                  value={draft.headacheOpt?.nrs ?? 0}
                  onChange={(v) => patch({ headacheOpt: { ...draft.headacheOpt, present: true, nrs: v } })}
                />
                <Chip
                  selected={draft.headacheOpt?.aura ?? false}
                  onClick={() =>
                    patch({ headacheOpt: { ...draft.headacheOpt, present: true, aura: !draft.headacheOpt?.aura } })
                  }
                >
                  mit Aura
                </Chip>
              </div>
            ) : null}
          </div>
          {/* Dizziness */}
          <div className="space-y-2">
            <Chip
              selected={draft.dizzinessOpt?.present ?? false}
              onClick={() =>
                patch({ dizzinessOpt: { ...draft.dizzinessOpt, present: !draft.dizzinessOpt?.present } })
              }
            >
              Schwindel
            </Chip>
            {draft.dizzinessOpt?.present ? (
              <div className="space-y-2 rounded-2xl border border-rose-100 bg-white/70 p-3">
                <ScoreInput
                  id="diz-nrs"
                  label="Stärke"
                  value={draft.dizzinessOpt?.nrs ?? 0}
                  onChange={(v) => patch({ dizzinessOpt: { ...draft.dizzinessOpt, present: true, nrs: v } })}
                />
                <Chip
                  selected={draft.dizzinessOpt?.orthostatic ?? false}
                  onClick={() =>
                    patch({
                      dizzinessOpt: {
                        ...draft.dizzinessOpt,
                        present: true,
                        orthostatic: !draft.dizzinessOpt?.orthostatic,
                      },
                    })
                  }
                >
                  beim Aufstehen (orthostatisch)
                </Chip>
              </div>
            ) : null}
          </div>
          {/* Bladder / urinary */}
          <Disclosure label="Blase & Harnwege" defaultOpen={!!draft.urinary || !!draft.urinaryOpt?.present}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-rose-700">Miktionsfrequenz (×/Tag)</p>
                <NumberField
                  id="urinary-freq"
                  value={draft.urinary?.freqPerDay}
                  onChange={(v) => patch({ urinary: { ...draft.urinary, freqPerDay: v } })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-rose-700">Harndrang</p>
              <ScoreInput
                id="urinary-urgency"
                label="Harndrang"
                value={draft.urinary?.urgency ?? 0}
                onChange={(v) => patch({ urinary: { ...draft.urinary, urgency: v } })}
              />
            </div>
            <Disclosure
              label="Dranginkontinenz"
              defaultOpen={
                draft.urinaryOpt?.leaksCount != null ||
                draft.urinaryOpt?.padsCount != null ||
                draft.urinaryOpt?.nocturia != null
              }
            >
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-rose-700">Episoden</p>
                  <NumberField
                    id="urinary-leaks"
                    value={draft.urinaryOpt?.leaksCount}
                    onChange={(v) => patch({ urinaryOpt: { ...draft.urinaryOpt, present: true, leaksCount: v } })}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-rose-700">Vorlagen</p>
                  <NumberField
                    id="urinary-pads"
                    value={draft.urinaryOpt?.padsCount}
                    onChange={(v) => patch({ urinaryOpt: { ...draft.urinaryOpt, present: true, padsCount: v } })}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-rose-700">Nykturie</p>
                  <NumberField
                    id="urinary-nocturia"
                    value={draft.urinaryOpt?.nocturia}
                    onChange={(v) => patch({ urinaryOpt: { ...draft.urinaryOpt, present: true, nocturia: v } })}
                  />
                </div>
              </div>
            </Disclosure>
          </Disclosure>
        </div>
      </Disclosure>
    </div>
  );
}

function MoodEditor({ draft, setDraft }: EditorProps) {
  const patch = makePatch(setDraft);
  return (
    <div className="flex gap-2">
      {MOODS.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => patch({ mood: m.value })}
          className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border py-4 transition active:scale-95 ${
            draft.mood === m.value
              ? "border-rose-500 bg-rose-50 shadow-sm"
              : "border-rose-200 bg-white hover:border-rose-300"
          }`}
        >
          <span className="text-2xl">{m.emoji}</span>
          <span className="text-[11px] font-medium text-rose-600">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

function SleepEditor({ draft, setDraft }: EditorProps) {
  const patch = makePatch(setDraft);
  return (
    <div className="space-y-4">
      {/* Quality stays on the 0–10 data scale (use10Scale) to match stored data. */}
      <SleepQualityPicker
        use10Scale
        value={draft.sleep?.quality}
        onChange={(v) => patch({ sleep: { ...draft.sleep, quality: v } })}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-rose-700">Stunden</p>
          <input
            id="sleep-hours"
            type="number"
            min={0}
            max={24}
            step={0.5}
            inputMode="decimal"
            value={draft.sleep?.hours ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              const v = raw === "" ? undefined : Math.max(0, Math.min(24, Number(raw)));
              patch({ sleep: { ...draft.sleep, hours: Number.isNaN(v as number) ? undefined : v } });
            }}
            className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-2.5 text-sm text-rose-900 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-rose-700">Aufgewacht (×)</p>
          <NumberField
            id="sleep-wake"
            value={draft.sleep?.awakenings}
            onChange={(v) => patch({ sleep: { ...draft.sleep, awakenings: v } })}
          />
        </div>
      </div>
    </div>
  );
}

function DigestionEditor({ draft, setDraft }: EditorProps) {
  const patch = makePatch(setDraft);
  return (
    <BristolScalePicker
      value={draft.gi?.bristolType}
      onChange={(v: BristolType) => patch({ gi: { ...draft.gi, bristolType: v } })}
    />
  );
}

function MedsEditor({ draft, setDraft }: EditorProps) {
  const patch = makePatch(setDraft);
  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");

  const add = () => {
    const name = medName.trim();
    if (!name) return;
    const doseMg = medDose.trim() ? Number(medDose) : undefined;
    patch({
      rescueMeds: [
        ...(draft.rescueMeds ?? []),
        {
          name,
          doseMg: Number.isFinite(doseMg) ? doseMg : undefined,
          time: new Date().toTimeString().slice(0, 5),
        },
      ],
    });
    setMedName("");
    setMedDose("");
  };

  return (
    <div className="space-y-3">
      {(draft.rescueMeds ?? []).length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {draft.rescueMeds!.map((med, i) => (
            <li
              key={`${med.name}-${i}`}
              className="flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-sm text-rose-700"
            >
              {med.name}
              {med.doseMg ? ` ${med.doseMg} mg` : ""}
              {med.time ? ` · ${med.time}` : ""}
              <button
                type="button"
                aria-label="Entfernen"
                onClick={() => patch({ rescueMeds: draft.rescueMeds!.filter((_, idx) => idx !== i) })}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {COMMON_MEDS.map((m) => (
          <Chip key={m} selected={medName === m} onClick={() => setMedName(m)}>
            {m}
          </Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={medName}
          onChange={(e) => setMedName(e.target.value)}
          placeholder="Medikament…"
          className="flex-1 rounded-2xl border border-rose-200 bg-white px-4 py-2.5 text-sm text-rose-900 placeholder:text-rose-300 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
        />
        <input
          value={medDose}
          onChange={(e) => setMedDose(e.target.value)}
          inputMode="numeric"
          placeholder="mg"
          className="w-20 rounded-2xl border border-rose-200 bg-white px-3 py-2.5 text-sm text-rose-900 placeholder:text-rose-300 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
        />
        <Button type="button" variant="outline" className="rounded-2xl" onClick={add}>
          Hinzufügen
        </Button>
      </div>
    </div>
  );
}

function NotesEditor({ draft, setDraft }: EditorProps) {
  const patch = makePatch(setDraft);
  return (
    <textarea
      value={draft.notesFree ?? ""}
      onChange={(e) => patch({ notesFree: e.target.value })}
      rows={4}
      placeholder="Freitext…"
      className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-900 placeholder:text-rose-300 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
    />
  );
}

/** +/- stepper used by the classic PBAC counter. */
function CounterRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-white/70 px-4 py-2">
      <span className="text-sm text-rose-800">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="weniger"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 text-rose-600 active:scale-90 disabled:opacity-40"
          disabled={value <= 0}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-6 text-center text-sm font-semibold text-rose-900">{value}</span>
        <button
          type="button"
          aria-label="mehr"
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 text-rose-600 active:scale-90"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── summaries ────────────────────────────────────────────────────────────────

function painSummary(e: DailyEntry): string[] {
  const parts: string[] = [];
  if (e.painNRS > 0) parts.push(`Stärke ${e.painNRS}/10`);
  if (e.painQuality?.length) parts.push(e.painQuality.join(", "));
  const regions = e.painMapRegionIds ?? [];
  if (regions.length)
    parts.push(regions.map((id) => getRegionLabel(id)).slice(0, 3).join(", ") + (regions.length > 3 ? "…" : ""));
  if (e.impactNRS) parts.push(`Beeinträchtigung ${e.impactNRS}/10`);
  if (e.ovulationPain?.side) parts.push("Eisprungschmerz");
  return parts;
}

function bleedingSummary(e: DailyEntry): string[] {
  const parts: string[] = [];
  const classicScore = e.pbacCounts ? calculatePbacScore(normalizePbacCounts(e.pbacCounts)) : 0;
  const extScore = e.extendedPbacData?.totalPbacEquivalentScore ?? 0;
  if (classicScore > 0) parts.push(`PBAC ${classicScore}`);
  else if (extScore > 0) parts.push(`PBAC ${extScore}`);
  else if (e.simpleBleedingIntensity && e.simpleBleedingIntensity !== "none") {
    const label = SIMPLE_BLEEDING_INTENSITIES.find((b) => b.id === e.simpleBleedingIntensity)?.label;
    if (label) parts.push(label);
  } else if (e.bleeding?.isBleeding) parts.push("Blutung");
  if (e.bleeding?.clots) parts.push("Koagel");
  if (e.bleeding?.flooding) parts.push("Durchbruch");
  return parts;
}

function symptomsSummary(e: DailyEntry): string[] {
  const parts = WIZARD_SYMPTOMS.filter((s) => e.symptoms?.[s.key]?.present).map((s) => s.label);
  if (e.headacheOpt?.present) parts.push("Kopfschmerzen");
  if (e.dizzinessOpt?.present) parts.push("Schwindel");
  if (e.urinary?.urgency || e.urinary?.freqPerDay || e.urinaryOpt?.present) parts.push("Blase");
  return parts;
}

// ── section registry ─────────────────────────────────────────────────────────

export const CHECKIN_SECTIONS: CheckInSection[] = [
  {
    id: "pain",
    title: "Schmerzen",
    icon: Activity,
    color: CATEGORY_COLORS.pain,
    gate: "Hattest du heute Schmerzen?",
    question: "Wo und wie stark?",
    summary: painSummary,
    Editor: PainEditor,
  },
  {
    id: "bleeding",
    title: "Blutung",
    icon: Droplet,
    color: CATEGORY_COLORS.bleeding,
    gate: "Hattest du heute eine Blutung?",
    question: "Wie stark war deine Blutung?",
    summary: bleedingSummary,
    Editor: BleedingEditor,
  },
  {
    id: "cervix",
    title: "Zervixschleim",
    icon: Droplets,
    color: CATEGORY_COLORS.cervix,
    question: "Wie war dein Zervixschleim heute?",
    hidden: (flags) => !flags.billingMethod,
    summary: (e) => {
      const parts: string[] = [];
      const obs = MUCUS_OBSERVATION.find((o) => o.id === e.cervixMucus?.observation)?.label;
      const app = MUCUS_APPEARANCE.find((a) => a.id === e.cervixMucus?.appearance)?.label;
      if (obs) parts.push(obs);
      if (app && app !== "nichts") parts.push(app);
      return parts;
    },
    Editor: CervixEditor,
  },
  {
    id: "symptoms",
    title: "Symptome",
    icon: HeartPulse,
    color: CATEGORY_COLORS.symptoms,
    gate: "Hattest du heute Symptome?",
    question: "Welche Symptome? (mit Stärke)",
    summary: symptomsSummary,
    Editor: SymptomsEditor,
  },
  {
    id: "mood",
    title: "Stimmung",
    icon: Smile,
    color: CATEGORY_COLORS.mood,
    question: "Wie war deine Stimmung heute?",
    summary: (e) => (e.mood ? [`${MOOD_EMOJI[e.mood]} ${MOODS.find((m) => m.value === e.mood)?.label}`] : []),
    Editor: MoodEditor,
  },
  {
    id: "sleep",
    title: "Schlaf",
    icon: Moon,
    color: CATEGORY_COLORS.sleep,
    question: "Wie hast du geschlafen?",
    summary: (e) => {
      const parts: string[] = [];
      if (e.sleep?.quality != null) parts.push(`Qualität ${e.sleep.quality}/10`);
      if (e.sleep?.hours != null) parts.push(`${e.sleep.hours} h`);
      if (e.sleep?.awakenings != null && e.sleep.awakenings > 0) parts.push(`${e.sleep.awakenings}× wach`);
      return parts;
    },
    Editor: SleepEditor,
  },
  {
    id: "digestion",
    title: "Verdauung",
    icon: Soup,
    color: CATEGORY_COLORS.digestion,
    question: "Wie war deine Verdauung? (Bristol-Skala)",
    summary: (e) => (e.gi?.bristolType ? [BRISTOL_LABEL[e.gi.bristolType]] : []),
    Editor: DigestionEditor,
  },
  {
    id: "meds",
    title: "Medikamente",
    icon: Pill,
    color: CATEGORY_COLORS.meds,
    gate: "Hast du Medikamente genommen?",
    question: "Welche Medikamente?",
    summary: (e) =>
      (e.rescueMeds ?? []).map((m) => (m.doseMg ? `${m.name} ${m.doseMg} mg` : m.name)),
    Editor: MedsEditor,
  },
  {
    id: "notes",
    title: "Notizen",
    icon: StickyNote,
    color: CATEGORY_COLORS.notes,
    question: "Möchtest du etwas festhalten?",
    summary: (e) => (e.notesFree?.trim() ? [e.notesFree.trim()] : []),
    Editor: NotesEditor,
  },
];

/** Sections visible for the current feature flags, in display order. */
export function visibleSections(flags: FeatureFlags): CheckInSection[] {
  return CHECKIN_SECTIONS.filter((s) => !s.hidden?.(flags));
}
