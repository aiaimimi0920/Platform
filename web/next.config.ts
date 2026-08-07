import type { NextConfig } from "next";
import path from "node:path";

import { assertDevAuthConfiguration } from "./src/lib/dev-auth";

assertDevAuthConfiguration();

const nextDistDir = process.env.NEXT_DIST_DIR?.trim();
const nextBuildId = process.env.NEXT_BUILD_ID?.trim();

const nextConfig: NextConfig = {
  distDir: nextDistDir && nextDistDir.length > 0 ? nextDistDir : ".next",
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@neuro/contracts"],
  ...(nextBuildId ? { generateBuildId: async () => nextBuildId } : {}),
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
