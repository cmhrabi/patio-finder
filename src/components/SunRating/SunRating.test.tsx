import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { SunRating } from "./SunRating";

describe("SunRating", () => {
  it("renders 5 dots by default", () => {
    const { container } = render(<SunRating value={50} />);
    expect(container.querySelectorAll("[class*='dot']").length).toBe(5);
  });

  it("clamps out-of-range values", () => {
    render(<SunRating value={150} />);
    expect(screen.getByRole("img")).toHaveAccessibleName("Sun exposure: 100 out of 100");
  });

  it("respects custom aria-label", () => {
    render(<SunRating value={42} aria-label="92% sun, golden hour" />);
    expect(screen.getByRole("img", { name: "92% sun, golden hour" })).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = render(<SunRating value={75} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
