import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { Heading } from "./Heading";

describe("Heading", () => {
  it("renders the default heading element for the given size", () => {
    render(<Heading size="display-sm">Otto's Bierhalle</Heading>);
    const node = screen.getByRole("heading", { level: 3 });
    expect(node).toHaveTextContent("Otto's Bierhalle");
    expect(node).toHaveClass("type-display-sm");
  });

  it("respects the `as` override", () => {
    render(<Heading as="h2" size="display-xl">Bellwoods</Heading>);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = render(<Heading>Civil Liberties</Heading>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
