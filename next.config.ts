import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/manifest.json',
        destination: '/api/pwa-manifest',
      },
      {
        source: '/manifest.webmanifest',
        destination: '/api/pwa-manifest',
      },
    ];
  },
};

export default nextConfig;
