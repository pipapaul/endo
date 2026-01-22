"use client";

import { cn } from "@/lib/utils";

export type BristolType = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface BristolOption {
  value: BristolType;
  label: string;
  description: string;
  category: "hard" | "normal" | "soft";
}

const BRISTOL_OPTIONS: BristolOption[] = [
  { value: 1, label: "Sehr hart", description: "Einzelne harte Klumpen", category: "hard" },
  { value: 2, label: "Hart", description: "Wurstförmig, klumpig", category: "hard" },
  { value: 3, label: "Leicht hart", description: "Wurstförmig mit Rissen", category: "hard" },
  { value: 4, label: "Normal", description: "Glatt, weich, wurstförmig", category: "normal" },
  { value: 5, label: "Weich", description: "Weiche Klümpchen", category: "soft" },
  { value: 6, label: "Breiig", description: "Breiig, ungeformt", category: "soft" },
  { value: 7, label: "Flüssig", description: "Wässrig, keine festen Bestandteile", category: "soft" },
];

const CATEGORY_COLORS = {
  hard: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", selected: "bg-amber-100 border-amber-400" },
  normal: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", selected: "bg-emerald-100 border-emerald-400" },
  soft: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-800", selected: "bg-rose-100 border-rose-400" },
};

interface BristolScalePickerProps {
  value: BristolType | undefined;
  onChange: (value: BristolType) => void;
  compact?: boolean;
}

export function BristolScalePicker({ value, onChange, compact = false }: BristolScalePickerProps) {
  if (compact) {
    // Compact mode: 7 small buttons in a row
    return (
      <div className="flex gap-1.5">
        {BRISTOL_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          const colors = CATEGORY_COLORS[option.category];
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              title={`${option.label}: ${option.description}`}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-bold transition",
                isSelected
                  ? colors.selected
                  : `${colors.bg} ${colors.border} hover:opacity-80`,
                colors.text
              )}
            >
              {option.value}
            </button>
          );
        })}
      </div>
    );
  }

  // Full mode: Cards with descriptions
  return (
    <div className="space-y-2">
      {/* Hard category (1-3) */}
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-amber-600">Verstopfung</p>
        <div className="grid grid-cols-3 gap-2">
          {BRISTOL_OPTIONS.filter((o) => o.category === "hard").map((option) => {
            const isSelected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                className={cn(
                  "flex flex-col items-center rounded-xl border p-3 text-center transition",
                  isSelected
                    ? "border-amber-400 bg-amber-100"
                    : "border-amber-200 bg-amber-50 hover:border-amber-300"
                )}
              >
                <span className="text-lg font-bold text-amber-700">{option.value}</span>
                <span className="text-xs font-medium text-amber-800">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Normal category (4) */}
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-emerald-600">Normal</p>
        <button
          type="button"
          onClick={() => onChange(4)}
          className={cn(
            "flex w-full flex-col items-center rounded-xl border p-3 text-center transition",
            value === 4
              ? "border-emerald-400 bg-emerald-100"
              : "border-emerald-200 bg-emerald-50 hover:border-emerald-300"
          )}
        >
          <span className="text-lg font-bold text-emerald-700">4</span>
          <span className="text-xs font-medium text-emerald-800">Normal – glatt, weich, wurstförmig</span>
        </button>
      </div>

      {/* Soft category (5-7) */}
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-rose-600">Durchfall</p>
        <div className="grid grid-cols-3 gap-2">
          {BRISTOL_OPTIONS.filter((o) => o.category === "soft").map((option) => {
            const isSelected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                className={cn(
                  "flex flex-col items-center rounded-xl border p-3 text-center transition",
                  isSelected
                    ? "border-rose-400 bg-rose-100"
                    : "border-rose-200 bg-rose-50 hover:border-rose-300"
                )}
              >
                <span className="text-lg font-bold text-rose-700">{option.value}</span>
                <span className="text-xs font-medium text-rose-800">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { BRISTOL_OPTIONS };
