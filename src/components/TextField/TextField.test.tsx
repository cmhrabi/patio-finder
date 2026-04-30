import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("associates the label with the input", () => {
    render(<TextField label="Email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toBeInstanceOf(HTMLInputElement);
  });

  it("accepts user input", async () => {
    render(<TextField label="Email" />);
    await userEvent.type(screen.getByLabelText("Email"), "hi@sun.ca");
    expect(screen.getByLabelText("Email")).toHaveValue("hi@sun.ca");
  });

  it("marks the field invalid when error is present", () => {
    render(<TextField label="Email" error="Bad email" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Bad email");
  });

  it("has no a11y violations", async () => {
    const { container } = render(<TextField label="Email" placeholder="you@example.com" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
