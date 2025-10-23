import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PromptAnswers } from "@/lib/weekly/drafts";
import type { SuggestionSection } from "@/lib/weekly/suggestions";

import { WeeklyPrompts } from "./WeeklyPrompts";

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
    const initialAnswers: PromptAnswers = { helped: [], worsened: [], nextWeekTry: [], freeText: "" };
    const handleChange = vi.fn();

    const { unmount } = render(<WeeklyPrompts value={initialAnswers} onChange={handleChange} />);

    expect(await screen.findByText("Noch keine Vorschläge vorhanden.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Akupunktur" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Eigenen Punkt hinzufügen"), "Akupunktur");
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

    await waitFor(() => {
      expect(screen.queryByText("Noch keine Vorschläge vorhanden.")).not.toBeInTheDocument();
    });
    const restoredChip = await screen.findByRole("button", { name: "Akupunktur" });
    expect(restoredChip).toBeInTheDocument();
    expect(nextHandleChange).not.toHaveBeenCalled();
  });
});
