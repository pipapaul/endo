import { describe, expect, it } from "vitest";
import { buildBackup, parseBackup } from "./importExport";
import { DEFAULT_PRODUCT_SETTINGS } from "@/lib/productSettings";
import type { AppSnapshot } from "./repository";

const fallback = DEFAULT_PRODUCT_SETTINGS;

describe("parseBackup", () => {
  it("imports a v1 export (dailyEntries / featureFlags keys)", () => {
    const v1 = {
      version: 1,
      exportedAt: "2025-01-01T00:00:00.000Z",
      dailyEntries: [
        { date: "2025-01-01", painNRS: 4, bleeding: { isBleeding: true, pbacScore: 10 } },
      ],
      monthlyEntries: [{ month: "2025-01" }],
      weeklyReports: [],
      featureFlags: { billingMethod: true },
    };
    const { snapshot, counts } = parseBackup(v1, fallback);
    expect(counts.daily).toBe(1);
    expect(snapshot.daily[0].date).toBe("2025-01-01");
    expect(snapshot.flags.billingMethod).toBe(true);
    expect(counts.monthly).toBe(1);
  });

  it("imports a v2 export (daily / flags keys)", () => {
    const v2 = {
      version: 2,
      daily: [{ date: "2025-02-02", painNRS: 0, bleeding: { isBleeding: false } }],
      monthly: [],
      weekly: [],
      flags: {},
    };
    const { counts } = parseBackup(v2, fallback);
    expect(counts.daily).toBe(1);
  });

  it("round-trips an export", () => {
    const snapshot: AppSnapshot = {
      daily: [
        {
          date: "2025-03-03",
          painNRS: 2,
          painQuality: [],
          painMapRegionIds: [],
          bleeding: { isBleeding: false },
          symptoms: {},
        },
      ],
      monthly: [],
      weekly: [],
      flags: {},
      productSettings: fallback,
    };
    const parsed = parseBackup(JSON.parse(buildBackup(snapshot)), fallback);
    expect(parsed.counts.daily).toBe(1);
    expect(parsed.snapshot.daily[0].date).toBe("2025-03-03");
  });

  it("throws on an empty/unrecognised file", () => {
    expect(() => parseBackup({ foo: "bar" }, fallback)).toThrow();
    expect(() => parseBackup(null, fallback)).toThrow();
  });
});
