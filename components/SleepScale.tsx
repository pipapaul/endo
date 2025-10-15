"use client";

import { useId } from "react";

import type { Nrs } from "@/lib/types";

interface SleepScaleProps {
  value: Nrs;
  onChange: (value: Nrs) => void;
}

const labels: Record<Nrs, string> = {
  0: "katastrophal",
  1: "sehr schlecht",
  2: "schlecht",
  3: "unruhig",
  4: "durchwachsen",
  5: "okay",
  6: "ganz gut",
  7: "erholt",
  8: "ausgeruht",
  9: "top",
  10: "Traumschlaf",
};

export function SleepScale({ value, onChange }: SleepScaleProps) {
  const id = useId();
  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-lg font-semibold">Wie war dein Schlaf?</h2>
        <p className="text-sm text-slate-600">0 = katastrophal, 10 = Traumschlaf.</p>
      </header>
      <div className="flex items-center gap-3">
        <input
          id={`${id}-sleep`}
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value) as Nrs)}
          className="h-10 w-full rounded-full bg-indigo-100 accent-indigo-500"
          aria-valuetext={labels[value]}
        />
        <span className="w-24 text-right text-sm font-semibold text-indigo-600">{labels[value]}</span>
      </div>
    </section>
  );
}
