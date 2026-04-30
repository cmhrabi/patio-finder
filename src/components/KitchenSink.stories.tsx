import type { Meta, StoryObj } from "@storybook/react";
import { Sun, MapPin } from "lucide-react";
import { useState } from "react";
import { Logo } from "./Logo/Logo";
import { Heading } from "./Heading/Heading";
import { Eyebrow } from "./Eyebrow/Eyebrow";
import { Pill } from "./Pill/Pill";
import { Button } from "./Button/Button";
import { Card } from "./Card/Card";
import { SunRating } from "./SunRating/SunRating";
import { Star } from "./Star/Star";
import { GoogleStars } from "./GoogleStars/GoogleStars";
import { Sparkline } from "./Sparkline/Sparkline";
import { Toggle } from "./Toggle/Toggle";
import { TextField } from "./TextField/TextField";
import { Modal } from "./Modal/Modal";
import { Stack } from "./layout/Stack";
import { Cluster } from "./layout/Cluster";
import { Grid } from "./layout/Grid";

const meta: Meta = { title: "Foundations/Kitchen sink" };
export default meta;

const patios = [
  { id: "raval", name: "Bar Raval", hood: "Little Italy", sun: 92, rating: 4.6, reviews: 1842 },
  { id: "palma", name: "La Palma", hood: "Little Italy", sun: 78, rating: 4.3, reviews: 982 },
  { id: "drake", name: "The Drake Hotel", hood: "Queen West", sun: 64, rating: 4.1, reviews: 5421 },
  { id: "betty", name: "Sweaty Betty's", hood: "Ossington", sun: 84, rating: 4.7, reviews: 312 },
  { id: "famous", name: "Famous Last Words", hood: "Junction", sun: 70, rating: 3.9, reviews: 88 },
  { id: "otto", name: "Otto's Bierhalle", hood: "Dundas West", sun: 88, rating: 4.4, reviews: 901 },
];

export const Everything: StoryObj = {
  render: () => {
    const [openNow, setOpenNow] = useState(true);
    const [hideShade, setHideShade] = useState(false);
    const [favs, setFavs] = useState<Record<string, boolean>>({ raval: true });
    const [modalOpen, setModalOpen] = useState(false);

    return (
      <Stack gap="7">
        <Cluster justify="space-between" align="center">
          <Logo size={32} />
          <Cluster gap="3">
            <TextField
              variant="search"
              label="Search"
              hideLabel
              placeholder="Search patios"
              leadingIcon={<Sun size={16} />}
            />
            <Button leadingIcon={<MapPin size={16} />}>Open map</Button>
          </Cluster>
        </Cluster>

        <Stack gap="2">
          <Eyebrow accent>Live · Toronto · 28°C</Eyebrow>
          <Heading size="display-xl">Patios with the most sun, right now.</Heading>
          <p className="type-body-lg" style={{ margin: 0, color: "var(--ink-soft)", maxWidth: 560 }}>
            Updated every 15 minutes from satellite + building shadow data. Sun ratings reflect what
            the patio looks like at this exact moment.
          </p>
        </Stack>

        <Cluster gap="3">
          <Toggle label="Open now" checked={openNow} onChange={setOpenNow} />
          <Toggle label="Hide patios with > 50% shade" checked={hideShade} onChange={setHideShade} />
          <Button variant="ghost" onClick={() => setModalOpen(true)}>Save list</Button>
        </Cluster>

        <Grid minColumnWidth="280px" gap="5">
          {patios.map((p) => (
            <Card key={p.id} interactive>
              <Card.Body>
                <Cluster justify="space-between" align="flex-start">
                  <Stack gap="1">
                    <Eyebrow>{p.hood}</Eyebrow>
                    <Heading size="display-sm">{p.name}</Heading>
                  </Stack>
                  <Star
                    pressed={!!favs[p.id]}
                    onChange={(v) => setFavs((m) => ({ ...m, [p.id]: v }))}
                  />
                </Cluster>
                <Cluster gap="2">
                  <Pill variant="sun" leadingIcon={<Sun size={12} strokeWidth={2.5} />}>
                    {p.sun} · sun
                  </Pill>
                  <Pill>Open · Closes 11pm</Pill>
                </Cluster>
                <Cluster justify="space-between">
                  <SunRating value={p.sun} />
                  <GoogleStars value={p.rating} reviews={p.reviews} />
                </Cluster>
                <Sparkline
                  data={[10, 22, 35, 50, 65, 80, p.sun, 88, 78, 60, 40, 22]}
                  currentIndex={6}
                  width={240}
                  height={36}
                />
              </Card.Body>
            </Card>
          ))}
        </Grid>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Save your sun list"
          description="Sync favourites across this browser, no account required."
        >
          <Stack gap="3">
            <TextField label="List name" defaultValue="My golden hour spots" />
            <Cluster gap="2" justify="flex-end">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={() => setModalOpen(false)}>Save list</Button>
            </Cluster>
          </Stack>
        </Modal>
      </Stack>
    );
  },
};
