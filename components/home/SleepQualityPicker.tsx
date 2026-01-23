"use client";

import { cn } from "@/lib/utils";

interface SleepQualityOption {
  value: number;
  label: string;
  emoji: string;
}

const SLEEP_QUALITY_OPTIONS: SleepQualityOption[] = [
  { value: 1, label: "Sehr schlecht", emoji: "😫" },
  { value: 2, label: "Schlecht", emoji: "😕" },
  { value: 3, label: "Okay", emoji: "😐" },
  { value: 4, label: "Gut", emoji: "🙂" },
  { value: 5, label: "Sehr gut", emoji: "😴" },
];

// Map 1-5 scale to 0-10 for data compatibility
export const mapSleepQualityTo10Scale = (value: number): number => {
  const mapping: Record<number, number> = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10 };
  return mapping[value] ?? value;
};

// Map 0-10 scale back to 1-5 for display
export const mapSleepQualityFrom10Scale = (value: number): number => {
  if (value <= 2) return 1;
  if (value <= 4) return 2;
  if (value <= 6) return 3;
  if (value <= 8) return 4;
  return 5;
};

interface SleepQualityPickerProps {
  value: number | undefined;
  onChange: (value: number) => void;
  /** If true, the picker expects/returns 0-10 scale values (auto-maps internally) */
  use10Scale?: boolean;
}

export function SleepQualityPicker({ value, onChange, use10Scale = false }: SleepQualityPickerProps) {
  // Convert incoming value if using 10-scale
  const displayValue = use10Scale && value !== undefined ? mapSleepQualityFrom10Scale(value) : value;

  const handleChange = (newValue: number) => {
    // Convert outgoing value if using 10-scale
    onChange(use10Scale ? mapSleepQualityTo10Scale(newValue) : newValue);
  };

  return (
    <div className="flex justify-between gap-2">
      {SLEEP_QUALITY_OPTIONS.map((option) => {
        const isSelected = displayValue === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleChange(option.value)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-xl border p-3 transition",
              isSelected
                ? "border-rose-300 bg-rose-50"
                : "border-rose-100 bg-white hover:border-rose-200"
            )}
          >
            <span className="text-2xl">{option.emoji}</span>
            <span className="text-[10px] font-medium text-rose-600">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export { SLEEP_QUALITY_OPTIONS };
