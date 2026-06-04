import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@neuro/contracts"],
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
