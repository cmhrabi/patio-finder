import type { Meta, StoryObj } from "@storybook/react";
import { GoogleStars } from "./GoogleStars";
import { Stack } from "../layout/Stack";

const meta: Meta<typeof GoogleStars> = {
  title: "Ratings/GoogleStars",
  component: GoogleStars,
  args: { value: 4.6, reviews: 1842 },
};
export default meta;
type S = StoryObj<typeof GoogleStars>;

export const Default: S = {};
export const HalfStar: S = { args: { value: 3.5, reviews: 412 } };
export const NoReviews: S = { args: { value: 4.0, reviews: undefined } };
export const HiddenMeta: S = { args: { hideMeta: true } };

export const Ramp: S = {
  render: () => (
    <Stack gap="2">
      {[
        { name: "Bar Raval", v: 4.6, r: 1842 },
        { name: "La Palma", v: 4.3, r: 982 },
        { name: "The Drake Hotel", v: 4.1, r: 5421 },
        { name: "Sweaty Betty's", v: 4.7, r: 312 },
        { name: "Famous Last Words", v: 3.9, r: 88 },
      ].map((p) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 200 }} className="type-body-sm">{p.name}</span>
          <GoogleStars value={p.v} reviews={p.r} />
        </div>
      ))}
    </Stack>
  ),
};
