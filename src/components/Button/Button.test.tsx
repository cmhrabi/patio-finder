import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { Button } from "./Button";

describe("Button", () => {
  it("invokes onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("forwards refs", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>Hi</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>Save</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("has no a11y violations", async () => {
    const { container } = render(<Button>Find sunny patios</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
