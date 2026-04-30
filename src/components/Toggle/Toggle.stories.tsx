import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Toggle } from "./Toggle";
import { Stack } from "../layout/Stack";

const meta: Meta<typeof Toggle> = {
  title: "Primitives/Toggle",
  component: Toggle,
};
export default meta;
type S = StoryObj<typeof Toggle>;

export const Off: S = { args: { "aria-label": "Open now" } };
export const On: S = { args: { defaultChecked: true, "aria-label": "Open now" } };

export const WithLabel: S = {
  render: () => {
    const [a, setA] = useState(true);
    const [b, setB] = useState(false);
    return (
      <Stack gap="3">
        <Toggle label="Show only patios open now" checked={a} onChange={setA} />
        <Toggle label="Hide patios with shade > 50%" checked={b} onChange={setB} />
        <Toggle label="Disabled" disabled />
      </Stack>
    );
  },
};

export const SmallSize: S = {
  args: { size: "sm", defaultChecked: true, "aria-label": "Compact" },
};
