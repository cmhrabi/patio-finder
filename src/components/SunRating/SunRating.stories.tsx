import type { Meta, StoryObj } from "@storybook/react";
import { SunRating } from "./SunRating";
import { Stack } from "../layout/Stack";

const meta: Meta<typeof SunRating> = {
  title: "Ratings/SunRating",
  component: SunRating,
  args: { value: 78 },
};
export default meta;
type S = StoryObj<typeof SunRating>;

export const Default: S = {};
export const Empty: S = { args: { value: 0 } };
export const Half: S = { args: { value: 50 } };
export const Full: S = { args: { value: 100 } };
export const Large: S = { args: { value: 64, size: 22 } };

export const Ramp: S = {
  render: () => (
    <Stack gap="2">
      {[0, 12, 30, 50, 65, 80, 92, 100].map((v) => (
        <div key={v} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SunRating value={v} />
          <span className="type-mono-md" style={{ color: "var(--ink-mute)" }}>
            {v}
          </span>
        </div>
      ))}
    </Stack>
  ),
};
