import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // resvg-js (and Sharp) ship native .node bindings that Turbopack
  // can't ESM-bundle. Marking them external keeps Next from trying
  // to inline the binding, so the server runtime requires them at
  // runtime instead.
  serverExternalPackages: ["@resvg/resvg-js", "sharp"],
  // Vercel's tracer doesn't see files only referenced via dynamic
  // fs.readFileSync. Force the Inter TTF into the API-route bundle so
  // resvg can find it.
  outputFileTracingIncludes: {
    "/api/admin/tournaments/**": ["./src/lib/fonts/Inter-VariableFont.ttf"],
  },
};

export default nextConfig;
