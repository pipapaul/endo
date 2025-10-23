import { describe, expect, it } from "vitest";

import { computeWeeklyStats, detectHighlights, type WeeklyStats } from "./aggregate";

describe("computeWeeklyStats", () => {
  const weekStart = "2024-05-13";
  const weekEnd = "2024-05-19";

  it("returns neutral stats when no entries are available", () => {
    const stats = computeWeeklyStats([], weekStart, weekEnd);

    expect(stats.avgPain).toBeNull();
    expect(stats.maxPain).toBeNull();
    expect(stats.badDaysCount).toBe(0);
    expect(stats.bleedingDaysCount).toBe(0);
    expect(stats.notes).toEqual({ medicationChange: false, sleepBelowUsual: false });
    expect(stats.sparkline).toHaveLength(7);
    expect(stats.sparkline.every((point) => point.pain === null)).toBe(true);
  });

  it("handles a single day with measurements correctly", () => {
    const daily = [
      { dateISO: "2024-05-10", sleepQuality0to10: 6 },
      { dateISO: "2024-05-11", sleepQuality0to10: 7 },
      { dateISO: "2024-05-12", sleepQuality0to10: 6 },
      {
        dateISO: "2024-05-14",
        pain0to10: 5,
        bleeding: "light" as const,
        medicationsChanged: true,
        sleepQuality0to10: 6,
      },
      { dateISO: "2024-05-20", pain0to10: 8 },
    ];

    const stats = computeWeeklyStats(daily, weekStart, weekEnd);

    expect(stats.avgPain).toBe(5);
    expect(stats.maxPain).toBe(5);
    expect(stats.badDaysCount).toBe(0);
    expect(stats.bleedingDaysCount).toBe(1);
    expect(stats.notes).toEqual({ medicationChange: true, sleepBelowUsual: false });
    expect(stats.sparkline.find((point) => point.dateISO === "2024-05-14")?.pain).toBe(5);
  });

  it("captures outlier pain values without losing overall accuracy", () => {
    const daily = [
      { dateISO: "2024-05-13", pain0to10: 2 },
      { dateISO: "2024-05-14", pain0to10: 10 },
      { dateISO: "2024-05-15", pain0to10: 3 },
      { dateISO: "2024-05-16", pain0to10: 2 },
    ];

    const stats = computeWeeklyStats(daily, weekStart, weekEnd);

    expect(stats.avgPain).toBe(4.25);
    expect(stats.maxPain).toBe(10);
    expect(stats.badDaysCount).toBe(1);
    expect(stats.sparkline.find((point) => point.dateISO === "2024-05-14")?.pain).toBe(10);
  });

  it("supports weeks with missing pain data and still detects sleep trends", () => {
    const daily = [
      { dateISO: "2024-05-13", sleepQuality0to10: 4 },
      { dateISO: "2024-05-14", sleepQuality0to10: 4 },
      { dateISO: "2024-05-15", sleepQuality0to10: 4 },
      { dateISO: "2024-05-16", sleepQuality0to10: 4 },
      { dateISO: "2024-05-17", sleepQuality0to10: 4 },
      { dateISO: "2024-05-10", sleepQuality0to10: 7 },
      { dateISO: "2024-05-11", sleepQuality0to10: 7 },
      { dateISO: "2024-05-12", sleepQuality0to10: 7 },
    ];

    const stats = computeWeeklyStats(daily, weekStart, weekEnd);

    expect(stats.avgPain).toBeNull();
    expect(stats.maxPain).toBeNull();
    expect(stats.badDaysCount).toBe(0);
    expect(stats.bleedingDaysCount).toBe(0);
    expect(stats.sparkline.every((point) => point.pain === null)).toBe(true);
    expect(stats.notes).toEqual({ medicationChange: false, sleepBelowUsual: true });
  });
});

describe("detectHighlights", () => {
  const baseStats: WeeklyStats = {
    isoWeekKey: "2024-W20",
    startISO: "2024-05-13",
    endISO: "2024-05-19",
    avgPain: 6.5,
    maxPain: 8,
    badDaysCount: 3,
    bleedingDaysCount: 2,
    sparkline: [],
    notes: { medicationChange: true, sleepBelowUsual: true },
  };

  it("collects highlights when medication changes, poor sleep and pain spikes occur", () => {
    const history: WeeklyStats[] = [
      {
        ...baseStats,
        avgPain: 4,
        notes: { medicationChange: false, sleepBelowUsual: false },
      },
      {
        ...baseStats,
        avgPain: 5,
        notes: { medicationChange: false, sleepBelowUsual: false },
      },
    ];

    const highlights = detectHighlights(baseStats, history);

    expect(highlights).toEqual([
      { kind: "medication_change", message: "Medication changes documented this week." },
      { kind: "poor_sleep", message: "Sleep quality trended below usual levels." },
      {
        kind: "above_trend",
        message: "Average pain (6.5) exceeded the recent baseline (4.5).",
      },
    ]);
  });

  it("does not add trend highlights when averages are missing", () => {
    const stats: WeeklyStats = {
      ...baseStats,
      avgPain: null,
      notes: { medicationChange: false, sleepBelowUsual: false },
    };

    const history: WeeklyStats[] = [
      {
        ...baseStats,
        avgPain: 4,
        notes: { medicationChange: false, sleepBelowUsual: false },
      },
    ];

    const highlights = detectHighlights(stats, history);

    expect(highlights).toEqual([]);
  });
});
