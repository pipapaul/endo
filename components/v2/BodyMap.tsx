"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { getRegionLabel } from "@/lib/painRegions";
import { cn } from "@/lib/utils";

/**
 * Illustrated body map. A hand-drawn front silhouette (tinted pale pink via a
 * CSS mask, so it re-colours regardless of the source art) with purple dots on
 * the clickable regions. Tapping a dot reveals the one or more exact spots at
 * that location as buttons; picking one selects that region.
 *
 * Layout: the (large) figure scrolls inside a height-capped box, while the spot
 * picker stays pinned directly below it, so the detail buttons are always in
 * view without scrolling. Lower-leg / foot dots sit in the empty space below
 * the figure, where those body parts would be.
 *
 * NOTE: artwork lives at `public/bodymap.png` (transparent background).
 */

type Dot = { id: string; x: number; y: number; regions: string[] };

// x/y are percentages of the 720×2023 artwork (subject's left = image right).
const DOTS: Dot[] = [
  { id: "head", x: 50, y: 8.5, regions: ["head"] },
  { id: "neck", x: 50, y: 16, regions: ["neck"] },
  { id: "shoulder_r", x: 27, y: 21.5, regions: ["shoulder_right"] },
  { id: "shoulder_l", x: 72, y: 21.5, regions: ["shoulder_left"] },
  { id: "chest_r", x: 37, y: 26, regions: ["chest_right"] },
  { id: "chest_l", x: 60, y: 26, regions: ["chest_left"] },
  { id: "upper_abdomen", x: 50, y: 33.5, regions: ["upper_abdomen_left", "upper_abdomen", "upper_abdomen_right"] },
  { id: "lower_abdomen", x: 49, y: 41, regions: ["lower_abdomen_left", "lower_abdomen", "lower_abdomen_right"] },
  { id: "pelvis", x: 49, y: 46.5, regions: ["pelvis_right", "uterus", "pelvis_left"] },
  { id: "groin", x: 48, y: 51, regions: ["vaginal", "rectal"] },
  { id: "upper_arm_r", x: 20, y: 33, regions: ["upper_arm_right"] },
  { id: "upper_arm_l", x: 80, y: 33, regions: ["upper_arm_left"] },
  { id: "forearm_r", x: 15, y: 43, regions: ["forearm_right"] },
  { id: "forearm_l", x: 85, y: 43, regions: ["forearm_left"] },
  { id: "hand_r", x: 14, y: 51, regions: ["hand_right"] },
  { id: "hand_l", x: 86, y: 51, regions: ["hand_left"] },
  { id: "hip_r", x: 34, y: 48, regions: ["hip_right"] },
  { id: "hip_l", x: 63, y: 48, regions: ["hip_left"] },
  { id: "thigh_r", x: 39, y: 57, regions: ["thigh_right"] },
  { id: "thigh_l", x: 58, y: 57, regions: ["thigh_left"] },
  // Below the drawn figure — placed where these parts would be.
  { id: "knee_r", x: 40, y: 67, regions: ["knee_right"] },
  { id: "knee_l", x: 57, y: 67, regions: ["knee_left"] },
  { id: "calf_r", x: 40, y: 76, regions: ["calf_right"] },
  { id: "calf_l", x: 57, y: 76, regions: ["calf_left"] },
  { id: "foot_r", x: 40, y: 85, regions: ["foot_right"] },
  { id: "foot_l", x: 57, y: 85, regions: ["foot_left"] },
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
    <div className="space-y-2">
      {/* Figure fills the whole area; it scrolls, the picker floats above it. */}
      <div className="relative h-[60vh]">
        <div className="absolute inset-0 overflow-y-auto [scrollbar-width:thin]">
          <div className="relative w-full" style={{ aspectRatio: "720 / 2023" }}>
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundColor: "#f7cdda",
                WebkitMaskImage: "url(/bodymap.png)",
                maskImage: "url(/bodymap.png)",
                WebkitMaskSize: "contain",
                maskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "top center",
                maskPosition: "top center",
              }}
            />
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

        {/* Spot picker — floating layer pinned to the bottom of the figure. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0">
          <div className="pointer-events-auto max-h-[42%] overflow-y-auto rounded-2xl border border-violet-100 bg-white/90 p-3 shadow-lg backdrop-blur">
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
        </div>
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
