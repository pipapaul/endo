import { describe, expect, it } from "vitest";

import { computeCorrelations } from "@/lib/logic/correlations";
import type { DayEntry } from "@/lib/types";

describe("computeCorrelations", () => {
  it("gibt erst ab n>=14 Werte zurück", () => {
    const base: DayEntry = {
      id: "1",
      date: "2024-01-01",
      mode: "quick",
      nrs: 5,
      pbac: { products: [], dayScore: 20 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const few: DayEntry[] = Array.from({ length: 10 }, (_, index) => ({
      ...base,
      id: `${index}`,
      date: `2024-01-${String(index + 1).padStart(2, "0")}`,
    }));
    expect(computeCorrelations(few)).toHaveLength(0);

    const many: DayEntry[] = Array.from({ length: 20 }, (_, index) => ({
      ...base,
      id: `many-${index}`,
      date: `2024-02-${String(index + 1).padStart(2, "0")}`,
      nrs: (index % 10) as DayEntry["nrs"],
      pbac: { products: [], dayScore: index * 5 },
    }));
    expect(computeCorrelations(many).length).toBeGreaterThan(0);
  });
});
