import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DailyEntry } from "@/lib/types";

import HomePage from "./page";

const persistentStore = new Map<string, unknown>();

vi.mock("@/lib/usePersistentState", () => {
  const React = require("react");
  const meta = {
    ready: true,
    driver: "memory",
    error: null,
    driverLabel: "Memory",
    isSaving: false,
    lastSavedAt: null,
    restored: false,
  } as const;
  return {
    usePersistentState: (key: string, defaultValue: unknown) => {
      const [value, setValue] = React.useState(
        persistentStore.has(key) ? persistentStore.get(key) : defaultValue
      );
      React.useEffect(() => {
        persistentStore.set(key, value);
      }, [key, value]);
      return [value, setValue, meta] as const;
    },
  };
});

vi.mock("@/lib/persistence", () => ({
  touchLastActive: vi.fn(),
}));

const formatIsoDate = (value: Date) => value.toISOString().slice(0, 10);

describe("PBAC drafts across quick add navigation", () => {
  beforeEach(() => {
    persistentStore.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps PBAC products when a pain quick add switches to another date", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
    render(<HomePage />);

    await user.click(await screen.findByRole("button", { name: "Vorheriger Tag" }));

    const bleedingQuickAddButton = screen.getAllByRole("button", {
      name: "Periode: Produkt hinzufügen",
    })[0];
    await user.click(bleedingQuickAddButton);

    await user.click(await screen.findByRole("button", { name: "Binde – leicht" }));

    const painQuickAddButton = screen.getAllByRole("button", {
      name: "Schmerzen schnell erfassen",
    })[0];
    await user.click(painQuickAddButton);

    await user.click(await screen.findByRole("button", { name: "Kopf" }));
    await user.click(screen.getByRole("button", { name: "krampfend" }));
    await user.click(screen.getByRole("button", { name: /speichern/i }));

    await waitFor(() => {
      const entries = persistentStore.get("endo.daily.v2") as DailyEntry[] | undefined;
      const yesterday = formatIsoDate(new Date(Date.now() - 86_400_000));
      const matchingEntry = entries?.find((entry) => entry.date === yesterday);
      expect(matchingEntry?.pbacCounts?.pad_light).toBe(1);
    });
  });
});
