"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "./ui";
import { useData } from "@/lib/data/DataProvider";
import { createEmptyDailyEntry } from "@/lib/data/factory";
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

type StepId = "pain" | "bleeding" | "symptoms" | "mood" | "sleep" | "digestion" | "meds" | "notes";

export function QuickCheckIn({
  open,
  onClose,
  date,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
}) {
  const { getDailyEntry, upsertDailyEntry } = useData();
  const [draft, setDraft] = useState<DailyEntry>(
    () => getDailyEntry(date) ?? createEmptyDailyEntry(date)
  );
  const [step, setStep] = useState(0);
  const [medName, setMedName] = useState("");

  const patch = (p: Partial<DailyEntry>) => setDraft((d) => ({ ...d, ...p }));

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

  const steps: { id: StepId; title: string; question: string; body: React.ReactNode }[] = [
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
        </div>
      ),
    },
    {
      id: "bleeding",
      title: "Blutung",
      question: "Wie stark war deine Blutung?",
      body: (
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
          <div className="space-y-1">
            <p className="text-sm font-medium text-rose-700">Stunden geschlafen</p>
            <NumberField
              id="wz-sleep-hours"
              value={draft.sleep?.hours}
              onChange={(v) => patch({ sleep: { ...draft.sleep, hours: v } })}
            />
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

  const isLast = step === steps.length - 1;
  const current = steps[step];

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
