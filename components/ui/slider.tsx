import * as React from "react";

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange"> {
  value: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
}

export function Slider({ value, min = 0, max = 100, step = 1, onValueChange, className, style, ...props }: SliderProps) {
  const current = value[0] ?? 0;
  const clamped = Math.min(Math.max(current, min), max);
  const range = max - min;
  const percentage = range === 0 ? 0 : ((clamped - min) / range) * 100;

  return (
    <input
      type="range"
      value={current}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onValueChange?.([Number(event.target.value)])}
      className={
        "endo-slider h-3 w-full cursor-pointer appearance-none rounded-full bg-rose-100 accent-rose-500" +
        (className ? ` ${className}` : "")
      }
      style={{
        background: `linear-gradient(to right, var(--endo-accent) 0%, var(--endo-accent) ${percentage}%, #ffe4e6 ${percentage}%, #ffe4e6 100%)`,
        ...style,
      }}
      {...props}
    />
  );
}
