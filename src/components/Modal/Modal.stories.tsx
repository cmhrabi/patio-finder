import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "../Button/Button";
import { TextField } from "../TextField/TextField";
import { Stack } from "../layout/Stack";

const meta: Meta<typeof Modal> = {
  title: "Primitives/Modal",
  component: Modal,
};
export default meta;
type S = StoryObj<typeof Modal>;

export const Basic: S = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open modal</Button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Save Bar Raval"
          description="Add this patio to your favourites — synced across this browser."
        >
          <Stack gap="3">
            <TextField label="Note (optional)" placeholder="Best for golden hour" />
            <Stack direction="row" gap="2" justify="flex-end">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => setOpen(false)}>Save</Button>
            </Stack>
          </Stack>
        </Modal>
      </>
    );
  },
};

export const Large: S = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open large modal</Button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          size="lg"
          title="Bellwoods Brewery"
          description="178 Ossington Ave · Trinity Bellwoods"
        >
          <p className="type-body-md" style={{ margin: 0 }}>
            Big patio facing west. Hits direct sun from about 4pm onward in summer.
            Cash &amp; card. Limited reservations.
          </p>
        </Modal>
      </>
    );
  },
};
