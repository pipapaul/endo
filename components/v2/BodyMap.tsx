"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { getRegionLabel } from "@/lib/painRegions";
import { cn } from "@/lib/utils";

/**
 * Illustrated body map. A full-body watercolour silhouette (colourful, with a
 * transparent background) shown small enough to fit the viewport without
 * scrolling. Clickable regions are purple dots; tapping a dot reveals the exact
 * spot(s) at that location as buttons in the picker below the figure (so the
 * buttons never overlap the dots).
 *
 * Artwork: `public/bodymap.png` (full body, head→feet, transparent background).
 */

type Dot = { id: string; x: number; y: number; regions: string[] };

// x/y are percentages of the figure box (subject's left = image right).
const DOTS: Dot[] = [
  { id: "head", x: 50, y: 8, regions: ["head"] },
  { id: "neck", x: 50, y: 15.5, regions: ["neck"] },
  { id: "shoulder_r", x: 39, y: 20, regions: ["shoulder_right"] },
  { id: "shoulder_l", x: 61, y: 20, regions: ["shoulder_left"] },
  { id: "chest_r", x: 44, y: 25, regions: ["chest_right"] },
  { id: "chest_l", x: 56, y: 25, regions: ["chest_left"] },
  { id: "upper_abdomen", x: 50, y: 31, regions: ["upper_abdomen_left", "upper_abdomen", "upper_abdomen_right"] },
  { id: "lower_abdomen", x: 50, y: 37, regions: ["lower_abdomen_left", "lower_abdomen", "lower_abdomen_right"] },
  { id: "pelvis", x: 50, y: 43, regions: ["pelvis_right", "uterus", "pelvis_left"] },
  { id: "groin", x: 50, y: 47, regions: ["vaginal", "rectal"] },
  { id: "hip_r", x: 41, y: 45, regions: ["hip_right"] },
  { id: "hip_l", x: 59, y: 45, regions: ["hip_left"] },
  { id: "upper_arm_r", x: 33, y: 28, regions: ["upper_arm_right"] },
  { id: "upper_arm_l", x: 67, y: 28, regions: ["upper_arm_left"] },
  { id: "forearm_r", x: 30, y: 37, regions: ["forearm_right"] },
  { id: "forearm_l", x: 70, y: 37, regions: ["forearm_left"] },
  { id: "hand_r", x: 28, y: 49, regions: ["hand_right"] },
  { id: "hand_l", x: 72, y: 49, regions: ["hand_left"] },
  { id: "thigh_r", x: 44, y: 57, regions: ["thigh_right"] },
  { id: "thigh_l", x: 56, y: 57, regions: ["thigh_left"] },
  { id: "knee_r", x: 45, y: 68, regions: ["knee_right"] },
  { id: "knee_l", x: 55, y: 68, regions: ["knee_left"] },
  { id: "calf_r", x: 45, y: 78, regions: ["calf_right"] },
  { id: "calf_l", x: 55, y: 78, regions: ["calf_left"] },
  { id: "foot_r", x: 47, y: 95, regions: ["foot_right"] },
  { id: "foot_l", x: 53, y: 95, regions: ["foot_left"] },
];

// Back regions can't sit on a front view — offered as buttons in the picker.
const BACK_REGIONS = [
  "lower_back",
  "mid_back_left",
  "mid_back_right",
  "upper_back_left",
  "upper_back_right",
];

export function BodyMap({
  onPick,
  onCancel,
}: {
  onPick: (regionId: string) => void;
  onCancel?: () => void;
}) {
  const [activeDot, setActiveDot] = useState<string | null>(null);
  const [showBack, setShowBack] = useState(false);
  const dot = DOTS.find((d) => d.id === activeDot) ?? null;

  return (
    <div className="space-y-3">
      {/* Whole figure fits the viewport (no scroll); colourful as-is. */}
      <div className="flex justify-center">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bodymap.png" alt="Körperkarte" className="block max-h-[60vh] w-auto select-none" draggable={false} />
          {DOTS.map((d) => {
            const active = d.id === activeDot;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setActiveDot(active ? null : d.id)}
                aria-label="Schmerzstelle wählen"
                style={{ left: `${d.x}%`, top: `${d.y}%` }}
                className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition active:scale-90"
              >
                <span
                  className={cn(
                    "rounded-full border-2 border-white shadow transition",
                    active ? "h-5 w-5 bg-violet-600 ring-2 ring-violet-300" : "h-3.5 w-3.5 bg-violet-500"
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Spot picker — below the figure, never overlapping the dots. */}
      <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-3">
        {dot ? (
          <>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-500">
              Welche Stelle genau?
            </p>
            <div className="flex flex-wrap gap-2">
              {dot.regions.map((rid) => (
                <button
                  key={rid}
                  type="button"
                  onClick={() => onPick(rid)}
                  className="rounded-full border border-violet-300 bg-white px-3 py-1.5 text-sm font-medium text-violet-700 transition hover:bg-violet-100 active:scale-95"
                >
                  {getRegionLabel(rid)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-center text-sm text-violet-500">Tippe einen lila Punkt an, um die Stelle zu wählen.</p>
        )}

        <button
          type="button"
          onClick={() => setShowBack((s) => !s)}
          className="mt-3 text-xs font-medium text-rose-500 hover:text-rose-700"
        >
          {showBack ? "− " : "+ "}Rücken &amp; weitere
        </button>
        {showBack ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {BACK_REGIONS.map((rid) => (
              <button
                key={rid}
                type="button"
                onClick={() => onPick(rid)}
                className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 active:scale-95"
              >
                {getRegionLabel(rid)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 text-sm font-medium text-rose-500 hover:text-rose-700"
        >
          <ChevronLeft className="h-4 w-4" /> Abbrechen
        </button>
      ) : null}
    </div>
  );
}
