"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import BackButton from "@/components/ui/back-button";
import { formatIsoWeek } from "@/lib/isoWeek";
import { exportWeeklyReportPDF } from "@/lib/export/pdfWeekly";
import { buildWeeklyReminderICS } from "@/lib/reminders/ics";
import {
  requestWeeklyReminderPermission,
  scheduleLocalWeeklyReminder,
} from "@/lib/reminders/notifications";
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

function nextSunday(): Date {
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? 7 : 7 - day;
  const target = new Date(now);
  target.setDate(now.getDate() + offset);
  target.setHours(0, 0, 0, 0);
  return target;
}

function formatLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [isSettingReminder, setIsSettingReminder] = useState(false);

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
          setReport(match ?? null);
          return;
        }
        // Only fall back to latest report if no specific week was requested
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

  const downloadReminderIcs = useCallback((content: string) => {
    const blob = new Blob([content], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "endo-track-wochen-checkin.ics";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, []);

  const handleReminder = useCallback(async () => {
    if (typeof window === "undefined") return;
    setReminderMessage(null);
    setReminderError(null);
    setIsSettingReminder(true);

    const sunday = nextSunday();
    const nextSundayISO = formatLocalISODate(sunday);

    try {
      const permission = await requestWeeklyReminderPermission();

      if (permission === "granted") {
        try {
          await scheduleLocalWeeklyReminder(nextSundayISO);
          setReminderMessage(
            "Benachrichtigung eingerichtet. Du erhältst am nächsten Sonntag eine Erinnerung in deinem Browser.",
          );
          return;
        } catch (error) {
          console.error("Geplante Benachrichtigung nicht möglich", error);
          const icsContent = buildWeeklyReminderICS(nextSundayISO);
          downloadReminderIcs(icsContent);
          setReminderError(
            "Benachrichtigungen sind erlaubt, konnten aber nicht geplant werden. Stattdessen wurde eine Kalenderdatei heruntergeladen.",
          );
          return;
        }
      }

      const icsContent = buildWeeklyReminderICS(nextSundayISO);
      downloadReminderIcs(icsContent);
      setReminderMessage(
        permission === "denied"
          ? "Browser-Benachrichtigungen sind deaktiviert. Wir haben dir eine Kalenderdatei zur wöchentlichen Erinnerung bereitgestellt."
          : "Benachrichtigungen konnten nicht aktiviert werden. Wir haben dir eine Kalenderdatei zur wöchentlichen Erinnerung bereitgestellt.",
      );
    } catch (error) {
      console.error("Erinnerung konnte nicht eingerichtet werden", error);
      setReminderError("Erinnerung konnte nicht eingerichtet werden. Bitte versuche es erneut.");
    } finally {
      setIsSettingReminder(false);
    }
  }, [downloadReminderIcs]);

  const handleBack = useCallback(() => {
    router.push("/");
  }, [router]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
      <section className="space-y-8 rounded-2xl border border-rose-100 bg-white/80 p-8 shadow-sm">
        <header className="space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-rose-500">Danke</p>
          <h1 className="text-3xl font-semibold text-rose-900">Wochenbericht gespeichert</h1>
          <p className="text-sm text-rose-900/70">
            Danke. Möchtest du die Woche als A4 speichern oder eine Erinnerung für nächsten Sonntag erhalten?
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
            <Button
              type="button"
              variant="secondary"
              onClick={handleReminder}
              className="flex-1"
              disabled={isSettingReminder}
            >
              {isSettingReminder ? "Erinnerung wird eingerichtet…" : "Erinnerung für nächsten Sonntag einrichten"}
            </Button>
          </div>
          <p className="text-xs text-rose-900/60">
            Der PDF-Export speichert deinen Wochenbericht als kompaktes A4-Dokument. Die Erinnerung richtet nach
            Möglichkeit eine Browser-Benachrichtigung ein oder stellt eine Kalenderdatei bereit.
          </p>
          {exportError ? <p className="text-xs text-rose-500">{exportError}</p> : null}
          {reminderMessage ? <p className="text-xs text-rose-700">{reminderMessage}</p> : null}
          {reminderError ? <p className="text-xs text-rose-500">{reminderError}</p> : null}
          {!isLoadingReport && !report ? (
            <p className="text-xs text-rose-500">Es wurde kein Wochenbericht gefunden.</p>
          ) : null}
        </div>

        <div className="flex justify-center">
          <BackButton type="button" onClick={handleBack}>
            Zurück zur Startseite
          </BackButton>
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
