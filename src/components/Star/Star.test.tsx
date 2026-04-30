import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { useState } from "react";
import { Star } from "./Star";

describe("Star", () => {
  it("toggles uncontrolled state on click", async () => {
    render(<Star />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onChange with the next state", async () => {
    const onChange = vi.fn();
    render(<Star onChange={onChange} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("supports controlled mode", async () => {
    function Harness() {
      const [v, setV] = useState(false);
      return <Star pressed={v} onChange={setV} />;
    }
    render(<Harness />);
    const btn = screen.getByRole("button");
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("updates the accessible name to reflect state", async () => {
    render(<Star />);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button", { name: "Saved" })).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = render(<Star />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
