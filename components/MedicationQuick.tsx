"use client";

import { useMemo, useState } from "react";

import type { MedicationEntry } from "@/lib/types";

interface MedicationQuickProps {
  value: MedicationEntry[];
  onChange: (medication: MedicationEntry[]) => void;
  suggestions?: string[];
}

export function MedicationQuick({ value, onChange, suggestions }: MedicationQuickProps) {
  const [customName, setCustomName] = useState("");
  const [wantsMedication, setWantsMedication] = useState(value.length > 0);
  const hasMedication = value.length > 0;

  const allSuggestions = useMemo(() => {
    const fromHistory = value.map((item) => item.name);
    return Array.from(new Set([...(suggestions ?? []), ...fromHistory]));
  }, [suggestions, value]);

  const toggleYesNo = (choice: boolean) => {
    setWantsMedication(choice);
    if (!choice) {
      onChange([]);
    }
  };

  const addMedication = (name: string) => {
    if (!name.trim()) return;
    if (value.some((item) => item.name.toLowerCase() === name.trim().toLowerCase())) {
      setCustomName("");
      return;
    }
    const entry: MedicationEntry = {
      id: `${name}-${Date.now()}`,
      name: name.trim(),
      ts: Date.now(),
    };
    onChange([...value, entry]);
    setCustomName("");
  };

  const updateDose = (id: string, dose?: string) => {
    onChange(value.map((item) => (item.id === id ? { ...item, dose } : item)));
  };

  const removeMedication = (id: string) => {
    onChange(value.filter((item) => item.id !== id));
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Hast du etwas genommen?</h2>
        <p className="text-sm text-slate-600">Falls ja: Tippe ein Präparat oder wähle eines aus der Liste.</p>
      </header>
      <div className="flex gap-2" role="group" aria-label="Medikamente genommen?">
        <button
          type="button"
          onClick={() => toggleYesNo(false)}
          className={`flex-1 rounded-full border px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
            !hasMedication ? "border-rose-500 bg-rose-100 text-rose-700" : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          Nein
        </button>
        <button
          type="button"
          onClick={() => toggleYesNo(true)}
          className={`flex-1 rounded-full border px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
            hasMedication ? "border-rose-500 bg-rose-100 text-rose-700" : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          Ja
        </button>
      </div>
      {wantsMedication ? (
        <>
          <div className="flex flex-wrap gap-2">
            {allSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => addMedication(suggestion)}
                className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-slate-600">Neues Präparat</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                className="flex-1 rounded-lg border border-slate-200 p-2"
                placeholder="Name"
              />
              <button
                type="button"
                onClick={() => addMedication(customName)}
                className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Hinzufügen
              </button>
            </div>
          </label>
          {value.length > 0 ? (
            <ul className="space-y-3">
              {value.map((med) => (
                <li key={med.id} className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">{med.name}</span>
                    <button
                      type="button"
                      onClick={() => removeMedication(med.id)}
                      className="text-sm text-rose-600 underline"
                    >
                      Entfernen
                    </button>
                  </div>
                  <label className="mt-2 block text-sm text-slate-600">
                    Dosis (optional)
                    <input
                      type="text"
                      value={med.dose ?? ""}
                      onChange={(event) => updateDose(med.id, event.target.value || undefined)}
                      className="mt-1 w-full rounded-lg border border-slate-200 p-2"
                      placeholder="z. B. 400 mg"
                    />
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Noch nichts ausgewählt.</p>
          )}
        </>
      ) : null}
    </section>
  );
}
