import type { Meta, StoryObj } from "@storybook/react";
import { Logo } from "./Logo";
import { Stack } from "../layout/Stack";

const meta: Meta<typeof Logo> = {
  title: "Identity/Logo",
  component: Logo,
};
export default meta;
type S = StoryObj<typeof Logo>;

export const Default: S = {};
export const MarkOnly: S = { args: { variant: "mark", size: 48 } };
export const Large: S = { args: { size: 56 } };
export const InAccent: S = {
  render: () => (
    <span style={{ color: "var(--accent)" }}>
      <Logo size={40} />
    </span>
  ),
};

export const KitchenSink: S = {
  render: () => (
    <Stack gap="5">
      <Logo size={20} />
      <Logo size={28} />
      <Logo size={40} />
      <Logo size={56} />
      <Logo variant="mark" size={64} />
    </Stack>
  ),
};
