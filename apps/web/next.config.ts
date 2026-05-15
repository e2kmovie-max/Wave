import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // Mongoose ships with optional native modules; keep it as an external on the server.
  serverExternalPackages: ["mongoose"],
  transpilePackages: ["@wave/interface", "@wave/player", "@wave/social", "@wave/shared"],
};

export default nextConfig;
