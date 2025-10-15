"use client";

import type { BodyZoneId } from "@/lib/types";

const ZONES: Array<{ id: BodyZoneId; label: string; description: string }> = [
  { id: "uterus", label: "Uterus", description: "Mittig, Unterbauch" },
  { id: "pelvis_left", label: "Becken links", description: "linke Beckenseite" },
  { id: "pelvis_right", label: "Becken rechts", description: "rechte Beckenseite" },
  { id: "sacrum", label: "Kreuzbein", description: "unterer Rücken" },
  { id: "rectal", label: "Rektal", description: "Darm / hintere Mitte" },
  { id: "vaginal", label: "Vaginal", description: "vaginal" },
  { id: "thigh_left", label: "Oberschenkel links", description: "linker Oberschenkel" },
  { id: "thigh_right", label: "Oberschenkel rechts", description: "rechter Oberschenkel" },
];

interface BodyMapSimpleProps {
  selected: BodyZoneId[];
  onChange: (zones: BodyZoneId[]) => void;
}

export function BodyMapSimple({ selected, onChange }: BodyMapSimpleProps) {
  const toggleZone = (zone: BodyZoneId) => {
    if (selected.includes(zone)) {
      onChange(selected.filter((item) => item !== zone));
    } else {
      onChange([...selected, zone]);
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Wo sitzt der Schmerz?</h2>
        <p className="text-sm text-slate-600">Tippe bis zu 3 Zonen. Für Screenreader gibt es unten eine Liste.</p>
      </header>
      <div className="grid grid-cols-2 gap-3" aria-hidden="true">
        {ZONES.map((zone) => (
          <button
            key={zone.id}
            type="button"
            onClick={() => toggleZone(zone.id)}
            aria-pressed={selected.includes(zone.id)}
            className={`flex min-h-[72px] flex-col items-center justify-center rounded-xl border text-center text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
              selected.includes(zone.id)
                ? "border-rose-500 bg-rose-100 text-rose-700"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            <span>{zone.label}</span>
            <span className="text-xs text-slate-500">{zone.description}</span>
          </button>
        ))}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-700">Alternative Auswahl</legend>
        <ul className="space-y-1">
          {ZONES.map((zone) => (
            <li key={`${zone.id}-text`}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-rose-200 text-rose-500 focus:ring-rose-500"
                  checked={selected.includes(zone.id)}
                  onChange={() => toggleZone(zone.id)}
                />
                <span>{zone.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    </section>
  );
}
