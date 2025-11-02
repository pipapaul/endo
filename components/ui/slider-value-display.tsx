import { cn } from "@/lib/utils";

export type SliderValueDisplayProps = {
  value: number;
  label?: string;
  unit?: string;
  className?: string;
  valueClassName?: string;
};

export function SliderValueDisplay({
  value,
  label,
  unit,
  className,
  valueClassName,
}: SliderValueDisplayProps) {
  return (
    <div
      className={cn(
        "flex min-w-[6rem] flex-col items-center justify-center rounded-xl border border-rose-100 bg-white px-4 py-4 text-rose-700 shadow-sm",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {label ? (
        <span className="text-xs font-semibold uppercase tracking-wide text-rose-500">{label}</span>
      ) : null}
      <span className={cn("flex items-baseline gap-1 text-4xl font-semibold", valueClassName)}>
        {value}
        {unit ? <span className="text-base font-medium text-rose-600">{unit}</span> : null}
      </span>
    </div>
  );
}
