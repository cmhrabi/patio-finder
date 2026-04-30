import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Star } from "./Star";
import { Cluster } from "../layout/Cluster";

const meta: Meta<typeof Star> = {
  title: "Ratings/Star",
  component: Star,
};
export default meta;
type S = StoryObj<typeof Star>;

export const Uncontrolled: S = {};

export const Controlled: S = {
  render: () => {
    const [on, setOn] = useState(true);
    return <Star pressed={on} onChange={setOn} />;
  },
};

export const KitchenSink: S = {
  render: () => {
    const [a, setA] = useState(false);
    const [b, setB] = useState(true);
    const [c, setC] = useState(false);
    return (
      <Cluster gap="3">
        <Star pressed={a} onChange={setA} size={20} />
        <Star pressed={b} onChange={setB} size={28} />
        <Star pressed={c} onChange={setC} size={36} />
      </Cluster>
    );
  },
};
