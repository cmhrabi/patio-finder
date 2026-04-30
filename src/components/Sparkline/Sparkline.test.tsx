import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { Sparkline } from "./Sparkline";

describe("Sparkline", () => {
  it("renders a current-position dot when currentIndex is provided", () => {
    const { container } = render(<Sparkline data={[1, 2, 3, 4]} currentIndex={2} />);
    expect(container.querySelectorAll("circle").length).toBeGreaterThan(0);
  });

  it("renders no dot when currentIndex is omitted", () => {
    const { container } = render(<Sparkline data={[1, 2, 3, 4]} />);
    expect(container.querySelectorAll("circle").length).toBe(0);
  });

  it("derives an accessible label", () => {
    render(<Sparkline data={[1, 2, 3, 4, 5]} />);
    expect(screen.getByRole("img")).toHaveAccessibleName("Trend over 5 points");
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <Sparkline data={[10, 20, 30, 40, 50]} currentIndex={3} aria-label="Sun hours today" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
