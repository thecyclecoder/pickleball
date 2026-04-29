import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // resvg-js (and Sharp) ship native .node bindings that Turbopack
  // can't ESM-bundle. Marking them external keeps Next from trying
  // to inline the binding, so the server runtime requires them at
  // runtime instead.
  serverExternalPackages: ["@resvg/resvg-js", "sharp"],
};

export default nextConfig;
