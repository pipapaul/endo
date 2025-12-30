"use client";

import type { ReactNode } from "react";

import InfoTip from "@/components/InfoTip";
import { Labeled } from "@/components/Labeled";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { SliderValueDisplay } from "@/components/ui/slider-value-display";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { TERMS, type ModuleTerms, type TermKey } from "@/lib/terms";

import { TermField } from "./terms";

export function ScoreInput({
  id,
  label,
  termKey,
  tech,
  help,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  disabled = false,
}: {
  id: string;
  label: string;
  termKey?: TermKey;
  tech?: string;
  help?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  const rangeDescriptionId = `${id}-range-hint`;
  const content = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
      <div className="flex flex-1 flex-col gap-1">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={([v]) => {
            if (!disabled) {
              onChange(v);
            }
          }}
          id={id}
          aria-describedby={rangeDescriptionId}
          disabled={disabled}
        />
        <div
          id={rangeDescriptionId}
          className="flex justify-between text-xs font-medium text-rose-700"
        >
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
      <SliderValueDisplay value={value} className="sm:self-stretch" />
    </div>
  );
  if (termKey) {
    return (
      <TermField termKey={termKey} htmlFor={id}>
        {content}
      </TermField>
    );
  }
  return (
    <Labeled label={label} tech={tech} help={help} htmlFor={id}>
      {content}
    </Labeled>
  );
}

export function MultiSelectChips({
  options,
  value,
  onToggle,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onToggle: (next: string[]) => void;
}) {
  const toggle = (option: string) => {
    const set = new Set(value);
    if (set.has(option)) {
      set.delete(option);
    } else {
      set.add(option);
    }
    onToggle(Array.from(set));
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => toggle(option.value)}
          aria-pressed={value.includes(option.value)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2",
            value.includes(option.value)
              ? "border-rose-500 bg-rose-500 text-white shadow-sm"
              : "border-rose-200 bg-white text-rose-700 hover:border-rose-400 hover:bg-rose-50"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ModuleToggleRow({
  label,
  tech,
  help,
  checked,
  onCheckedChange,
  className,
}: {
  label: string;
  tech?: string;
  help: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50/80 p-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-rose-900">
        <span>{label}</span>
        <InfoTip tech={tech ?? label} help={help} />
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function NrsInput({
  id,
  value,
  onChange,
  minLabel = "0 Kein Schmerz",
  maxLabel = "10 Stärkster Schmerz",
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  minLabel?: string;
  maxLabel?: string;
}) {
  const rangeDescriptionId = `${id}-nrs-range`;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
      <div className="flex flex-1 flex-col gap-1">
        <Slider
          id={id}
          value={[value]}
          min={0}
          max={10}
          step={1}
          aria-describedby={rangeDescriptionId}
          onValueChange={([next]) => onChange(Math.max(0, Math.min(10, Math.round(next))))}
        />
        <div id={rangeDescriptionId} className="flex justify-between text-xs font-medium text-rose-700">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      </div>
      <SliderValueDisplay value={value} className="sm:self-stretch" />
    </div>
  );
}

export function NumberField({
  id,
  value,
  min = 0,
  onChange,
}: {
  id: string;
  value: number | undefined;
  min?: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <Input
      id={id}
      type="number"
      min={min}
      value={value ?? ""}
      onChange={(event) => {
        if (event.target.value === "") {
          onChange(undefined);
          return;
        }
        const parsed = Number(event.target.value);
        if (Number.isNaN(parsed)) {
          onChange(undefined);
          return;
        }
        onChange(Math.max(min, Math.round(parsed)));
      }}
    />
  );
}

export function InlineNotice({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
      <p className="font-semibold text-amber-900">{title}</p>
      <p className="mt-1 text-amber-700">{text}</p>
    </div>
  );
}

export const MODULE_TERMS: ModuleTerms = {
  urinaryOpt: TERMS.urinaryOpt,
  headacheOpt: TERMS.headacheOpt,
  dizzinessOpt: TERMS.dizzinessOpt,
};
