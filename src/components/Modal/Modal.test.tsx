import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "../Button/Button";

function Harness({ onCloseSpy }: { onCloseSpy?: () => void } = {}) {
  const [open, setOpen] = useState(true);
  const close = () => {
    onCloseSpy?.();
    setOpen(false);
  };
  return (
    <>
      <button data-testid="external">external</button>
      <Modal open={open} onClose={close} title="Save patio" description="Adds to favourites.">
        <Button onClick={close}>Confirm</Button>
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("renders title + description with the right ARIA wiring", () => {
    render(<Harness />);
    const dialog = screen.getByRole("dialog", { name: "Save patio" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Adds to favourites.")).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<Harness onCloseSpy={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on backdrop click", async () => {
    const onClose = vi.fn();
    render(<Harness onCloseSpy={onClose} />);
    await userEvent.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("returns focus to the previously focused element on close", async () => {
    function FocusHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button data-testid="opener" onClick={() => setOpen(true)}>
            open
          </button>
          <Modal open={open} onClose={() => setOpen(false)} title="X">
            <Button onClick={() => setOpen(false)}>Close</Button>
          </Modal>
        </>
      );
    }
    render(<FocusHarness />);
    const opener = screen.getByTestId("opener");
    opener.focus();
    await userEvent.click(opener);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(opener).toHaveFocus();
  });

  it("has no a11y violations", async () => {
    const { baseElement } = render(<Harness />);
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
