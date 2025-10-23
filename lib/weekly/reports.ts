import { getItem, setItem } from "@/lib/persistence";
import type { WeeklyStats } from "./aggregate";
import type { WeeklyDraft } from "./drafts";
import { normalizeWpai } from "./wpai";

export type PromptAnswers = WeeklyDraft["answers"];

export type WeeklyReport = {
  isoWeekKey: string;
  stats: WeeklyStats;
  answers: PromptAnswers;
  submittedAt: number;
};

const STORAGE_KEY = "endo.weekly.reports.v1";

type StoredReports = WeeklyReport[];

function normalizeAnswers(answers: PromptAnswers | undefined): PromptAnswers {
  if (!answers) {
    return { helped: [], worsened: [], nextWeekTry: [], freeText: "", wpai: normalizeWpai() };
  }
  return {
    helped: Array.isArray(answers.helped) ? [...answers.helped] : [],
    worsened: Array.isArray(answers.worsened) ? [...answers.worsened] : [],
    nextWeekTry: Array.isArray(answers.nextWeekTry) ? [...answers.nextWeekTry] : [],
    freeText: answers.freeText ?? "",
    wpai: normalizeWpai(answers.wpai),
  };
}

function cloneReport(report: WeeklyReport): WeeklyReport {
  const stats = report.stats;
  return {
    isoWeekKey: report.isoWeekKey,
    stats: {
      ...stats,
      sparkline: Array.isArray(stats.sparkline)
        ? stats.sparkline.map((point) => ({ ...point }))
        : [],
      notes: { ...stats.notes },
    },
    answers: normalizeAnswers(report.answers),
    submittedAt: report.submittedAt,
  };
}

async function readStoredReports(): Promise<StoredReports> {
  const result = await getItem<StoredReports>(STORAGE_KEY);
  const value = result.value;
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is WeeklyReport =>
      Boolean(entry && typeof entry.isoWeekKey === "string" && typeof entry.submittedAt === "number")
    )
    .map(cloneReport)
    .sort((a, b) => b.submittedAt - a.submittedAt);
}

async function persistReports(reports: StoredReports): Promise<void> {
  await setItem(STORAGE_KEY, reports);
}

export async function storeWeeklyReport(report: WeeklyReport): Promise<void> {
  const existing = await readStoredReports();
  const filtered = existing.filter((item) => item.isoWeekKey !== report.isoWeekKey);
  const sanitizedReport = cloneReport(report);
  const nextReports: StoredReports = [sanitizedReport, ...filtered].sort((a, b) => b.submittedAt - a.submittedAt);
  await persistReports(nextReports);
}

export async function listWeeklyReports(limit?: number): Promise<WeeklyReport[]> {
  const reports = await readStoredReports();
  if (typeof limit === "number" && limit >= 0) {
    return reports.slice(0, limit).map(cloneReport);
  }
  return reports.map(cloneReport);
}

export async function replaceWeeklyReports(reports: WeeklyReport[]): Promise<void> {
  const sanitized = reports.map(cloneReport).sort((a, b) => b.submittedAt - a.submittedAt);
  await persistReports(sanitized);
}
