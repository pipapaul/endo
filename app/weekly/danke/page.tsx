"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatIsoWeek } from "@/lib/isoWeek";
import { exportWeeklyReportPDF } from "@/lib/export/pdfWeekly";
import { listWeeklyReports, type WeeklyReport } from "@/lib/weekly/reports";

function formatWeekLabel(yearParam: string | null, weekParam: string | null): string {
  if (!yearParam || !weekParam) {
    return "diese Woche";
  }
  const year = Number(yearParam);
  const week = Number(weekParam);
  if (!Number.isFinite(year) || !Number.isFinite(week)) {
    return "diese Woche";
  }
  const normalizedWeek = Math.max(1, Math.min(53, Math.trunc(week)));
  return `Kalenderwoche ${String(normalizedWeek).padStart(2, "0")} / ${year}`;
}

function formatGoogleDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function nextSunday(): Date {
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? 7 : 7 - day;
  const target = new Date(now);
  target.setDate(now.getDate() + offset);
  target.setHours(0, 0, 0, 0);
  return target;
}

function WeeklyThankYouContent(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const yearParam = searchParams?.get("year") ?? null;
  const weekParam = searchParams?.get("week") ?? null;

  const weekLabel = useMemo(() => formatWeekLabel(yearParam, weekParam), [weekParam, yearParam]);

  const isoWeekKey = useMemo(() => {
    const year = Number(yearParam);
    const week = Number(weekParam);
    if (!Number.isFinite(year) || !Number.isFinite(week)) {
      return null;
    }
    return formatIsoWeek(year, week);
  }, [weekParam, yearParam]);

  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(true);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingReport(true);
    setExportError(null);
    (async () => {
      try {
        const reports = await listWeeklyReports();
        if (cancelled) return;
        if (!reports.length) {
          setReport(null);
          return;
        }
        if (isoWeekKey) {
          const match = reports.find((entry) => entry.isoWeekKey === isoWeekKey);
          setReport(match ?? reports[0]);
          return;
        }
        setReport(reports[0]);
      } catch (error) {
        console.error("Wochenbericht konnte nicht geladen werden", error);
        if (!cancelled) {
          setReport(null);
          setExportError("Der gespeicherte Bericht konnte nicht geladen werden.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingReport(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isoWeekKey]);

  const handleExport = useCallback(() => {
    if (!report) return;
    setIsExporting(true);
    setExportError(null);
    exportWeeklyReportPDF(report)
      .catch((error) => {
        console.error("PDF-Export fehlgeschlagen", error);
        setExportError("Der PDF-Export ist fehlgeschlagen. Bitte versuche es erneut.");
      })
      .finally(() => {
        setIsExporting(false);
      });
  }, [report]);

  const handleReminder = useCallback(() => {
    if (typeof window === "undefined") return;
    const sunday = nextSunday();
    const end = new Date(sunday);
    end.setDate(sunday.getDate() + 1);
    const startString = formatGoogleDate(sunday);
    const endString = formatGoogleDate(end);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=EndoTrack%20Check-in&dates=${startString}/${endString}&details=W%C3%B6chentlicher%20Check-in%20mit%20EndoTrack`;
    window.open(url, "_blank");
  }, []);

  const handleBack = useCallback(() => {
    router.push("/weekly");
  }, [router]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
      <section className="space-y-8 rounded-2xl border border-rose-100 bg-white/80 p-8 shadow-sm">
        <header className="space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-rose-500">Danke</p>
          <h1 className="text-3xl font-semibold text-rose-900">Wochenbericht gespeichert</h1>
          <p className="text-sm text-rose-900/70">
            Dein Bericht für {weekLabel} wurde gesichert. Wähle eine der folgenden Aktionen, um nahtlos weiterzumachen.
          </p>
        </header>

        <div className="space-y-4">
          <p className="text-sm font-medium text-rose-900">Nächste Schritte</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              onClick={handleExport}
              className="flex-1"
              disabled={!report || isExporting || isLoadingReport}
            >
              {isExporting ? "PDF wird erstellt…" : "Als PDF speichern"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleReminder} className="flex-1">
              Erinnerung für nächsten Sonntag einrichten
            </Button>
          </div>
          <p className="text-xs text-rose-900/60">
            Der PDF-Export speichert deinen Wochenbericht als kompaktes A4-Dokument. Die Erinnerung verlinkt zur
            Kalendereinrichtung in Google Calendar.
          </p>
          {exportError ? <p className="text-xs text-rose-500">{exportError}</p> : null}
          {!isLoadingReport && !report ? (
            <p className="text-xs text-rose-500">Es wurde kein Wochenbericht gefunden.</p>
          ) : null}
        </div>

        <div className="flex justify-center">
          <Button type="button" variant="ghost" onClick={handleBack}>
            Zurück zur Wochenübersicht
          </Button>
        </div>
      </section>
    </main>
  );
}

function LoadingFallback(): JSX.Element {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
      <section className="space-y-4 rounded-2xl border border-rose-100 bg-white/80 p-8 shadow-sm">
        <div className="h-6 w-1/3 animate-pulse rounded bg-rose-100" />
        <div className="space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-rose-100" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-rose-100" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 flex-1 animate-pulse rounded bg-rose-100" />
          <div className="h-10 flex-1 animate-pulse rounded bg-rose-100" />
        </div>
      </section>
    </main>
  );
}

export default function WeeklyThankYouPage(): JSX.Element {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <WeeklyThankYouContent />
    </Suspense>
  );
}
