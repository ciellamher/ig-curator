import type { NextConfig } from "next";

const nextConfig = {
  serverActions: {
    bodySizeLimit: "100mb",
  },
  experimental: {},
} as any;

export default nextConfig;
