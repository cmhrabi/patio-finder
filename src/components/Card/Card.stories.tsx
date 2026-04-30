import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./Card";
import { Heading } from "../Heading/Heading";
import { Eyebrow } from "../Eyebrow/Eyebrow";
import { Pill } from "../Pill/Pill";
import { Button } from "../Button/Button";
import { Stack } from "../layout/Stack";
import { Cluster } from "../layout/Cluster";
import { Grid } from "../layout/Grid";

const meta: Meta = {
  title: "Primitives/Card",
};
export default meta;

const sample = {
  name: "Bar Raval",
  hood: "Little Italy",
  exposure: "Full sun · 92",
  pic: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=70",
};

export const Default: StoryObj = {
  render: () => (
    <Card style={{ maxWidth: 360 }}>
      <Card.Media>
        <img src={sample.pic} alt="" />
      </Card.Media>
      <Card.Body>
        <Eyebrow>{sample.hood}</Eyebrow>
        <Heading size="display-sm">{sample.name}</Heading>
        <Cluster gap="2">
          <Pill variant="sun">{sample.exposure}</Pill>
          <Pill>Open · Closes 2am</Pill>
        </Cluster>
      </Card.Body>
      <Card.Footer>
        <span className="type-body-sm" style={{ color: "var(--ink-mute)" }}>505 College St</span>
        <Button size="sm">Save</Button>
      </Card.Footer>
    </Card>
  ),
};

export const Interactive: StoryObj = {
  render: () => (
    <Card interactive style={{ maxWidth: 360 }}>
      <Card.Media>
        <img src={sample.pic} alt="" />
      </Card.Media>
      <Card.Body>
        <Heading size="display-sm">La Palma</Heading>
        <p className="type-body-md" style={{ margin: 0, color: "var(--ink-soft)" }}>
          Big back patio. Best in late afternoon.
        </p>
      </Card.Body>
    </Card>
  ),
};

export const KitchenSink: StoryObj = {
  render: () => (
    <Grid minColumnWidth="280px" gap="5">
      {(["soft", "sharp", "outlined"] as const).map((s) => (
        <Card key={s} cardStyle={s}>
          <Card.Body>
            <Eyebrow>{s} card</Eyebrow>
            <Heading size="display-sm">Sweaty Betty's</Heading>
            <Stack gap="2">
              <p className="type-body-md" style={{ margin: 0, color: "var(--ink-soft)" }}>
                Patio &amp; sidewalk seating. Good shade after 7pm.
              </p>
              <Cluster gap="2">
                <Pill variant="sun">78</Pill>
                <Pill>Ossington</Pill>
              </Cluster>
            </Stack>
          </Card.Body>
          <Card.Footer>
            <span className="type-mono-md">M6J 1S6</span>
            <Button size="sm" variant="ghost">Open</Button>
          </Card.Footer>
        </Card>
      ))}
    </Grid>
  ),
};
