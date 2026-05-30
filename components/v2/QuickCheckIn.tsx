"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, ScalePicker, Chip } from "./ui";
import { useData } from "@/lib/data/DataProvider";
import {
  SIMPLE_BLEEDING_INTENSITIES,
  getSimpleBleedingPbacEquivalent,
  type SimpleBleedingIntensity,
} from "@/lib/pbac";
import type { SymptomKey } from "@/lib/home/constants";
import type { DailyEntry } from "@/lib/types";

const MOODS: { value: 1 | 2 | 3 | 4; emoji: string; label: string }[] = [
  { value: 1, emoji: "😞", label: "schlecht" },
  { value: 2, emoji: "😕", label: "geht so" },
  { value: 3, emoji: "🙂", label: "gut" },
  { value: 4, emoji: "😄", label: "super" },
];

const QUICK_SYMPTOMS: { key: SymptomKey; label: string }[] = [
  { key: "fatigue", label: "Müdigkeit" },
  { key: "bloating", label: "Blähbauch" },
  { key: "moodSwings", label: "Stimmungstief" },
  { key: "dyschezia", label: "Schmerz Stuhlgang" },
  { key: "dysuria", label: "Schmerz Wasserlassen" },
  { key: "deepDyspareunia", label: "Schmerz beim Sex" },
  { key: "pelvicPainNonMenses", label: "Beckenschmerz" },
  { key: "skinProblems", label: "Hautprobleme" },
];

const SLEEP_QUALITY = [
  { value: 1, label: "😴 schlecht" },
  { value: 3, label: "😐 mittel" },
  { value: 5, label: "🌟 gut" },
];

function Field({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-rose-900">{title}</h3>
        {hint ? <span className="text-xs text-rose-400">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function QuickCheckIn({
  open,
  onClose,
  date,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
}) {
  const { getDailyEntry, updateDailyEntry } = useData();
  const existing = getDailyEntry(date);

  // Initialise local state from the existing entry so this doubles as edit.
  const [pain, setPain] = useState<number | null>(existing?.painNRS ?? null);
  const [bleeding, setBleeding] = useState<SimpleBleedingIntensity | null>(
    existing?.simpleBleedingIntensity ?? (existing?.bleeding?.isBleeding ? "medium" : null)
  );
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | null>(existing?.mood ?? null);
  const [symptoms, setSymptoms] = useState<Set<SymptomKey>>(
    new Set(
      (Object.keys(existing?.symptoms ?? {}) as SymptomKey[]).filter(
        (k) => existing?.symptoms?.[k]?.present
      )
    )
  );
  const [sleepQuality, setSleepQuality] = useState<number | null>(existing?.sleep?.quality ?? null);
  const [note, setNote] = useState(existing?.notesFree ?? "");
  const [showMore, setShowMore] = useState(false);

  const toggleSymptom = (key: SymptomKey) =>
    setSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const dateLabel = useMemo(() => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, [date]);

  const handleSave = () => {
    updateDailyEntry(date, (prev): DailyEntry => {
      const next: DailyEntry = { ...prev };

      if (pain !== null) next.painNRS = pain;

      if (bleeding !== null) {
        next.simpleBleedingIntensity = bleeding;
        next.bleeding = {
          ...prev.bleeding,
          isBleeding: bleeding !== "none",
          pbacScore: getSimpleBleedingPbacEquivalent(bleeding),
        };
      }

      if (mood !== null) next.mood = mood;

      const nextSymptoms = { ...prev.symptoms };
      for (const { key } of QUICK_SYMPTOMS) {
        if (symptoms.has(key)) nextSymptoms[key] = { ...nextSymptoms[key], present: true };
        else if (nextSymptoms[key]?.present) nextSymptoms[key] = { ...nextSymptoms[key], present: false };
      }
      next.symptoms = nextSymptoms;

      if (sleepQuality !== null) next.sleep = { ...prev.sleep, quality: sleepQuality };
      next.notesFree = note.trim() ? note.trim() : undefined;

      return next;
    });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <span className="flex flex-col">
          <span>Schnell-Check-in</span>
          <span className="text-xs font-normal text-rose-500">{dateLabel}</span>
        </span>
      }
      footer={
        <Button type="button" onClick={handleSave} className="w-full rounded-2xl py-3 text-base">
          Speichern
        </Button>
      }
    >
      <div className="space-y-6 pb-2">
        <Field title="Schmerzen" hint={pain !== null ? `${pain}/10` : "kein Tap = überspringen"}>
          <ScalePicker value={pain} onChange={setPain} />
        </Field>

        <Field title="Blutung">
          <div className="flex flex-wrap gap-2">
            {SIMPLE_BLEEDING_INTENSITIES.map((b) => (
              <Chip
                key={b.id}
                selected={bleeding === b.id}
                onClick={() => setBleeding(b.id)}
              >
                {b.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field title="Stimmung">
          <div className="flex gap-2">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(m.value)}
                className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border py-3 transition active:scale-95 ${
                  mood === m.value
                    ? "border-rose-500 bg-rose-50 shadow-sm"
                    : "border-rose-200 bg-white hover:border-rose-300"
                }`}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[11px] font-medium text-rose-600">{m.label}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field title="Symptome" hint="mehrere möglich">
          <div className="flex flex-wrap gap-2">
            {QUICK_SYMPTOMS.map((s) => (
              <Chip key={s.key} selected={symptoms.has(s.key)} onClick={() => toggleSymptom(s.key)}>
                {s.label}
              </Chip>
            ))}
          </div>
        </Field>

        {showMore ? (
          <>
            <Field title="Schlaf">
              <div className="flex gap-2">
                {SLEEP_QUALITY.map((s) => (
                  <Chip
                    key={s.value}
                    selected={sleepQuality === s.value}
                    onClick={() => setSleepQuality(s.value)}
                    className="flex-1 text-center"
                  >
                    {s.label}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field title="Notiz">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Was möchtest du festhalten?"
                className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-900 placeholder:text-rose-300 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </Field>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="w-full rounded-2xl border border-dashed border-rose-200 py-3 text-sm font-medium text-rose-500 transition hover:border-rose-300 hover:text-rose-600"
          >
            + Schlaf & Notiz
          </button>
        )}
      </div>
    </Sheet>
  );
}
