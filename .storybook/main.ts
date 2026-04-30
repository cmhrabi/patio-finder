import type { StorybookConfig } from "@storybook/react-vite";
import path from "node:path";

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(ts|tsx)",
    "../.storybook/**/*.mdx",
  ],
  addons: ["@storybook/addon-essentials", "@storybook/addon-interactions"],
  framework: { name: "@storybook/react-vite", options: {} },
  viteFinal: async (cfg) => {
    cfg.resolve = cfg.resolve ?? {};
    cfg.resolve.alias = {
      ...(cfg.resolve.alias ?? {}),
      "@": path.resolve(__dirname, "../src"),
    };
    return cfg;
  },
};
export default config;
