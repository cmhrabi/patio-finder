import type { Meta, StoryObj } from "@storybook/react";
import { ArrowRight, MapPin, Heart } from "lucide-react";
import { Button } from "./Button";
import { Cluster } from "../layout/Cluster";
import { Stack } from "../layout/Stack";

const meta: Meta<typeof Button> = {
  title: "Primitives/Button",
  component: Button,
  args: { children: "Find sunny patios" },
};
export default meta;
type S = StoryObj<typeof Button>;

export const Primary: S = {};
export const Ink: S = { args: { variant: "ink", children: "Save patio" } };
export const Ghost: S = { args: { variant: "ghost", children: "Cancel" } };

export const Sizes: S = {
  render: (args) => (
    <Cluster gap="3">
      <Button {...args} size="sm" />
      <Button {...args} size="md" />
      <Button {...args} size="lg" />
    </Cluster>
  ),
};

export const WithIcons: S = {
  render: () => (
    <Stack gap="3" align="flex-start">
      <Button leadingIcon={<MapPin size={16} />}>Open in map</Button>
      <Button variant="ink" trailingIcon={<ArrowRight size={16} />}>Continue</Button>
      <Button variant="ghost" leadingIcon={<Heart size={16} />}>Saved</Button>
    </Stack>
  ),
};

export const Disabled: S = { args: { disabled: true } };

export const KitchenSink: S = {
  render: () => (
    <Stack gap="4">
      {(["primary", "ink", "ghost"] as const).map((v) => (
        <Cluster gap="3" key={v}>
          <Button variant={v} size="sm">{v} sm</Button>
          <Button variant={v} size="md">{v} md</Button>
          <Button variant={v} size="lg" trailingIcon={<ArrowRight size={18} />}>{v} lg</Button>
        </Cluster>
      ))}
    </Stack>
  ),
};
