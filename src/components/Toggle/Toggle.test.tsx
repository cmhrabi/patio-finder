import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("toggles uncontrolled state on click", async () => {
    render(<Toggle aria-label="Open now" />);
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange with the next state", async () => {
    const onChange = vi.fn();
    render(<Toggle aria-label="Filter" onChange={onChange} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("reflects the controlled `checked` prop", () => {
    const { rerender } = render(<Toggle aria-label="X" checked={false} onChange={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    rerender(<Toggle aria-label="X" checked onChange={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("does not toggle when disabled", async () => {
    const onChange = vi.fn();
    render(<Toggle aria-label="X" disabled onChange={onChange} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("has no a11y violations with a label", async () => {
    const { container } = render(<Toggle label="Open now" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
