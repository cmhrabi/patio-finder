import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { Card } from "./Card";

describe("Card", () => {
  it("renders composable subcomponents", () => {
    render(
      <Card>
        <Card.Media data-testid="m">media</Card.Media>
        <Card.Body data-testid="b">body</Card.Body>
        <Card.Footer data-testid="f">footer</Card.Footer>
      </Card>,
    );
    expect(screen.getByTestId("m")).toBeInTheDocument();
    expect(screen.getByTestId("b")).toBeInTheDocument();
    expect(screen.getByTestId("f")).toBeInTheDocument();
  });

  it("scopes a per-card cardStyle override via data-card-style", () => {
    const { container } = render(
      <Card cardStyle="outlined">
        <Card.Body>x</Card.Body>
      </Card>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("data-card-style")).toBe("outlined");
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <Card>
        <Card.Body>
          <h2>Bellwoods</h2>
          <p>Patio</p>
        </Card.Body>
      </Card>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
