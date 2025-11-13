import { describe, expect, it } from "vitest";

import { normalizeDailyEntry } from "./dailyEntries";
import type { DailyEntry } from "./types";

describe("normalizeDailyEntry", () => {
  it("fills bleeding defaults for legacy entries", () => {
    const legacyEntry = {
      date: "2024-01-01",
      painNRS: 0,
      painQuality: [],
      painMapRegionIds: [],
      symptoms: {},
      meds: [],
    } as unknown as DailyEntry;

    const normalized = normalizeDailyEntry(legacyEntry);

    expect(normalized.bleeding).toEqual({ isBleeding: false });
    expect(normalized.meds).toEqual([]);
    expect(normalized.symptoms).toEqual({});
    expect(normalized.painRegions).toEqual([]);
  });

  it("returns the same reference when no normalization is needed", () => {
    const entry: DailyEntry = {
      date: "2024-02-01",
      painNRS: 1,
      painQuality: [],
      painMapRegionIds: [],
      painRegions: [],
      bleeding: { isBleeding: true, pbacScore: 12 },
      symptoms: {},
      meds: [],
    };

    const normalized = normalizeDailyEntry(entry);

    expect(normalized).toBe(entry);
  });
});
