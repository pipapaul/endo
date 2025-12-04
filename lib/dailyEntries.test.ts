import { describe, expect, it } from "vitest";

import {
  hasBleedingForEntry,
  normalizeDailyEntry,
  pruneDailyEntryByCompletion,
} from "./dailyEntries";
import { createEmptyPbacCounts } from "./pbac";
import type { DailyEntry } from "./types";

describe("normalizeDailyEntry", () => {
  it("fills bleeding defaults for legacy entries", () => {
    const legacyEntry = {
      date: "2024-01-01",
      painNRS: 0,
      painQuality: [],
      painMapRegionIds: [],
      symptoms: {},
      rescueMeds: [],
    } as unknown as DailyEntry;

    const normalized = normalizeDailyEntry(legacyEntry);

    expect(normalized.bleeding).toEqual({ isBleeding: false });
    expect(normalized.rescueMeds).toEqual([]);
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
      pbacCounts: createEmptyPbacCounts(),
      symptoms: {},
      rescueMeds: [],
      quickPainEvents: [],
    };

    const normalized = normalizeDailyEntry(entry);

    expect(normalized).toBe(entry);
  });

  it("adds empty pbac counts when missing", () => {
    const entry = normalizeDailyEntry({
      date: "2024-03-01",
      painNRS: 0,
      painQuality: [],
      painMapRegionIds: [],
      bleeding: { isBleeding: false },
    } as DailyEntry);

    expect(entry.pbacCounts).toEqual(createEmptyPbacCounts());
  });

  it("normalizes provided pbac counts", () => {
    const entry = normalizeDailyEntry({
      date: "2024-03-02",
      painNRS: 0,
      painQuality: [],
      painMapRegionIds: [],
      bleeding: { isBleeding: true, pbacScore: 5 },
      pbacCounts: { pad_light: 2, tampon_medium: 1, clot_large: 1 } as DailyEntry["pbacCounts"],
    } as DailyEntry);

    expect(entry.pbacCounts).toEqual({
      ...createEmptyPbacCounts(),
      pad_light: 2,
      tampon_medium: 1,
      clot_large: 1,
    });
  });
});

describe("hasBleedingForEntry", () => {
  it("detects bleeding when pbac counts are present", () => {
    const entry = normalizeDailyEntry({
      date: "2024-04-01",
      painNRS: 0,
      painQuality: [],
      painMapRegionIds: [],
      bleeding: { isBleeding: false },
      pbacCounts: { ...createEmptyPbacCounts(), pad_light: 1 },
    } as DailyEntry);

    expect(hasBleedingForEntry(entry)).toBe(true);
  });

  it("honors legacy bleeding flag even without pbac counts", () => {
    const entry = normalizeDailyEntry({
      date: "2024-04-02",
      painNRS: 0,
      painQuality: [],
      painMapRegionIds: [],
      bleeding: { isBleeding: true },
      pbacCounts: createEmptyPbacCounts(),
    } as DailyEntry);

    expect(hasBleedingForEntry(entry)).toBe(true);
  });

  it("returns false when no bleeding data is present", () => {
    const entry = normalizeDailyEntry({
      date: "2024-04-03",
      painNRS: 0,
      painQuality: [],
      painMapRegionIds: [],
      bleeding: { isBleeding: false },
      pbacCounts: createEmptyPbacCounts(),
    } as DailyEntry);

    expect(hasBleedingForEntry(entry)).toBe(false);
  });
});

describe("pruneDailyEntryByCompletion", () => {
  it("keeps quick pain events even when pain is not completed", () => {
    const entry: DailyEntry = {
      date: "2024-05-01",
      painNRS: 5,
      impactNRS: 3,
      painRegions: [],
      painQuality: ["krampfend"],
      painMapRegionIds: ["abdomen"],
      quickPainEvents: [
        {
          id: 1,
          date: "2024-05-01",
          timestamp: "2024-05-01T12:00:00.000Z",
          regionId: "abdomen",
          intensity: 4,
          qualities: ["krampfend"],
        },
      ],
      bleeding: { isBleeding: false },
      pbacCounts: createEmptyPbacCounts(),
      symptoms: {},
      rescueMeds: [],
    };

    const pruned = pruneDailyEntryByCompletion(entry, { pain: false });

    expect(pruned.quickPainEvents).toEqual(entry.quickPainEvents);
  });

  it("preserves PBAC counts even when bleeding is not completed", () => {
    const entry: DailyEntry = {
      date: "2024-05-02",
      painNRS: 0,
      painQuality: [],
      painMapRegionIds: [],
      bleeding: { isBleeding: true, pbacScore: 8 },
      pbacCounts: { ...createEmptyPbacCounts(), pad_light: 2 },
      symptoms: {},
      rescueMeds: [],
    };

    const pruned = pruneDailyEntryByCompletion(entry, { bleeding: false });

    expect(pruned.pbacCounts).toEqual(entry.pbacCounts);
    expect(pruned.bleeding).toEqual({ isBleeding: false });
  });
});
