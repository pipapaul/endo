"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/data/DataProvider";
import { createEmptyDailyEntry } from "@/lib/data/factory";
import { visibleSections, type StepId } from "./checkin/sections";
import type { DailyEntry } from "@/lib/types";

export function QuickCheckIn({
  open,
  onClose,
  date,
  initialStep,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  /** Jump straight to a given section (used when amending from the journal). */
  initialStep?: StepId;
}) {
  const { getDailyEntry, upsertDailyEntry, flags, productSettings } = useData();
  const [draft, setDraft] = useState<DailyEntry>(
    () => getDailyEntry(date) ?? createEmptyDailyEntry(date)
  );

  const steps = useMemo(() => visibleSections(flags), [flags]);
  const startIndex = useMemo(() => {
    if (!initialStep) return 0;
    const i = steps.findIndex((s) => s.id === initialStep);
    return i >= 0 ? i : 0;
  }, [initialStep, steps]);
  const [step, setStep] = useState(startIndex);

  const dateLabel = useMemo(() => {
    const [y, m, dd] = date.split("-").map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, [date]);

  const isLast = step === steps.length - 1;
  const current = steps[Math.min(step, steps.length - 1)];
  const Editor = current.Editor;

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
          <Editor draft={draft} setDraft={setDraft} flags={flags} productSettings={productSettings} />
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
