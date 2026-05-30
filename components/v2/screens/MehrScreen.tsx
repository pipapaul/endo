"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardList, Download, Palette, Trash2, Upload } from "lucide-react";
import { useData } from "@/lib/data/DataProvider";
import { buildBackup, parseBackup } from "@/lib/data/importExport";
import { getColorSchemeName, type ColorScheme } from "@/lib/theme";
import { Card, Sheet } from "../ui";
import { Button } from "@/components/ui/button";

const THEME_KEY = "endo-color-scheme";

function applyTheme(scheme: ColorScheme) {
  if (scheme === "neutral") document.documentElement.setAttribute("data-theme", "neutral");
  else document.documentElement.removeAttribute("data-theme");
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify(scheme));
  } catch {
    /* ignore */
  }
}

export function MehrScreen() {
  const { exportSnapshot, importSnapshot, clearAll, productSettings, daily } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scheme, setScheme] = useState<ColorScheme>("neutral");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      setScheme(stored === '"rose"' ? "rose" : "neutral");
    } catch {
      /* ignore */
    }
  }, []);

  const handleExport = () => {
    const blob = new Blob([buildBackup(exportSnapshot())], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cycle-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    setMessage(null);
    setError(null);
    try {
      const raw = JSON.parse(await file.text());
      const { snapshot, counts } = parseBackup(raw, productSettings);
      await importSnapshot(snapshot);
      setMessage(
        `Import erfolgreich: ${counts.daily} Tage, ${counts.weekly} Wochen, ${counts.monthly} Monate.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import fehlgeschlagen.");
    }
  };

  return (
    <div className="space-y-5">
      <header className="px-1 pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-rose-900">Mehr</h1>
        <p className="text-sm text-rose-500">Darstellung, Daten & Einstellungen</p>
      </header>

      <Card className="space-y-3">
        <div className="flex items-center gap-2 text-rose-900">
          <Palette className="h-5 w-5 text-rose-500" />
          <span className="font-semibold">Darstellung</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["neutral", "rose"] as ColorScheme[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setScheme(s);
                applyTheme(s);
              }}
              className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                scheme === s
                  ? "border-rose-500 bg-rose-50 text-rose-900"
                  : "border-rose-200 bg-white text-rose-600 hover:border-rose-300"
              }`}
            >
              {getColorSchemeName(s)}
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <span className="font-semibold text-rose-900">Daten</span>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" onClick={handleExport} className="justify-start rounded-2xl">
            <Download className="mr-2 h-4 w-4" /> Daten exportieren
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            className="justify-start rounded-2xl"
          >
            <Upload className="mr-2 h-4 w-4" /> Daten importieren
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
              e.target.value = "";
            }}
          />
        </div>
        {message ? <p className="text-xs font-medium text-emerald-600">{message}</p> : null}
        {error ? <p className="text-xs font-medium text-red-500">{error}</p> : null}
        <p className="text-[11px] text-rose-400">
          Funktioniert mit Exporten aus der alten App (v1) und aus v2.
        </p>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2 text-rose-900">
          <ClipboardList className="h-5 w-5 text-rose-500" />
          <span className="font-semibold">Check-ins</span>
        </div>
        <p className="text-sm text-rose-500">
          Ausführlichere Fragebögen als Datenerfassung – ergänzend zum täglichen Journal.
        </p>
        <Link
          href="/weekly/"
          className="flex items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-white px-4 py-3 text-rose-800 transition hover:border-rose-200 hover:bg-rose-50"
        >
          <span>
            <span className="block text-sm font-semibold">Wöchentlicher Check-in</span>
            <span className="block text-xs text-rose-400">Funktion & Belastung (WPAI)</span>
          </span>
          <ChevronRight className="h-5 w-5 text-rose-300" />
        </Link>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50/40 px-4 py-3 text-rose-400">
          <span>
            <span className="block text-sm font-semibold">Monatlicher Check-in</span>
            <span className="block text-xs">Lebensqualität & Stimmung (EHP-5, PHQ-9, GAD-7)</span>
          </span>
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-500">
            bald
          </span>
        </div>
      </Card>

      <Card className="space-y-3 border-red-100">
        <span className="font-semibold text-rose-900">Daten löschen</span>
        <p className="text-sm text-rose-500">
          Entfernt alle Einträge unwiderruflich von diesem Gerät. Exportiere vorher zur Sicherheit.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirmDelete(true)}
          className="justify-start rounded-2xl border-red-200 text-red-600 hover:bg-red-50"
        >
          <Trash2 className="mr-2 h-4 w-4" /> Alle Daten löschen
        </Button>
      </Card>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Wirklich alle Daten löschen?"
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              className="flex-1 rounded-2xl"
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={async () => {
                await clearAll();
                setConfirmDelete(false);
                setMessage("Alle Daten wurden gelöscht.");
                setError(null);
              }}
              className="flex-1 rounded-2xl bg-red-600 text-white hover:bg-red-700"
            >
              Endgültig löschen
            </Button>
          </div>
        }
      >
        <p className="text-sm text-rose-600">
          Dies entfernt {daily.length} Tageseinträge sowie alle Wochen- und Monatsdaten von diesem
          Gerät. Dieser Schritt kann nicht rückgängig gemacht werden.
        </p>
      </Sheet>
    </div>
  );
}
