import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The OSM building snapshot lives in /public, but Vercel's serverless tracer
  // doesn't auto-detect dynamic fs reads through path.join. Force-include it
  // on the cron route so the bundle ships the file alongside the function.
  outputFileTracingIncludes: {
    "/api/cron/sun-batch": ["./public/buildings.geojson"],
  },
};

export default nextConfig;
