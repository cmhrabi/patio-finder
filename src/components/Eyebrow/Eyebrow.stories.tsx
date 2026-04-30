import type { Meta, StoryObj } from "@storybook/react";
import { Eyebrow } from "./Eyebrow";
import { Stack } from "../layout/Stack";

const meta: Meta<typeof Eyebrow> = {
  title: "Typography/Eyebrow",
  component: Eyebrow,
  args: { children: "Live sun · Updated 2 min ago" },
};
export default meta;
type S = StoryObj<typeof Eyebrow>;

export const Default: S = {};
export const WithAccent: S = { args: { accent: true } };

export const KitchenSink: S = {
  render: () => (
    <Stack gap="3">
      <Eyebrow>Trinity Bellwoods</Eyebrow>
      <Eyebrow accent>Open now</Eyebrow>
      <Eyebrow>Patio · 24 seats</Eyebrow>
    </Stack>
  ),
};
