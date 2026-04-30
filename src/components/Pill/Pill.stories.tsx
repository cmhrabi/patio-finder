import type { Meta, StoryObj } from "@storybook/react";
import { Sun, MapPin } from "lucide-react";
import { Pill } from "./Pill";
import { Cluster } from "../layout/Cluster";

const meta: Meta<typeof Pill> = {
  title: "Primitives/Pill",
  component: Pill,
  args: { children: "Open now" },
};
export default meta;
type S = StoryObj<typeof Pill>;

export const Default: S = {};
export const Accent: S = { args: { variant: "accent", children: "Featured" } };
export const Sunny: S = { args: { variant: "sun", children: "Full sun · 92" } };
export const Ink: S = { args: { variant: "ink", children: "Closed" } };
export const GhostLight: S = { args: { variant: "ghost-light", children: "Live · Map view" } };

export const KitchenSink: S = {
  render: () => (
    <Cluster gap="2">
      <Pill leadingIcon={<MapPin size={12} strokeWidth={2.25} />}>Trinity Bellwoods</Pill>
      <Pill variant="accent">Featured</Pill>
      <Pill variant="sun" leadingIcon={<Sun size={12} strokeWidth={2.25} />}>92% sun</Pill>
      <Pill variant="ink">Closes 11pm</Pill>
      <Pill variant="ghost-light">Patio</Pill>
    </Cluster>
  ),
};
