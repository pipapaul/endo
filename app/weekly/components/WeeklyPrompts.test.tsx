import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SuggestionSection } from "@/lib/weekly/suggestions";

import { WeeklyPrompts, type PromptAnswers } from "./WeeklyPrompts";

const { getSuggestedChipsMock, rememberChosenChipsMock, suggestionStore } = vi.hoisted(() => {
  const suggestionStore: Record<SuggestionSection, string[]> = {
    helped: [],
    worsened: [],
    nextWeekTry: [],
  };

  const getSuggestedChipsMock = vi.fn(async (section: SuggestionSection) => {
    return [...suggestionStore[section]];
  });

  const rememberChosenChipsMock = vi.fn(async (section: SuggestionSection, items: string[]) => {
    const normalized = items.map((item) => item.trim()).filter(Boolean);
    const merged = [...normalized, ...suggestionStore[section]];
    const deduped = Array.from(new Map(merged.map((item) => [item.toLocaleLowerCase(), item])).values());
    suggestionStore[section] = deduped;
  });

  return { getSuggestedChipsMock, rememberChosenChipsMock, suggestionStore };
});

vi.mock("@/lib/weekly/suggestions", () => ({
  getSuggestedChips: getSuggestedChipsMock,
  rememberChosenChips: rememberChosenChipsMock,
}));

describe("WeeklyPrompts", () => {
  beforeEach(() => {
    suggestionStore.helped = [];
    suggestionStore.worsened = [];
    suggestionStore.nextWeekTry = [];
    getSuggestedChipsMock.mockClear();
    rememberChosenChipsMock.mockClear();
  });

  it("persists selected chips and suggests them again on the next render", async () => {
    const user = userEvent.setup();
    const initialAnswers: PromptAnswers = { helped: [], worsened: [], nextWeekTry: [], freeText: "", wpai: { absenteeismPct: 0, presenteeismPct: 0, overallPct: 0 } };
    const handleChange = vi.fn();

    const { unmount } = render(<WeeklyPrompts value={initialAnswers} onChange={handleChange} />);

    // All three sections initially show "no suggestions" message
    const noSuggestionMessages = await screen.findAllByText("Noch keine Vorschläge vorhanden.");
    expect(noSuggestionMessages).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Akupunktur" })).not.toBeInTheDocument();

    // Target the first input (the "helped" section)
    await user.type(screen.getAllByLabelText("Eigenen Punkt hinzufügen")[0], "Akupunktur");
    await user.click(screen.getAllByRole("button", { name: "Als Chip übernehmen" })[0]);

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ helped: ["Akupunktur"] })
      );
    });
    expect(await screen.findByRole("button", { name: "Akupunktur" })).toBeInTheDocument();
    expect(rememberChosenChipsMock).toHaveBeenCalledWith("helped", ["Akupunktur"]);

    unmount();

    const nextHandleChange = vi.fn();
    render(<WeeklyPrompts value={initialAnswers} onChange={nextHandleChange} />);

    // After adding a chip to "helped", that section no longer shows "no suggestions"
    // but the other two sections still do, so we should have 2 remaining
    await waitFor(() => {
      const remaining = screen.queryAllByText("Noch keine Vorschläge vorhanden.");
      expect(remaining).toHaveLength(2);
    });
    const restoredChip = await screen.findByRole("button", { name: "Akupunktur" });
    expect(restoredChip).toBeInTheDocument();
    expect(nextHandleChange).not.toHaveBeenCalled();
  });
});
