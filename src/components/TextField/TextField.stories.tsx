import type { Meta, StoryObj } from "@storybook/react";
import { Search, Mail } from "lucide-react";
import { TextField } from "./TextField";
import { Stack } from "../layout/Stack";

const meta: Meta<typeof TextField> = {
  title: "Forms/TextField",
  component: TextField,
};
export default meta;
type S = StoryObj<typeof TextField>;

export const FormDefault: S = {
  args: { label: "Email", placeholder: "you@example.com", leadingIcon: <Mail size={16} /> },
};

export const SearchVariant: S = {
  args: {
    variant: "search",
    label: "Search patios",
    hideLabel: true,
    placeholder: "Search by name or neighbourhood",
    leadingIcon: <Search size={16} />,
  },
};

export const WithError: S = {
  args: {
    label: "Email",
    defaultValue: "not-an-email",
    error: "Use a valid email address",
  },
};

export const KitchenSink: S = {
  render: () => (
    <Stack gap="5" style={{ maxWidth: 360 }}>
      <TextField
        variant="search"
        label="Search"
        hideLabel
        placeholder="Bar Raval, Ossington…"
        leadingIcon={<Search size={16} />}
      />
      <TextField label="Name" placeholder="Jack" />
      <TextField label="Email" placeholder="you@example.com" leadingIcon={<Mail size={16} />} />
      <TextField label="Postcode" hint="Used to centre the map" defaultValue="M6J" />
      <TextField label="Postcode" defaultValue="zzz" error="Not a Toronto postcode" />
    </Stack>
  ),
};
