import * as React from "react";

import { cn } from "@/lib/utils";

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange"> {
  value: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
}

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  className,
  style,
  disabled,
  ...props
}: SliderProps) {
  const current = value[0] ?? 0;
  const clamped = Math.min(Math.max(current, min), max);
  const range = max - min;
  const percentage = range === 0 ? 0 : ((clamped - min) / range) * 100;
  const accentColor = disabled ? "rgba(148, 163, 184, 0.55)" : "rgba(225, 29, 72, 0.75)";
  const trackColor = disabled ? "rgba(148, 163, 184, 0.2)" : "rgba(225, 29, 72, 0.14)";

  return (
    <input
      type="range"
      value={current}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onValueChange?.([Number(event.target.value)])}
      disabled={disabled}
      className={cn(
        "endo-slider h-2 w-full cursor-pointer appearance-none rounded-full bg-transparent transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200/70 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-80",
        className,
      )}
      style={{
        background: `linear-gradient(90deg, ${accentColor} 0%, ${accentColor} ${percentage}%, ${trackColor} ${percentage}%, ${trackColor} 100%)`,
        ...style,
      }}
      {...props}
    />
  );
}
