import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ana dizinde başka bir lockfile var; kökü açıkça bu projeye sabitle.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      // Finnhub şirket logoları
      { protocol: "https", hostname: "static2.finnhub.io" },
      { protocol: "https", hostname: "static.finnhub.io" },
    ],
  },
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
};

export default nextConfig;
