import { describe, expect, it } from "vitest";
import {
  addDays,
  analyzeCycle,
  buildCyclePredictions,
  computeCycleStats,
  daysBetween,
  detectPeriodStarts,
} from "./cycle";
import type { DailyEntry } from "@/lib/types";

function bleedingEntry(date: string, pbacScore = 10): DailyEntry {
  return {
    date,
    painNRS: 0,
    painQuality: [],
    painMapRegionIds: [],
    bleeding: { isBleeding: true, pbacScore },
    symptoms: {},
  };
}

/** Build a 28-day cycle history: bleeding on days 1-5 of each cycle. */
function cycleHistory(starts: string[], periodLength = 5): DailyEntry[] {
  const entries: DailyEntry[] = [];
  for (const start of starts) {
    for (let i = 0; i < periodLength; i += 1) {
      entries.push(bleedingEntry(addDays(start, i)));
    }
  }
  return entries;
}

describe("date helpers", () => {
  it("adds and diffs days across month boundaries", () => {
    expect(addDays("2025-01-30", 3)).toBe("2025-02-02");
    expect(daysBetween("2025-01-30", "2025-02-02")).toBe(3);
  });
});

describe("detectPeriodStarts", () => {
  it("finds one start per period and ignores mid-period gaps", () => {
    const entries = [
      ...cycleHistory(["2025-01-01", "2025-01-29", "2025-02-26"]),
    ];
    expect(detectPeriodStarts(entries)).toEqual([
      "2025-01-01",
      "2025-01-29",
      "2025-02-26",
    ]);
  });

  it("does not split a period that has a single skipped day", () => {
    const entries = [
      bleedingEntry("2025-01-01"),
      bleedingEntry("2025-01-02"),
      // gap on the 3rd
      bleedingEntry("2025-01-04"),
    ];
    // The 4th is within MIN_CYCLE_GAP of the 1st → still one start.
    expect(detectPeriodStarts(entries)).toEqual(["2025-01-01"]);
  });
});

describe("computeCycleStats", () => {
  it("averages recent cycle lengths", () => {
    const stats = computeCycleStats(cycleHistory(["2025-01-01", "2025-01-29", "2025-02-26"]));
    expect(stats).not.toBeNull();
    expect(stats!.averageLength).toBe(28);
    expect(stats!.lengths).toEqual([28, 28]);
    expect(stats!.lastStart).toBe("2025-02-26");
  });

  it("returns null without any bleeding data", () => {
    expect(computeCycleStats([])).toBeNull();
  });
});

describe("analyzeCycle", () => {
  it("computes cycle day, ovulation and next period", () => {
    const entries = cycleHistory(["2025-01-01", "2025-01-29", "2025-02-26"]);
    const analysis = analyzeCycle(entries, "2025-03-05");
    expect(analysis).not.toBeNull();
    // Day count from 2025-02-26 to 2025-03-05 = 7 days → cycle day 8
    expect(analysis!.currentCycleDay).toBe(8);
    expect(analysis!.predictedOvulationDay).toBe(14); // 28 - 14
    expect(analysis!.nextPeriodStart).toBe("2025-03-26");
    expect(analysis!.phase).toBe("follicular");
  });
});

describe("buildCyclePredictions", () => {
  it("predicts future menstruation and ovulation", () => {
    const entries = cycleHistory(["2025-01-01", "2025-01-29", "2025-02-26"]);
    const points = buildCyclePredictions(entries, { from: "2025-03-01", to: "2025-04-30" });
    const byDate = new Map(points.map((p) => [p.date, p]));

    // Next cycle starts 2025-03-26 → predicted menstruation days 26-30.
    expect(byDate.get("2025-03-26")?.predictedMenstruation).toBe(true);
    // Ovulation = cycle day 14 of the cycle starting 2025-03-26 → 2025-04-08.
    expect(byDate.get("2025-04-08")?.isPredictedOvulation).toBe(true);
  });
});
