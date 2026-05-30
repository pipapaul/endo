"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, Disclosure } from "./ui";
import { useData } from "@/lib/data/DataProvider";
import { createEmptyDailyEntry } from "@/lib/data/factory";
import { BODY_REGION_GROUPS } from "@/lib/painRegions";
import { BodyMap } from "./BodyMap";
import { NrsInput, MultiSelectChips, ScoreInput, NumberField } from "@/components/home/inputs";
import { SleepQualityPicker } from "@/components/home/SleepQualityPicker";
import { BristolScalePicker, type BristolType } from "@/components/home/BristolScalePicker";
import {
  SIMPLE_BLEEDING_INTENSITIES,
  getSimpleBleedingPbacEquivalent,
  type SimpleBleedingIntensity,
} from "@/lib/pbac";
import type { DailyEntry, PainQuality } from "@/lib/types";
import type { SymptomKey } from "@/lib/home/constants";

const PAIN_QUALITY_OPTIONS = [
  { value: "krampfend", label: "krampfend" },
  { value: "stechend", label: "stechend" },
  { value: "brennend", label: "brennend" },
  { value: "dumpf", label: "dumpf" },
  { value: "ziehend", label: "ziehend" },
  { value: "anders", label: "anders" },
];

const MOODS: { value: 1 | 2 | 3 | 4; emoji: string; label: string }[] = [
  { value: 1, emoji: "😞", label: "schlecht" },
  { value: 2, emoji: "😕", label: "geht so" },
  { value: 3, emoji: "🙂", label: "gut" },
  { value: 4, emoji: "😄", label: "super" },
];

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

type StepId =
  | "pain"
  | "bleeding"
  | "cervix"
  | "symptoms"
  | "mood"
  | "sleep"
  | "digestion"
  | "meds"
  | "notes";

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

