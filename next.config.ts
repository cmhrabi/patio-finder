import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The landing page reads `public/buildings.geojson` server-side via
  // `loadStaticBuildings()` (process.cwd() + path.join). Vercel's serverless
  // function tracing doesn't include files under `public/` by default — they're
  // CDN-served, not bundled. Opt in explicitly so the file is co-located with
  // the landing page's serverless function.
  outputFileTracingIncludes: {
    "/": ["./public/buildings.geojson"],
  },
};

export default nextConfig;
