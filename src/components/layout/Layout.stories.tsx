import type { Meta, StoryObj } from "@storybook/react";
import { Stack } from "./Stack";
import { Cluster } from "./Cluster";
import { Grid } from "./Grid";

const meta: Meta = {
  title: "Layout/Helpers",
};
export default meta;

const Box = ({ label }: { label: string }) => (
  <div
    style={{
      background: "var(--paper-2)",
      color: "var(--ink)",
      padding: "var(--space-3) var(--space-4)",
      borderRadius: "var(--radius-md)",
      fontFamily: "var(--font-body)",
      fontSize: 13,
      border: "1px solid var(--hairline-2)",
    }}
  >
    {label}
  </div>
);

export const StackVertical: StoryObj = {
  render: () => (
    <Stack gap="3">
      <Box label="One" />
      <Box label="Two" />
      <Box label="Three" />
    </Stack>
  ),
};

export const StackHorizontal: StoryObj = {
  render: () => (
    <Stack direction="row" gap="3" align="center">
      <Box label="Lead" />
      <Box label="Middle" />
      <Box label="Trail" />
    </Stack>
  ),
};

export const ClusterWrap: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <Cluster gap="2">
        {[
          "Little Italy",
          "Ossington",
          "Kensington",
          "Queen West",
          "Trinity Bellwoods",
          "Dundas West",
          "Junction",
          "Leslieville",
        ].map((n) => (
          <Box key={n} label={n} />
        ))}
      </Cluster>
    </div>
  ),
};

export const GridFixed: StoryObj = {
  render: () => (
    <Grid columns={3} gap="4">
      {Array.from({ length: 6 }, (_, i) => (
        <Box key={i} label={`Cell ${i + 1}`} />
      ))}
    </Grid>
  ),
};

export const GridResponsive: StoryObj = {
  render: () => (
    <Grid minColumnWidth="180px" gap="4">
      {Array.from({ length: 8 }, (_, i) => (
        <Box key={i} label={`Cell ${i + 1}`} />
      ))}
    </Grid>
  ),
};
