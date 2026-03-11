import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: 500 * 1024 * 1024,
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;