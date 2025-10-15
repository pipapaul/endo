import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Ehp5Monthly } from "@/components/Ehp5Monthly";

describe("Ehp5Monthly", () => {
  it("speichert Werte in Array", () => {
    const handleChange = vi.fn();
    render(<Ehp5Monthly value={[0, 0, 0, 0, 0]} onChange={handleChange} />);
    const buttons = screen.getAllByRole("radio");
    fireEvent.click(buttons[4]);
    const payload = handleChange.mock.calls.at(-1)?.[0];
    expect(Array.isArray(payload)).toBe(true);
    expect(payload[0]).toBe(0);
  });
});
