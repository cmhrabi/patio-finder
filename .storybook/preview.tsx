import type { Preview, Decorator } from "@storybook/react";
import React, { useEffect } from "react";
import "../src/tokens/tokens.css";
import "./preview.css";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import type { ThemeName, CardStyle } from "../src/theme/types";

const ThemeDecorator: Decorator = (Story, context) => {
  const theme = (context.globals.theme as ThemeName) ?? "cream";
  const cardStyle = (context.globals.cardStyle as CardStyle) ?? "soft";

  useEffect(() => {
    document.body.dataset.bgPreview = theme;
  }, [theme]);

  return (
    <ThemeProvider theme={theme} cardStyle={cardStyle}>
      <div className={`sb-canvas sb-canvas--${theme}`}>
        <Story />
      </div>
    </ThemeProvider>
  );
};

const preview: Preview = {
  globalTypes: {
    theme: {
      name: "Theme",
      description: "SunChaser theme",
      defaultValue: "cream",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "cream", title: "Cream (light)" },
          { value: "map", title: "Map (dark)" },
        ],
        dynamicTitle: true,
      },
    },
    cardStyle: {
      name: "Card style",
      description: "Card visual treatment",
      defaultValue: "soft",
      toolbar: {
        icon: "component",
        items: [
          { value: "soft", title: "Soft" },
          { value: "sharp", title: "Sharp" },
          { value: "outlined", title: "Outlined" },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: "padded",
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
  },
  decorators: [ThemeDecorator],
};

export default preview;
