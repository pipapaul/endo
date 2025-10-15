import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NrsSlider } from "@/components/NrsSlider";

describe("NrsSlider", () => {
  it("setzt aria-valuetext", () => {
    render(<NrsSlider value={5} onChange={() => undefined} />);
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringContaining("5"));
  });
});
