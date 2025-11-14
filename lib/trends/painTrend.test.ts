import { describe, expect, it } from "vitest";

import { formatDate, parseIsoDate } from "@/lib/date";
import type { DailyEntry } from "@/lib/types";
import {
  buildPainTrendSeries,
  LAST_TREND_WINDOW_DAYS,
  type AnnotatedDailyEntryForTrend,
} from "@/lib/trends/painTrend";

const createDailyEntry = (
  iso: string,
  overrides: Partial<DailyEntry> = {}
): DailyEntry => ({
  date: iso,
  painRegions: overrides.painRegions ?? [],
  impactNRS: overrides.impactNRS ?? 0,
  painNRS: overrides.painNRS ?? 0,
  painQuality: overrides.painQuality ?? [],
  painMapRegionIds: overrides.painMapRegionIds ?? [],
  bleeding:
    overrides.bleeding ?? {
      isBleeding: false,
    },
  symptoms: overrides.symptoms ?? {},
  meds: overrides.meds ?? [],
  rescueDosesCount: overrides.rescueDosesCount,
  sleep: overrides.sleep,
  gi: overrides.gi,
  urinary: overrides.urinary,
  activity: overrides.activity,
  exploratory: overrides.exploratory,
  ovulation: overrides.ovulation,
  ovulationPain: overrides.ovulationPain,
  urinaryOpt: overrides.urinaryOpt,
  headacheOpt: overrides.headacheOpt,
  dizzinessOpt: overrides.dizzinessOpt,
  notesTags: overrides.notesTags,
  notesFree: overrides.notesFree,
});

describe("buildPainTrendSeries", () => {
  const todayIso = "2024-03-30";
  const todayDate = parseIsoDate(todayIso)!;

  const annotatedEntries: AnnotatedDailyEntryForTrend[] = [
    {
      entry: createDailyEntry(todayIso, {
        painNRS: 6,
        bleeding: { isBleeding: true, pbacScore: 120 },
        sleep: { quality: 4 },
      }),
      cycleDay: 1,
      weekday: "Sa",
      symptomAverage: 2.5,
    },
    {
      entry: createDailyEntry("2024-03-27", {
        painNRS: 3,
        bleeding: { isBleeding: false },
      }),
      cycleDay: 28,
      weekday: "Mi",
      symptomAverage: null,
    },
  ];

  it("returns exactly 30 days ending today", () => {
    const { data } = buildPainTrendSeries(annotatedEntries, todayDate);
    expect(data).toHaveLength(LAST_TREND_WINDOW_DAYS);
    const expectedStart = new Date(todayDate.getTime());
    expectedStart.setDate(expectedStart.getDate() - (LAST_TREND_WINDOW_DAYS - 1));
    expect(data[0].date).toBe(formatDate(expectedStart));
    expect(data[data.length - 1].date).toBe(todayIso);
    expect(new Set(data.map((item) => item.date)).size).toBe(LAST_TREND_WINDOW_DAYS);
  });

  it("fills missing days with placeholders", () => {
    const { data } = buildPainTrendSeries(annotatedEntries, todayDate);
    const placeholder = data.find((item) => item.date === "2024-03-28");
    expect(placeholder).toBeDefined();
    expect(placeholder?.pain).toBeNull();
    expect(placeholder?.pbac).toBeNull();
    expect(placeholder?.cycleLabel).toBe("–");
  });

  it("marks cycle starts and preserves recorded metrics", () => {
    const { data, cycleStarts } = buildPainTrendSeries(annotatedEntries, todayDate);
    const todayEntry = data.find((item) => item.date === todayIso);
    expect(todayEntry?.pain).toBe(6);
    expect(todayEntry?.pbac).toBe(120);
    expect(todayEntry?.sleepQuality).toBe(4);
    expect(todayEntry?.symptomAverage).toBe(2.5);
    expect(cycleStarts.map((item) => item.date)).toContain(todayIso);
  });
});
