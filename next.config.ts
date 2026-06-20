import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this project — otherwise Next picks up
  // an unrelated package-lock.json in $HOME and warns on every build.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // @resvg/resvg-js ships a native .node binding (used server-side to rasterize
  // the SITREP SVG visuals into PNGs for the .docx export). Turbopack cannot
  // place a native addon inside an ESM chunk — keep it external so it's
  // require()'d at runtime from node_modules in the Node serverless function.
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
