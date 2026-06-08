import type { NextConfig } from "next";
import path from "node:path";

const nextDistDir = process.env.NEXT_DIST_DIR?.trim();

const nextConfig: NextConfig = {
  distDir: nextDistDir && nextDistDir.length > 0 ? nextDistDir : ".next",
  transpilePackages: ["@neuro/contracts"],
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
