import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // No outputFileTracingIncludes: the building snapshot used to be a 28.7 MB
  // file in /public force-bundled into the workflow step function. It now lives
  // as geographic tiles in Supabase Storage and is fetched on demand by
  // src/lib/buildings/loadNear.ts, so updating coverage no longer needs a deploy.
  allowedDevOrigins: ['192.168.2.39'],
};

export default withWorkflow(nextConfig);
