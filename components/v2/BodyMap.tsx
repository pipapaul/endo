"use client";

import { getRegionLabel } from "@/lib/painRegions";
import { cn } from "@/lib/utils";

type Zone = { id: string; x: number; y: number; w: number; h: number; rx?: number; label: string };

/** Front-torso zones laid out to read as a body (head → pelvis). */
const FRONT_ZONES: Zone[] = [
  { id: "head", x: 86, y: 4, w: 48, h: 44, rx: 22, label: "Kopf" },
  { id: "neck", x: 98, y: 50, w: 24, h: 12, rx: 6, label: "Nacken" },
  { id: "chest_left", x: 56, y: 66, w: 52, h: 34, rx: 10, label: "Brust li." },
  { id: "chest_right", x: 112, y: 66, w: 52, h: 34, rx: 10, label: "Brust re." },
  { id: "upper_abdomen_left", x: 62, y: 104, w: 30, h: 26, label: "Oberb. li." },
  { id: "upper_abdomen", x: 95, y: 104, w: 30, h: 26, label: "Oberb." },
  { id: "upper_abdomen_right", x: 128, y: 104, w: 30, h: 26, label: "Oberb. re." },
  { id: "lower_abdomen_left", x: 62, y: 133, w: 30, h: 26, label: "Unterb. li." },
  { id: "lower_abdomen", x: 95, y: 133, w: 30, h: 26, label: "Unterb." },
  { id: "lower_abdomen_right", x: 128, y: 133, w: 30, h: 26, label: "Unterb. re." },
  { id: "pelvis_left", x: 62, y: 162, w: 30, h: 28, label: "Becken li." },
  { id: "uterus", x: 95, y: 162, w: 30, h: 28, label: "Uterus" },
  { id: "pelvis_right", x: 128, y: 162, w: 30, h: 28, label: "Becken re." },
];

export const FRONT_ZONE_IDS = new Set(FRONT_ZONES.map((z) => z.id));

/** Internal/other regions offered as chips next to the map. */
const EXTRA_REGIONS = ["vaginal", "rectal", "lower_back", "mid_back_left", "mid_back_right"];

/**
 * Visual pain localization. A schematic front-body map where the user taps the
 * aching areas (endo-relevant torso & pelvis in detail), plus chips for
 * internal/back regions and a removable summary of everything selected.
 */
export function BodyMap({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const selectedSet = new Set(selected);

  return (
    <div className="space-y-3">
      <div className="rounded-3xl border border-rose-100 bg-white/70 p-3">
        <svg viewBox="0 0 220 200" className="mx-auto h-56 w-full max-w-[260px]" role="group" aria-label="Körperkarte">
          {/* decorative arms */}
          <rect x={34} y={70} width={16} height={70} rx={8} fill="#fee2e6" />
          <rect x={170} y={70} width={16} height={70} rx={8} fill="#fee2e6" />
          {FRONT_ZONES.map((z) => {
            const active = selectedSet.has(z.id);
            return (
              <g key={z.id} onClick={() => onToggle(z.id)} className="cursor-pointer">
                <title>{z.label}</title>
                <rect
                  x={z.x}
                  y={z.y}
                  width={z.w}
                  height={z.h}
                  rx={z.rx ?? 5}
                  fill={active ? "#f43f5e" : "#ffffff"}
                  stroke={active ? "#e11d48" : "#fbcfe8"}
                  strokeWidth={active ? 2 : 1.2}
                />
                {z.id === "uterus" || z.w >= 50 ? (
                  <text
                    x={z.x + z.w / 2}
                    y={z.y + z.h / 2 + 3}
                    textAnchor="middle"
                    fontSize={7}
                    fill={active ? "#ffffff" : "#9f1239"}
                    style={{ pointerEvents: "none" }}
                  >
                    {z.id === "uterus" ? "Uterus" : ""}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        <p className="text-center text-[11px] text-rose-400">Tippe die schmerzenden Stellen an</p>
      </div>

      {/* internal / back chips */}
      <div className="flex flex-wrap gap-2">
        {EXTRA_REGIONS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onToggle(id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95",
              selectedSet.has(id)
                ? "border-rose-500 bg-rose-500 text-white"
                : "border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
            )}
          >
            {getRegionLabel(id)}
          </button>
        ))}
      </div>

      {/* selected summary */}
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onToggle(id)}
              className="flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs text-rose-700"
            >
              {getRegionLabel(id)} ✕
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
