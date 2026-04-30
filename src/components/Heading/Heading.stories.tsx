import type { Meta, StoryObj } from "@storybook/react";
import { Heading } from "./Heading";
import { Stack } from "../layout/Stack";

const meta: Meta<typeof Heading> = {
  title: "Typography/Heading",
  component: Heading,
  args: { children: "Patios with the most sun, right now." },
};
export default meta;
type S = StoryObj<typeof Heading>;

export const DisplayXL: S = { args: { size: "display-xl" } };
export const DisplayLG: S = { args: { size: "display-lg" } };
export const DisplayMD: S = { args: { size: "display-md" } };
export const DisplaySM: S = { args: { size: "display-sm" } };

export const KitchenSink: S = {
  render: (args) => (
    <Stack gap="6">
      <Heading {...args} size="display-xl">Bar Raval</Heading>
      <Heading {...args} size="display-lg">La Palma</Heading>
      <Heading {...args} size="display-md">The Drake Hotel</Heading>
      <Heading {...args} size="display-sm" muted>Trinity Bellwoods</Heading>
    </Stack>
  ),
};
