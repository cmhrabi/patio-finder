import type { Meta, StoryObj } from "@storybook/react";
import { Sparkline } from "./Sparkline";
import { Stack } from "../layout/Stack";

const meta: Meta<typeof Sparkline> = {
  title: "Data/Sparkline",
  component: Sparkline,
  args: {
    data: [12, 22, 34, 51, 70, 88, 95, 92, 80, 60, 38, 18],
    currentIndex: 6,
  },
};
export default meta;
type S = StoryObj<typeof Sparkline>;

export const SunHours: S = {};
export const NoCurrent: S = { args: { currentIndex: undefined } };
export const Wide: S = { args: { width: 240, height: 56 } };

export const KitchenSink: S = {
  render: () => (
    <Stack gap="3">
      <Sparkline data={[10, 20, 22, 26, 32, 40, 60, 72, 80, 88, 90, 84, 70, 50, 24]} currentIndex={9} />
      <Sparkline
        data={[80, 70, 64, 58, 50, 44, 40, 38, 36, 34]}
        currentIndex={4}
        color="var(--accent)"
      />
      <Sparkline
        data={[10, 15, 22, 30, 36, 42, 38, 28, 18, 12]}
        currentIndex={5}
        color="var(--shade-300)"
      />
    </Stack>
  ),
};