export function QuickCheckIn({
  open,
  onClose,
  date,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
}) {
  const { getDailyEntry, upsertDailyEntry, flags } = useData();
  const [draft, setDraft] = useState<DailyEntry>(
    () => getDailyEntry(date) ?? createEmptyDailyEntry(date)
  );
  const [step, setStep] = useState(0);
  const [medName, setMedName] = useState("");

  const patch = (p: Partial<DailyEntry>) => setDraft((d) => ({ ...d, ...p }));

  const toggleRegion = (id: string) =>
    setDraft((d) => {
      const set = new Set(d.painMapRegionIds ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...d, painMapRegionIds: Array.from(set) };
    });

  const setSymptom = (key: SymptomKey, present: boolean, score?: number) =>
    setDraft((d) => ({
      ...d,
      symptoms: { ...d.symptoms, [key]: { present, score: score ?? d.symptoms?.[key]?.score } },
    }));

  const dateLabel = useMemo(() => {
    const [y, m, dd] = date.split("-").map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, [date]);

  const allSteps: {
    id: StepId;
    title: string;
    question: string;
    body: React.ReactNode;
    hidden?: boolean;
  }[] = [
    {
      id: "pain",
      title: "Schmerzen",
      question: "Hattest du heute Schmerzen?",
      body: (
        <div className="space-y-5">
          <NrsInput id="wz-pain" value={draft.painNRS ?? 0} onChange={(v) => patch({ painNRS: v })} />
          <div className="space-y-2">
            <p className="text-sm font-medium text-rose-700">Schmerzart</p>
            <MultiSelectChips
              options={PAIN_QUALITY_OPTIONS}
              value={draft.painQuality ?? []}
              onToggle={(next) => patch({ painQuality: next as PainQuality[] })}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-rose-700">Wo tut es weh?</p>
            <BodyMap selected={draft.painMapRegionIds ?? []} onToggle={toggleRegion} />
            <Disclosure label="Arme & Beine">
              {BODY_REGION_GROUPS.filter((g) => g.id === "arms" || g.id === "legs").map((group) => (
                <div key={group.id} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.regions.map((region) => (
                      <Chip
                        key={region.id}
                        selected={(draft.painMapRegionIds ?? []).includes(region.id)}
                        onClick={() => toggleRegion(region.id)}
                      >
                        {region.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
            </Disclosure>
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
                id="wz-ovu"
                value={draft.ovulationPain?.intensity ?? 0}
                onChange={(v) => patch({ ovulationPain: { ...draft.ovulationPain, intensity: v } })}
              />
            ) : null}
          </Disclosure>
        </div>
      ),
    },
    {
      id: "bleeding",
      title: "Blutung",
      question: "Wie stark war deine Blutung?",
      body: (
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
                  onClick={() => patch({ bleeding: { ...draft.bleeding, isBleeding: true, clots: !draft.bleeding?.clots } })}
                >
                  Koagel / Klümpchen
                </Chip>
                <Chip
                  selected={draft.bleeding?.flooding ?? false}
                  onClick={() => patch({ bleeding: { ...draft.bleeding, isBleeding: true, flooding: !draft.bleeding?.flooding } })}
                >
                  Durchbruchblutung
                </Chip>
              </div>
            </Disclosure>
          ) : null}
        </div>
      ),
    },
    {
      id: "cervix",
      title: "Zervixschleim",
      hidden: !flags.billingMethod,
      question: "Wie war dein Zervixschleim heute?",
      body: (
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
      ),
    },
    {
      id: "symptoms",
      title: "Symptome",
      question: "Welche Symptome hattest du? (mit Stärke)",
      body: (
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
                id={`wz-sym-${s.key}`}
                label={s.label}
                value={draft.symptoms?.[s.key]?.score ?? 5}
                onChange={(v) => setSymptom(s.key, true, v)}
              />
            </div>
          ))}
          <Disclosure label="Weitere Beschwerden (Kopf, Schwindel, Blase)">
            <div className="space-y-3">
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
                      id="wz-head-nrs"
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
                  <div className="rounded-2xl border border-rose-100 bg-white/70 p-3">
                    <ScoreInput
                      id="wz-diz-nrs"
                      label="Stärke"
                      value={draft.dizzinessOpt?.nrs ?? 0}
                      onChange={(v) => patch({ dizzinessOpt: { ...draft.dizzinessOpt, present: true, nrs: v } })}
                    />
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Chip
                  selected={draft.urinaryOpt?.present ?? false}
                  onClick={() =>
                    patch({ urinaryOpt: { ...draft.urinaryOpt, present: !draft.urinaryOpt?.present } })
                  }
                >
                  Harndrang / Blase
                </Chip>
                {draft.urinaryOpt?.present ? (
                  <div className="rounded-2xl border border-rose-100 bg-white/70 p-3">
                    <ScoreInput
                      id="wz-urg"
                      label="Harndrang"
                      value={draft.urinaryOpt?.urgency ?? 0}
                      onChange={(v) => patch({ urinaryOpt: { ...draft.urinaryOpt, present: true, urgency: v } })}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </Disclosure>
        </div>
      ),
    },
    {
      id: "mood",
      title: "Stimmung",
      question: "Wie war deine Stimmung heute?",
      body: (
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
      ),
    },
    {
      id: "sleep",
      title: "Schlaf",
      question: "Wie hast du geschlafen?",
      body: (
        <div className="space-y-4">
          <SleepQualityPicker
            value={draft.sleep?.quality}
            onChange={(v) => patch({ sleep: { ...draft.sleep, quality: v } })}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-rose-700">Stunden</p>
              <NumberField
                id="wz-sleep-hours"
                value={draft.sleep?.hours}
                onChange={(v) => patch({ sleep: { ...draft.sleep, hours: v } })}
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-rose-700">Aufgewacht (×)</p>
              <NumberField
                id="wz-sleep-wake"
                value={draft.sleep?.awakenings}
                onChange={(v) => patch({ sleep: { ...draft.sleep, awakenings: v } })}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "digestion",
      title: "Verdauung",
      question: "Wie war deine Verdauung? (Bristol-Skala)",
      body: (
        <BristolScalePicker
          value={draft.gi?.bristolType}
          onChange={(v: BristolType) => patch({ gi: { ...draft.gi, bristolType: v } })}
        />
      ),
    },
    {
      id: "meds",
      title: "Medikamente",
      question: "Hast du Medikamente genommen?",
      body: (
        <div className="space-y-3">
          {(draft.rescueMeds ?? []).length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {draft.rescueMeds!.map((med, i) => (
                <li
                  key={`${med.name}-${i}`}
                  className="flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-sm text-rose-700"
                >
                  {med.name}
                  <button
                    type="button"
                    aria-label="Entfernen"
                    onClick={() =>
                      patch({ rescueMeds: draft.rescueMeds!.filter((_, idx) => idx !== i) })
                    }
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
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => {
                const name = medName.trim();
                if (!name) return;
                patch({
                  rescueMeds: [
                    ...(draft.rescueMeds ?? []),
                    { name, time: new Date().toTimeString().slice(0, 5) },
                  ],
                });
                setMedName("");
              }}
            >
              Hinzufügen
            </Button>
          </div>
        </div>
      ),
    },
    {
      id: "notes",
      title: "Notizen",
      question: "Möchtest du etwas festhalten?",
      body: (
        <textarea
          value={draft.notesFree ?? ""}
          onChange={(e) => patch({ notesFree: e.target.value })}
          rows={4}
          placeholder="Freitext…"
          className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-900 placeholder:text-rose-300 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
        />
      ),
    },
  ];

  const steps = allSteps.filter((s) => !s.hidden);
  const isLast = step === steps.length - 1;
  const current = steps[Math.min(step, steps.length - 1)];

  const save = () => {
    const cleaned: DailyEntry = { ...draft, notesFree: draft.notesFree?.trim() || undefined };
    upsertDailyEntry(cleaned);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-rose-50 shadow-2xl sm:rounded-3xl">
        {/* Header with progress */}
        <div className="border-b border-rose-100 bg-white/80 px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-rose-400">
                Schnell-Check-in · {dateLabel}
              </p>
              <h2 className="text-lg font-bold text-rose-900">{current.title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="rounded-full p-1.5 text-rose-500 transition hover:bg-rose-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex gap-1">
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Schritt ${i + 1}: ${s.title}`}
                onClick={() => setStep(i)}
                className={`h-1.5 flex-1 rounded-full transition ${
                  i <= step ? "bg-rose-500" : "bg-rose-200"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <p className="mb-4 text-base font-medium text-rose-800">{current.question}</p>
          {current.body}
        </div>

        {/* Footer nav */}
        <div className="flex items-center gap-2 border-t border-rose-100 bg-white/80 px-5 py-3">
          {step > 0 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-2xl"
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Zurück
            </Button>
          ) : (
            <span className="flex-1" />
          )}
          <span className="flex-1" />
          {isLast ? (
            <Button type="button" onClick={save} className="rounded-2xl px-6">
              <Check className="mr-1 h-4 w-4" /> Speichern
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((s) => s + 1)}
                className="rounded-2xl text-rose-400"
              >
                Überspringen
              </Button>
              <Button type="button" onClick={() => setStep((s) => s + 1)} className="rounded-2xl px-5">
                Weiter <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
