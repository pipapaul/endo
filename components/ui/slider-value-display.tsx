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
        "flex min-w-[5rem] flex-col items-center justify-center gap-1 rounded-2xl bg-white/90 px-4 py-3 text-rose-800 shadow-[0_12px_30px_rgba(225,29,72,0.12)] backdrop-blur-sm",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {label ? <span className="text-xs font-medium text-rose-500/80">{label}</span> : null}
      <span
        className={cn(
          "flex items-baseline gap-1 text-3xl font-semibold leading-none tracking-tight",
          valueClassName,
        )}
      >
        {value}
        {unit ? <span className="text-sm font-medium text-rose-500">{unit}</span> : null}
      </span>
    </div>
  );
}
