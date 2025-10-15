"use client";

import { useState } from "react";

import { generatePdf } from "@/lib/export/pdf";
import type { DayEntry, ExportPdfType, MonthEntry } from "@/lib/types";

interface ExportPdfProps {
  type: ExportPdfType;
  dayEntries: DayEntry[];
  monthEntries: MonthEntry[];
}

export function ExportPdf({ type, dayEntries, monthEntries }: ExportPdfProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleExport = async () => {
    try {
      setStatus("loading");
      const blob = await generatePdf({ type, dayEntries, monthEntries });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `endo-${type}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatus("done");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">{labelForType(type)}</span>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Export läuft…" : "PDF erstellen"}
        </button>
      </div>
      {status === "done" ? <p className="mt-2 text-xs text-emerald-600">Gespeichert ✓</p> : null}
      {status === "error" ? (
        <p className="mt-2 text-xs text-rose-600">Export fehlgeschlagen. Bitte später erneut versuchen.</p>
      ) : null}
    </div>
  );
}

function labelForType(type: ExportPdfType) {
  switch (type) {
    case "arzt-1pager":
      return "Arzt-Kurzbrief (1 Seite)";
    case "pbac":
      return "PBAC Monatsblatt";
    case "timeline6m":
      return "Timeline 6 Monate";
    default:
      return type;
  }
}
