"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/data/DataProvider";
import { createEmptyDailyEntry } from "@/lib/data/factory";
import { visibleSections, type StepId } from "./checkin/sections";
import type { DailyEntry } from "@/lib/types";

/**
 * Full-screen, guided check-in wizard. Design carried over from v1: one big
 * question per step as the focal point, a per-category colour accent (header
 * pill + progress bar + card tint), and a clean linear progress bar.
 */
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
  const Icon = current.icon;
  const color = current.color;
  const error = current.validate?.(draft) ?? null;

  const save = () => {
    if (error) return;
    const cleaned: DailyEntry = { ...draft, notesFree: draft.notesFree?.trim() || undefined };
    upsertDailyEntry(cleaned);
    onClose();
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
    else onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true">
      {/* Header */}
      <header className="border-b border-rose-100 bg-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 text-sm font-medium text-rose-600 hover:text-rose-800"
          >
            <ChevronLeft className="h-4 w-4" />
            {step > 0 ? "Zurück" : "Abbrechen"}
          </button>
          <span className="text-sm font-medium text-rose-500">
            {step + 1} von {steps.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-full p-1 text-rose-400 hover:bg-rose-100 hover:text-rose-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mx-auto mt-3 max-w-lg">
          <div className="h-1.5 overflow-hidden rounded-full bg-rose-100">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / steps.length) * 100}%`, backgroundColor: color.saturated }}
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto bg-gradient-to-b from-rose-50 to-white">
        <div className="mx-auto max-w-lg px-4 py-6">
          <div
            key={step}
            className="overflow-hidden rounded-2xl border p-6 shadow-lg"
            style={{
              borderColor: color.border,
              background: `linear-gradient(to bottom, ${color.pastel} 0%, ${color.pastel} 10%, white 35%)`,
            }}
          >
            <div className="mb-6">
              <div className="mb-4 flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: color.pastel }}
                >
                  <Icon className="h-4 w-4" style={{ color: color.saturated }} />
                </span>
                <span className="text-sm font-medium" style={{ color: color.saturated }}>
                  {current.title}
                </span>
                <span className="ml-auto text-[11px] uppercase tracking-wide text-gray-400">{dateLabel}</span>
              </div>
              <h2 className="text-2xl font-semibold leading-tight text-gray-900">{current.question}</h2>
            </div>
            <Editor draft={draft} setDraft={setDraft} flags={flags} productSettings={productSettings} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-rose-100 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-lg">
          {error ? <p className="mb-2 text-center text-xs font-medium text-red-500">{error}</p> : null}
          <div className="flex items-center gap-2">
            {!isLast ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => !error && setStep((s) => s + 1)}
                disabled={!!error}
                className="rounded-2xl text-rose-400"
              >
                Überspringen
              </Button>
            ) : null}
            <span className="flex-1" />
            {isLast ? (
              <Button
                type="button"
                onClick={save}
                disabled={!!error}
                className="rounded-2xl px-6"
                style={{ backgroundColor: color.saturated }}
              >
                <Check className="mr-1 h-4 w-4" /> Speichern
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => !error && setStep((s) => s + 1)}
                disabled={!!error}
                className="rounded-2xl px-6"
                style={{ backgroundColor: color.saturated }}
              >
                Weiter <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
