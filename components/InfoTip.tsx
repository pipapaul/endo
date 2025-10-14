"use client";

import { useId, useState } from "react";

type Props = {
  tech: string;
  help: string;
  id?: string;
};

export default function InfoTip({ tech, help, id }: Props) {
  const generatedId = useId();
  const tooltipId = id ?? generatedId;
  const [open, setOpen] = useState(false);

  const show = () => setOpen(true);
  const hide = () => setOpen(false);
  const toggle = () => setOpen((value) => !value);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-describedby={tooltipId}
        aria-expanded={open}
        aria-label={`Info zu ${tech}`}
        className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-[10px] font-semibold text-rose-600 outline-none transition hover:bg-rose-100 focus-visible:ring-2 focus-visible:ring-rose-300"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={toggle}
      >
        i
      </button>
      <div
        id={tooltipId}
        role="tooltip"
        className={`absolute z-50 mt-2 w-64 rounded-md border border-rose-200 bg-white p-3 text-xs text-rose-700 shadow-lg transition focus-within:opacity-100 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        <p className="font-semibold text-rose-900">{tech}</p>
        <p className="mt-1 leading-snug">{help}</p>
      </div>
    </span>
  );
}
