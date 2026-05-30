"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * v2 design system — a small, consistent set of primitives so every screen
 * looks and feels the same. Modern, soft, friendly: rounded-3xl cards, gentle
 * shadows, warm themed colours (rose-* maps to the active theme).
 */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-rose-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}

export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("text-[15px] font-semibold text-rose-900", className)}>{children}</h2>
  );
}

export function Chip({
  selected,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition active:scale-95",
        selected
          ? "border-rose-500 bg-rose-500 text-white shadow-sm"
          : "border-rose-200 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-50",
        className
      )}
      {...props}
    />
  );
}

/**
 * Bottom sheet modal. Slides up from the bottom, scrolls internally, closes on
 * backdrop tap or the X. Used for the quick check-in and quick-add flows.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-rose-50 shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-rose-100 bg-white/80 px-5 py-4">
          <div className="text-base font-semibold text-rose-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-full p-1.5 text-rose-500 transition hover:bg-rose-100 hover:text-rose-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="border-t border-rose-100 bg-white/80 px-5 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/** Tappable 0–10 scale. Fast single-tap input for pain / intensity. */
export function ScalePicker({
  value,
  onChange,
  max = 10,
}: {
  value: number | null;
  onChange: (value: number) => void;
  max?: number;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: max + 1 }, (_, n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "h-9 w-9 rounded-xl text-sm font-semibold transition active:scale-90",
              active
                ? "bg-rose-500 text-white shadow-sm"
                : "bg-white text-rose-600 ring-1 ring-rose-100 hover:ring-rose-300"
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
