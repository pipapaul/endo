"use client";

import { useId } from "react";

import type { Nrs } from "@/lib/types";

interface NrsSliderProps {
  value: Nrs;
  onChange: (value: Nrs) => void;
  label?: string;
  hint?: string;
  labelHidden?: boolean;
}

const anchors: Array<{ value: Nrs; label: string }> = [
  { value: 0, label: "kein" },
  { value: 3, label: "leicht" },
  { value: 5, label: "mittel" },
  { value: 7, label: "stark" },
  { value: 10, label: "unerträglich" },
];

export function NrsSlider({ value, onChange, label = "Schmerzstärke", hint, labelHidden = false }: NrsSliderProps) {
  const id = useId();
  return (
    <div className="space-y-3" aria-live="polite">
      <label
        htmlFor={`${id}-range`}
        className={`block text-lg font-semibold ${labelHidden ? "sr-only" : ""}`}
      >
        {label}
      </label>
      {hint ? <p className="text-sm text-slate-600">{hint}</p> : null}
      <div className="flex items-center gap-3">
        <input
          id={`${id}-range`}
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          aria-valuenow={value}
          aria-valuetext={`${value} von 10`}
          onChange={(event) => onChange(Number(event.target.value) as Nrs)}
          className="h-12 w-full rounded-full bg-rose-100 accent-rose-500"
        />
        <input
          id={`${id}-number`}
          type="number"
          inputMode="numeric"
          pattern="^(10|[0-9])$"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(event) => {
            const next = Math.max(0, Math.min(10, Number(event.target.value)));
            onChange(next as Nrs);
          }}
          className="w-16 rounded-lg border border-rose-200 bg-white p-2 text-center text-base font-semibold"
          aria-label="Schmerzstärke als Zahl"
        />
      </div>
      <div className="relative mt-2 h-8">
        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-rose-200" aria-hidden="true" />
        <div className="flex justify-between">
          {anchors.map((anchor) => (
            <div key={anchor.value} className="flex flex-col items-center">
              <span className="mb-1 text-xs font-semibold text-slate-700">{anchor.value}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-rose-600 shadow-sm">
                {anchor.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
