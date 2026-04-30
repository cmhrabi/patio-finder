import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { Pill } from "./Pill";

describe("Pill", () => {
  it("renders the label", () => {
    render(<Pill variant="accent">Featured</Pill>);
    expect(screen.getByText("Featured")).toBeInTheDocument();
  });

  it("has no a11y violations across variants", async () => {
    const variants = ["default", "accent", "sun", "ink", "ghost-light"] as const;
    for (const v of variants) {
      const { container, unmount } = render(<Pill variant={v}>Label</Pill>);
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });
});
