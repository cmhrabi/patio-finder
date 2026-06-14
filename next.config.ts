import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // The OSM building snapshot lives in /public, but Vercel's serverless tracer
  // doesn't auto-detect dynamic fs reads through path.join. loadStaticBuildings
  // now runs inside the sun-batch workflow *steps*, which withWorkflow bundles
  // into the shared step runtime function — so the file must be force-included
  // there (not on the cron route, which no longer reads buildings).
  outputFileTracingIncludes: {
    "/.well-known/workflow/v1/step": ["./public/buildings.geojson"],
  },
  allowedDevOrigins: ['192.168.2.39'],
};

export default withWorkflow(nextConfig);
