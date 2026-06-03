import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this project — otherwise Next picks up
  // an unrelated package-lock.json in $HOME and warns on every build.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
