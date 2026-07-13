import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained production server so the deployment image can run without the full
  // node_modules tree.
  output: "standalone",
  // Allow the dev server to serve resources to a tunnelled origin used for sharing sessions. The host
  // is taken from DEV_TUNNEL_ORIGIN so no specific tunnel address is committed; unset means no extra
  // origin is allowed.
  ...(process.env.DEV_TUNNEL_ORIGIN
    ? { allowedDevOrigins: [process.env.DEV_TUNNEL_ORIGIN] }
    : {}),
  // Hide the Next.js dev indicator (bottom-left build/status badge).
  devIndicators: false,
};

export default nextConfig;
