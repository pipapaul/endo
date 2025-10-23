"use client";

import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

type StepConfig = { id: Step; title: string };

const STEPS: StepConfig[] = [
  { id: 1, title: "Zusammenfassung" },
  { id: 2, title: "Leitfragen" },
  { id: 3, title: "Prüfen & Absenden" },
];

export function Stepper(props: { current: Step; onStepChange: (n: Step) => void }): JSX.Element {
  const { current, onStepChange } = props;
  const totalSteps = STEPS.length;
  const progress = ((current - 1) / Math.max(totalSteps - 1, 1)) * 100;

  return (
    <nav
      className="rounded-xl border border-rose-100 bg-white/80 p-4 shadow-sm"
      aria-label="Fortschritt des Wochenablaufs"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-rose-900">Schritt {current} von {totalSteps}</p>
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((step) => {
            const isActive = step.id === current;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => onStepChange(step.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition",
                    isActive
                      ? "border-rose-500 bg-rose-500 text-white shadow-sm"
                      : "border-rose-200 bg-white text-rose-800 hover:border-rose-400 hover:text-rose-900"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
                      isActive
                        ? "border-white bg-white/20 text-white"
                        : "border-rose-300 bg-rose-50 text-rose-700"
                    )}
                  >
                    {step.id}
                  </span>
                  <span className="font-medium">{step.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="mt-4 h-1 w-full rounded-full bg-rose-100">
        <div
          className="h-full rounded-full bg-rose-500 transition-all"
          style={{ width: `${progress}%` }}
          aria-hidden={true}
        />
      </div>
    </nav>
  );
}
