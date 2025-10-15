"use client";

import { useId, useState } from "react";

import microcopy from "@/lib/i18n/de.json";

interface TooltipProps {
  term: keyof typeof microcopy;
  children?: React.ReactNode;
}

export function Tooltip({ term, children }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const text = microcopy[term] ?? "";

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onTouchStart={() => setOpen((prev) => !prev)}
        className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
      >
        {children ?? "i"}
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-2 w-44 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
