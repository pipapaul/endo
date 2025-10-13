import * as React from "react";

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange"> {
  value: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
}

export function Slider({ value, min = 0, max = 100, step = 1, onValueChange, className, ...props }: SliderProps) {
  const current = value[0] ?? 0;
  return (
    <input
      type="range"
      value={current}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onValueChange?.([Number(event.target.value)])}
      className={
        "h-2 w-full cursor-pointer appearance-none rounded-full bg-rose-100 accent-rose-500" +
        (className ? ` ${className}` : "")
      }
      {...props}
    />
  );
}
