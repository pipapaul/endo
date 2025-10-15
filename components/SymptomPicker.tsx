"use client";

import { useMemo } from "react";

import type { Nrs, SymptomDefinition, SymptomEntry } from "@/lib/types";

interface SymptomPickerProps {
  value: SymptomEntry[];
  onChange: (symptoms: SymptomEntry[]) => void;
  max?: number;
  options?: SymptomDefinition[];
}

const defaultOptions: SymptomDefinition[] = [
  { id: "fatigue", label: "Erschöpfung" },
  { id: "nausea", label: "Übelkeit" },
  { id: "bloating", label: "Blähbauch" },
  { id: "gi", label: "Darmkrämpfe" },
  { id: "urinary", label: "Blasenschmerz" },
  { id: "dyspareunia", label: "Schmerzen beim Sex" },
  { id: "headache", label: "Kopfschmerz" },
];

export function SymptomPicker({ value, onChange, max = 2, options }: SymptomPickerProps) {
  const pool = useMemo(() => options ?? defaultOptions, [options]);
  const selectedIds = value.map((symptom) => symptom.id);

  const toggleSymptom = (definition: SymptomDefinition) => {
    if (selectedIds.includes(definition.id)) {
      onChange(value.filter((item) => item.id !== definition.id));
    } else if (value.length < max) {
      onChange([...value, { id: definition.id, label: definition.label, intensity: 5 }]);
    }
  };

  const updateIntensity = (id: string, intensity: Nrs) => {
    onChange(value.map((item) => (item.id === id ? { ...item, intensity } : item)));
  };

  const sortedOptions = useMemo(() => {
    const selected = pool.filter((item) => selectedIds.includes(item.id));
    const unselected = pool.filter((item) => !selectedIds.includes(item.id));
    return [...selected, ...unselected];
  }, [pool, selectedIds]);

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Welche 1–2 Symptome spürst du heute?</h2>
        <p className="text-sm text-slate-600">Tippe ein Symptom. Danach kannst du die Stärke einstellen.</p>
      </header>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Symptome">
        {sortedOptions.map((option) => {
          const isActive = selectedIds.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggleSymptom(option)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                isActive
                  ? "border-rose-500 bg-rose-100 text-rose-700"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {value.length >= max ? (
        <p className="text-xs text-slate-500">Maximal {max} Symptome im Schnellmodus.</p>
      ) : null}
      <div className="space-y-3">
        {value.map((symptom) => (
          <div key={symptom.id} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">{symptom.label}</h3>
              <button
                type="button"
                onClick={() => onChange(value.filter((item) => item.id !== symptom.id))}
                className="text-sm text-rose-600 underline"
              >
                Entfernen
              </button>
            </div>
            <label className="mt-3 flex items-center gap-3">
              <span className="text-sm text-slate-600">Intensität</span>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={symptom.intensity}
                onChange={(event) => updateIntensity(symptom.id, Number(event.target.value) as Nrs)}
                className="h-10 flex-1 rounded-full bg-rose-100 accent-rose-500"
                aria-valuenow={symptom.intensity}
                aria-valuetext={`${symptom.intensity} von 10`}
              />
              <span className="w-8 text-right text-sm font-semibold">{symptom.intensity}</span>
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
