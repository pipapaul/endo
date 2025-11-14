import type { DailyEntry } from "@/lib/types";
import { formatDate } from "@/lib/date";

export type PainTrendDatum = {
  date: string;
  cycleDay: number | null;
  cycleLabel: string;
  weekday: string;
  pain: number | null;
  pbac: number | null;
  symptomAverage: number | null;
  sleepQuality: number | null;
};

export type AnnotatedDailyEntryForTrend = {
  entry: DailyEntry;
  cycleDay: number | null;
  weekday: string;
  symptomAverage: number | null;
};

export const LAST_TREND_WINDOW_DAYS = 30;
const WEEKDAY_LOCALE = "de-DE";

export function buildPainTrendSeries(
  annotatedEntries: AnnotatedDailyEntryForTrend[],
  todayDate: Date
): { data: PainTrendDatum[]; cycleStarts: PainTrendDatum[] } {
  const annotatedByDate = new Map(
    annotatedEntries.map((item) => [item.entry.date, item] as const)
  );

  const data: PainTrendDatum[] = [];
  for (let offset = LAST_TREND_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    const current = new Date(todayDate.getTime());
    current.setDate(current.getDate() - offset);
    const iso = formatDate(current);
    const annotated = annotatedByDate.get(iso);
    const cycleDay = annotated?.cycleDay ?? null;
    const painNrs = annotated?.entry.painNRS;
    const pbacScore = annotated?.entry.bleeding.pbacScore;
    const symptomAverage = annotated?.symptomAverage;
    const sleepQuality = annotated?.entry.sleep?.quality;

    data.push({
      date: iso,
      cycleDay,
      cycleLabel: cycleDay ? `ZT ${cycleDay}` : "–",
      weekday: current.toLocaleDateString(WEEKDAY_LOCALE, { weekday: "short" }),
      pain: typeof painNrs === "number" ? painNrs : null,
      pbac: typeof pbacScore === "number" ? pbacScore : null,
      symptomAverage: typeof symptomAverage === "number" ? symptomAverage : null,
      sleepQuality: typeof sleepQuality === "number" ? sleepQuality : null,
    });
  }

  return {
    data,
    cycleStarts: data.filter((item) => item.cycleDay === 1),
  };
}
