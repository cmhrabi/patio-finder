import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { Logo } from "./Logo";

describe("Logo", () => {
  it("renders an accessible name by default", () => {
    render(<Logo />);
    expect(screen.getByRole("img", { name: "Golden Hour" })).toBeInTheDocument();
  });

  it("renders 8 rays in the SVG mark", () => {
    const { container } = render(<Logo variant="mark" />);
    expect(container.querySelectorAll("svg line")).toHaveLength(8);
  });

  it("renders the wordmark in `full` variant only", () => {
    const { rerender } = render(<Logo variant="full" />);
    expect(screen.getByText("Golden Hour")).toBeInTheDocument();
    rerender(<Logo variant="mark" />);
    expect(screen.queryByText("Golden Hour")).not.toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = render(<Logo />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
