import type { NextConfig } from "next";
import path from "node:path";

import { assertDevAuthConfiguration } from "./src/lib/dev-auth";

assertDevAuthConfiguration();

const nextDistDir = process.env.NEXT_DIST_DIR?.trim();

const nextConfig: NextConfig = {
  distDir: nextDistDir && nextDistDir.length > 0 ? nextDistDir : ".next",
  transpilePackages: ["@neuro/contracts"],
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
