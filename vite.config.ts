import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Vite is used here only by Vitest and Storybook (react-vite).
// The Next.js app build does NOT go through Vite — `next build` owns that.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
