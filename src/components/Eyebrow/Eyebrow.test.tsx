import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { Eyebrow } from "./Eyebrow";

describe("Eyebrow", () => {
  it("renders text in caps via the type ramp class", () => {
    render(<Eyebrow>Open now</Eyebrow>);
    const el = screen.getByText("Open now");
    expect(el).toHaveClass("type-eyebrow");
  });

  it("has no a11y violations", async () => {
    const { container } = render(<Eyebrow accent>Live</Eyebrow>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
