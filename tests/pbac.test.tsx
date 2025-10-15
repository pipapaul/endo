import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PbacMini } from "@/components/PbacMini";

describe("PbacMini", () => {
  it("berechnet den Tagesscore korrekt", () => {
    const handleChange = vi.fn();
    render(<PbacMini value={{ products: [], dayScore: 0 }} onChange={handleChange} />);

    const fullPadButton = screen.getByRole("button", { name: /Binde/i });
    fireEvent.click(fullPadButton);

    expect(handleChange).toHaveBeenCalled();
    const payload = handleChange.mock.calls.at(-1)?.[0];
    expect(payload.dayScore).toBeGreaterThan(0);
  });
});
