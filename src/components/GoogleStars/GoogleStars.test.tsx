import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { GoogleStars } from "./GoogleStars";

describe("GoogleStars", () => {
  it("formats the accessible label", () => {
    render(<GoogleStars value={4.6} reviews={1842} />);
    expect(screen.getByRole("img")).toHaveAccessibleName("4.6 of 5 stars (1.8k reviews)");
  });

  it("formats large review counts", () => {
    render(<GoogleStars value={4.0} reviews={12_435} />);
    expect(screen.getByText(/12k/)).toBeInTheDocument();
  });

  it("clamps out-of-range ratings", () => {
    render(<GoogleStars value={9.9} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/^5\.0 of 5 stars/);
  });

  it("has no a11y violations", async () => {
    const { container } = render(<GoogleStars value={4.5} reviews={500} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
