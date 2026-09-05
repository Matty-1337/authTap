import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // This repo sits next to other package.json trees. Next 16 otherwise infers
  // a parent workspace root and Turbopack emits module ids like `app/login/page`
  // as chunk URLs (no .js), which throws at runtime.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
