import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // resvg-js (and Sharp) ship native .node bindings that Turbopack
  // can't ESM-bundle. Marking them external keeps Next from trying
  // to inline the binding, so the server runtime requires them at
  // runtime instead.
  serverExternalPackages: ["@resvg/resvg-js", "sharp"],
  // Vercel's deployment tracer skips files only referenced via
  // dynamic fs.readFileSync (font paths computed at runtime). Force
  // Inter woff2s into the bundle so resvg can find them.
  outputFileTracingIncludes: {
    "/api/admin/tournaments/**": [
      "./node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2",
      "./node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2",
    ],
  },
};

export default nextConfig;
