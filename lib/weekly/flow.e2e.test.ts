import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearAll } from "@/lib/persistence";
import { exportWeeklyReportPDF } from "@/lib/export/pdfWeekly";
import { computeWeeklyStats } from "@/lib/weekly/aggregate";
import { saveWeeklyDraft, loadWeeklyDraft } from "@/lib/weekly/drafts";
import { listWeeklyReports, storeWeeklyReport } from "@/lib/weekly/reports";

const isoWeekKey = "2024-W20";
const weekStartISO = "2024-05-13";
const weekEndISO = "2024-05-19";

describe("weekly reporting flow", () => {
  beforeEach(async () => {
    await clearAll();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a draft, resumes it, submits a report and exports a PDF", async () => {
    vi.useFakeTimers();

    const answers = {
      helped: ["Wärmeflasche"],
      worsened: ["Stress"],
      nextWeekTry: ["Yoga"],
      freeText: "Ruhige Woche",
    };

    const draft = {
      isoWeekKey,
      confirmedSummary: false,
      answers,
      progress: 2 as const,
      updatedAt: Date.now(),
    };

    const savePromise = saveWeeklyDraft(draft);
    await vi.runAllTimersAsync();
    await savePromise;

    const resumedDraft = await loadWeeklyDraft(isoWeekKey);
    expect(resumedDraft).toEqual(expect.objectContaining({ isoWeekKey, answers }));

    const dailyEntries = [
      { dateISO: "2024-05-10", sleepQuality0to10: 7 },
      { dateISO: "2024-05-11", sleepQuality0to10: 7 },
      { dateISO: "2024-05-12", sleepQuality0to10: 7 },
      { dateISO: "2024-05-13", pain0to10: 4, sleepQuality0to10: 5 },
      { dateISO: "2024-05-14", pain0to10: 6, bleeding: "light" as const, medicationsChanged: true, sleepQuality0to10: 5 },
      { dateISO: "2024-05-15", pain0to10: 5, sleepQuality0to10: 4 },
      { dateISO: "2024-05-16", pain0to10: 3, sleepQuality0to10: 4 },
      { dateISO: "2024-05-17", pain0to10: 4, sleepQuality0to10: 4 },
    ];

    const stats = computeWeeklyStats(dailyEntries, weekStartISO, weekEndISO);
    expect(stats.avgPain).toBeGreaterThan(0);

    const submittedAt = Date.now();
    await storeWeeklyReport({ isoWeekKey, stats, answers, submittedAt });

    const reports = await listWeeklyReports();
    expect(reports).toHaveLength(1);
    const storedReport = reports[0];
    expect(storedReport.isoWeekKey).toBe(isoWeekKey);
    expect(storedReport.answers.helped).toContain("Wärmeflasche");
    expect(storedReport.stats.avgPain).toBe(stats.avgPain);

    const createObjectURL = vi.fn(() => "blob:weekly-report");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", {
      value: createObjectURL,
      writable: true,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      value: revokeObjectURL,
      writable: true,
    });

    const pdfBlob = await exportWeeklyReportPDF(storedReport);
    expect(pdfBlob).toBeInstanceOf(Blob);
    expect(createObjectURL).toHaveBeenCalledWith(pdfBlob);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(document.body.querySelector("a")).not.toBeInTheDocument();
  });
});
